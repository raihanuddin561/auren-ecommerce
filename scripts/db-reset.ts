/**
 * Wipes the LOCAL development database, re-applies every migration and runs the seed.
 * Refuses to run when any configured connection string points at a non-local host.
 */
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ quiet: true });

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
if (urls.length === 0 || !process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

for (const url of urls) {
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname) || process.env.NODE_ENV === 'production') {
    console.error(`Refusing to reset a non-local database (host: ${hostname}).`);
    process.exit(1);
  }
}

const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    // Prisma prefers DIRECT_URL; both were verified local above, keep behaviour explicit.
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force']);
run('pnpm', ['exec', 'tsx', '--import', './scripts/stub-server-only.mjs', 'prisma/seed.ts']);
