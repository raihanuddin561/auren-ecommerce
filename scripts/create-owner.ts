/**
 * First-time setup: creates the store owner account.
 *
 *   pnpm owner:create                      uses SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD from .env
 *   pnpm owner:create you@example.com      email as the first argument
 *
 * If no password is configured a strong one is generated and printed once. The owner must enrol
 * two-factor authentication at /admin/security on first sign-in.
 */
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });
delete process.env.SEED_DEMO_ADMIN;

const { ensureOwnerAccount } = await import('../src/lib/owner');
const { db } = await import('../src/lib/db');

const rawArgs = process.argv.slice(2).filter((arg) => arg !== '--');
const email = rawArgs[0] ?? process.env.SEED_OWNER_EMAIL;
if (!email || email === '--' || !email.includes('@')) {
  console.error(
    'Pass a valid email address (e.g. pnpm run owner:create admin@example.com) or set SEED_OWNER_EMAIL.',
  );
  process.exit(1);
}

const generated = !process.env.SEED_OWNER_PASSWORD;
const password = process.env.SEED_OWNER_PASSWORD || randomBytes(15).toString('base64url');

try {
  const dummyUsers = await db.user.findMany({ where: { email: '--' }, select: { id: true } });
  if (dummyUsers.length > 0) {
    const ids = dummyUsers.map((u) => u.id);
    await db.staffMember.deleteMany({ where: { userId: { in: ids } } });
    await db.account.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }
  const result = await ensureOwnerAccount({ email, name: 'Store Owner', password });
  if (!result.created) {
    console.log(`Owner ${email} already exists. Nothing changed.`);
  } else {
    console.log(`Owner created: ${email}`);
    if (generated) console.log(`Temporary password (shown once): ${password}`);
    console.log(
      'Sign in at /admin/sign-in, then follow the prompt to set up two-factor authentication.',
    );
  }
} finally {
  await db.$disconnect();
}
