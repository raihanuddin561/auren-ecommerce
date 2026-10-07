import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { resetPasswordMessage, verifyEmailMessage } from '@/emails/auth';
import { AUTH_COOKIE_PREFIX } from './auth-constants';
import { db } from './db';
import { sendEmailInBackground } from './email';
import { env, isProduction, services } from './env';
import { newId } from './ids';
import { logger } from './logger';
import {
  CUSTOMER_SESSION_SECONDS,
  FRESH_SESSION_SECONDS,
  staffSessionExpiresAt,
} from './session-policy';

async function isStaffUser(userId: string): Promise<boolean> {
  const member = await db.staffMember.findUnique({ where: { userId }, select: { id: true } });
  return member !== null;
}

function buildTrustedOrigins(): string[] {
  const origins = new Set<string>(['https://aurenbd.vercel.app', 'https://*.vercel.app']);
  if (env.APP_URL) {
    try {
      origins.add(new URL(env.APP_URL).origin);
    } catch {}
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    for (const origin of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')) {
      if (origin.trim()) origins.add(origin.trim());
    }
  }
  return [...origins];
}

export const auth = betterAuth({
  appName: 'AUREN',
  baseURL: env.APP_URL,
  trustedOrigins: buildTrustedOrigins(),
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql' }),

  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    useSecureCookies: isProduction,
    // Columns are native uuid, so ids must be UUIDs; v7 keeps them time ordered.
    database: { generateId: () => newId() },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset means the old password may be known to someone else: end every existing session.
    revokeSessionsOnPasswordReset: true,
    // Choosing a new password through the reset link also ends the bootstrap-password state.
    onPasswordReset: async ({ user }) => {
      await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    },
    sendResetPassword: async ({ user, url }) => {
      sendEmailInBackground({ to: user.email, ...resetPasswordMessage({ name: user.name, url }) });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    // Verification links must not start a session; staff always pass password + TOTP.
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      sendEmailInBackground({ to: user.email, ...verifyEmailMessage({ name: user.name, url }) });
    },
  },

  // Google appears only when both credentials are configured.
  socialProviders: services.googleAuth
    ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
    : {},
  // Linking a social login to an existing email account is off: it enables pre-registration
  // account takeover and would let staff bypass TOTP. Revisit with the customer accounts work.
  account: {
    accountLinking: { enabled: false },
    // Provider access and refresh tokens are encrypted at rest.
    encryptOAuthTokens: true,
  },

  // Reset and verification tokens are stored as hashes, so a read of the table cannot be replayed.
  verification: { storeIdentifier: 'hashed' },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: 'memory',
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 300, max: 5 },
      '/request-password-reset': { window: 300, max: 3 },
      '/send-verification-email': { window: 300, max: 3 },
      '/two-factor/verify-totp': { window: 60, max: 5 },
    },
  },

  session: {
    // Absolute lifetime: sessions do not slide. Staff sessions are capped much lower on creation.
    expiresIn: CUSTOMER_SESSION_SECONDS,
    disableSessionRefresh: true,
    freshAge: FRESH_SESSION_SECONDS,
  },

  user: {
    additionalFields: {
      banned: { type: 'boolean', required: false, defaultValue: false, input: false },
      mustChangePassword: { type: 'boolean', required: false, defaultValue: false, input: false },
    },
  },

  databaseHooks: {
    account: {
      create: {
        // Staff sign in with email, password and TOTP only. A social login skips the TOTP step.
        before: async (account) => {
          if (account.providerId === 'credential') return { data: account };
          return (await isStaffUser(account.userId)) ? false : { data: account };
        },
      },
    },
    session: {
      create: {
        // A blocked customer cannot start a new session.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { banned: true },
          });
          if (user?.banned) return false;
          // Staff sessions end a fixed time after sign-in, whatever the activity.
          if (await isStaffUser(session.userId)) {
            return {
              data: { ...session, expiresAt: staffSessionExpiresAt(new Date(), session.expiresAt) },
            };
          }
          return { data: session };
        },
      },
    },
  },

  hooks: {
    // Changing a password always signs out every other device, whatever the client asked for.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/change-password') {
        const body = (ctx.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown };
        // The bootstrap password cannot be changed to itself.
        if (body.newPassword !== undefined && body.newPassword === body.currentPassword) {
          throw APIError.from('BAD_REQUEST', {
            code: 'PASSWORD_UNCHANGED',
            message: 'Choose a password different from your current one.',
          });
        }
        return { context: { body: { ...body, revokeOtherSessions: true } } };
      }
      // Staff always pass password and authenticator code: no trust-this-device shortcut.
      if (ctx.path?.startsWith('/two-factor/verify-')) {
        return { context: { body: { ...(ctx.body ?? {}), trustDevice: false } } };
      }
    }),
    // Choosing a new password ends the "bootstrap password" state of a first owner.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/change-password') return;
      const userId = ctx.context.newSession?.user.id;
      if (!userId) return;
      try {
        await db.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
      } catch (error) {
        // The flag staying set is the safe direction; the user is simply asked once more.
        logger.error({ err: error, userId }, 'could not clear the forced password change flag');
      }
      logger.info({ userId }, 'password changed; other sessions revoked');
    }),
  },

  plugins: [
    twoFactor({
      issuer: env.TOTP_ISSUER,
      // Belt and braces next to the hook above: a trusted-device record is worthless after a second.
      trustDeviceMaxAge: 1,
      // Wrong codes lock the account's second factor for a while, across all challenges.
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
    }),
    nextCookies(), // must stay last
  ],
});

export type AppSession = typeof auth.$Infer.Session;
export type AppUser = AppSession['user'];

/** Current session, or null. Deduplicated per request. Reads cookies, so render inside Suspense. */
export const getSession = cache(async (): Promise<AppSession | null> =>
  auth.api.getSession({ headers: await headers() }),
);

/** Signed-in user, or a redirect to the sign-in page. */
export async function requireUser(): Promise<AppUser> {
  const session = await getSession();
  if (!session || session.user.banned) redirect('/login');
  return session.user;
}
