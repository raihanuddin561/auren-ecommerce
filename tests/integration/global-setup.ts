import { spawnSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
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
  if (!LOCAL_HOSTS.has(parsed.hostname) && !/test/i.test(parsed.hostname)) {
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

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  let container: StartedPostgreSqlContainer | undefined;
  let databaseUrl: string;

  if (external) {
    assertSafeTestDatabase(external);
    databaseUrl = external;
  } else {
    try {
      container = await new PostgreSqlContainer('postgres:16-alpine')
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

  return async () => {
    await container?.stop();
  };
}
