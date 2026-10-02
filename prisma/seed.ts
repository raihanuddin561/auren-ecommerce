/**
 * Development seed: the store owner, one warehouse, 6 categories and 40 menswear products with
 * variants, images and opening stock. Safe to run again: the owner is ensured, and the catalog is
 * only written into an empty database (use `pnpm db:reset` for a clean slate).
 *
 *   pnpm db:seed
 *
 * Refuses to touch a non-local database unless SEED_ALLOW_REMOTE=1 (demo data does not belong in
 * production; use `pnpm owner:create` there).
 */
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';

config({ quiet: true });

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '';
if (
  process.env.SEED_ALLOW_REMOTE !== '1' &&
  (process.env.NODE_ENV === 'production' || !LOCAL_HOSTS.has(target))
) {
  console.error(
    `Refusing to seed demo data into a non-local database (host: ${target || 'unset'}). ` +
      'Set SEED_ALLOW_REMOTE=1 to override, or use `pnpm owner:create` to bootstrap production.',
  );
  process.exit(1);
}

const { db } = await import('../src/lib/db');
const { ensureOwnerAccount } = await import('../src/lib/owner');
const { seedCatalog } = await import('./seed-catalog');

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL || 'owner@auren.local';
  const generated = !process.env.SEED_OWNER_PASSWORD;
  const password = process.env.SEED_OWNER_PASSWORD || randomBytes(15).toString('base64url');
  const result = await ensureOwnerAccount({ email, name: 'Store Owner', password });
  if (result.created) {
    console.log(`Owner created: ${email}`);
    if (generated) console.log(`Temporary password (shown once): ${password}`);
    console.log(
      'Sign in at /admin/sign-in; you will be asked to set up two-factor authentication.',
    );
  } else {
    console.log(`Owner ${email} already exists.`);
  }
}

try {
  await seedOwner();
  const catalog = await seedCatalog(db);
  console.log(
    catalog.skipped
      ? 'Catalog already has products; skipping (run pnpm db:reset for a fresh seed).'
      : `Catalog seeded: ${catalog.categories} categories, ${catalog.products} products, ` +
          `${catalog.variants} variants, ${catalog.media} images, 1 location.`,
  );
} finally {
  await db.$disconnect();
}
