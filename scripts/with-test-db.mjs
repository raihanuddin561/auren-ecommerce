#!/usr/bin/env node
/**
 * Runs a command with TEST_DATABASE_URL / TEST_APP_DATABASE_URL pointed at another local test database,
 * so two people (or agents) can run integration tests at the same time without truncating each
 * other's tables.   node scripts/with-test-db.mjs auren_test2 pnpm test:integration
 * The name must contain "test" (the integration setup enforces it as well). Secrets are never printed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [name, ...command] = process.argv.slice(2);
if (!name || !/test/.test(name) || command.length === 0) {
  console.error(
    'usage: node scripts/with-test-db.mjs <database-name-containing-test> <command...>',
  );
  process.exit(2);
}
const env = { ...process.env };
try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(TEST_DATABASE_URL|TEST_APP_DATABASE_URL)\s*=\s*(.*)$/);
    if (m && m[1] && m[2] && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* .env.local is optional */
}
for (const key of ['TEST_DATABASE_URL', 'TEST_APP_DATABASE_URL']) {
  if (!env[key]) continue;
  const url = new URL(env[key]);
  url.pathname = `/${name}`;
  env[key] = url.toString();
}
const result = spawnSync(command[0], command.slice(1), { env, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
