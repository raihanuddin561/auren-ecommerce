import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    /** Login as the least-privilege runtime role; only set when the harness owns a real server. */
    appDatabaseUrl: string | null;
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Integration tests wipe tables. Refuse any database that is not obviously a throwaway one. */
export function assertSafeTestDatabase(url: string): void {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run integration tests against "${name}" on ${parsed.hostname}: ` +
        'the database name must contain "test".',
    );
  }
  if (!LOCAL_HOSTS.has(parsed.hostname) && !/(^|[.-])test([.-]|$)/i.test(parsed.hostname)) {
    throw new Error(`Refusing to wipe a remote database (${parsed.hostname}).`);
  }
}

function migrate(databaseUrl: string): void {
  const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: '' },
  });
  if (result.status !== 0) throw new Error('prisma migrate deploy failed for the test database');
}

/**
 * Gives the runtime role a login on the throwaway container, so tests can connect exactly like the
 * running application does (a real connection, not SET ROLE).
 */
async function enableAppLogin(adminUrl: string): Promise<string> {
  const password = 'auren_app_test';
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`ALTER ROLE auren_app WITH LOGIN PASSWORD '${password}'`);
  } finally {
    await client.end();
  }
  const url = new URL(adminUrl);
  url.username = 'auren_app';
  url.password = password;
  return url.toString();
}

/**
 * Against your own PostgreSQL the harness cannot create the app login, so the real-login checks
 * (sub-feature database least privilege) run only when TEST_APP_DATABASE_URL is set: the same
 * throwaway database as TEST_DATABASE_URL, connecting as auren_app.
 */
function externalAppUrl(): string | null {
  const url = process.env.TEST_APP_DATABASE_URL;
  if (!url) return null;
  assertSafeTestDatabase(url);
  if (new URL(url).username !== 'auren_app') {
    throw new Error('TEST_APP_DATABASE_URL must connect as the auren_app role.');
  }
  return url;
}

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  let container: StartedPostgreSqlContainer | undefined;
  let databaseUrl: string;

  if (external) {
    assertSafeTestDatabase(external);
    databaseUrl = external;
  } else {
    try {
      container = await new PostgreSqlContainer(
        'postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea',
      )
        .withDatabase('auren_test')
        .withUsername('auren')
        .withPassword('auren')
        .start();
    } catch (error) {
      throw new Error(
        'Integration tests need a PostgreSQL. Install and start Docker Desktop (Testcontainers ' +
          'starts the database for you), or set TEST_DATABASE_URL to a throwaway database whose ' +
          `name contains "test".\nUnderlying error: ${(error as Error).message}`,
      );
    }
    databaseUrl = container.getConnectionUri();
  }

  migrate(databaseUrl);
  project.provide('databaseUrl', databaseUrl);
  project.provide(
    'appDatabaseUrl',
    container ? await enableAppLogin(databaseUrl) : externalAppUrl(),
  );

  return async () => {
    await container?.stop();
  };
}
