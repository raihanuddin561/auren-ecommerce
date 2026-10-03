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

const { ensureOwnerAccount } = await import('../src/lib/owner');
const { db } = await import('../src/lib/db');

const email = process.argv[2] ?? process.env.SEED_OWNER_EMAIL;
if (!email) {
  console.error('Pass an email address or set SEED_OWNER_EMAIL.');
  process.exit(1);
}

const generated = !process.env.SEED_OWNER_PASSWORD;
const password = process.env.SEED_OWNER_PASSWORD || randomBytes(15).toString('base64url');

try {
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
