import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { resetPasswordMessage, verifyEmailMessage } from '@/emails/auth';
import { AUTH_COOKIE_PREFIX } from './auth-constants';
import { db } from './db';
import { sendEmailInBackground } from './email';
import { env, isProduction, services } from './env';
import { newId } from './ids';

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const ONE_DAY = 60 * 60 * 24;

async function isStaffUser(userId: string): Promise<boolean> {
  const member = await db.staffMember.findUnique({ where: { userId }, select: { id: true } });
  return member !== null;
}

export const auth = betterAuth({
  appName: 'AUREN',
  baseURL: env.APP_URL,
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
  },

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
    expiresIn: THIRTY_DAYS,
    updateAge: ONE_DAY,
  },

  user: {
    additionalFields: {
      banned: { type: 'boolean', required: false, defaultValue: false, input: false },
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
          return user?.banned ? false : { data: session };
        },
      },
    },
  },

  plugins: [
    twoFactor({ issuer: env.TOTP_ISSUER }),
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
