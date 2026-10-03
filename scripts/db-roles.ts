/**
 * Gives the database roles a login.
 *
 *   pnpm db:roles
 *
 * Connects with ROLES_ADMIN_URL (or DIRECT_URL) as a role allowed to run ALTER ROLE (a superuser
 * or a role with CREATEROLE) and sets the password of `auren_app` to the one found in DATABASE_URL.
 * Set AUREN_MIGRATOR_PASSWORD to also give `auren_migrator` a login.
 * The migration creates both roles without a login so no secret ever sits in the repository.
 * See docs/runbooks/database-roles.md.
 *
 * Note: the password travels in an ALTER ROLE statement. Do not run this against a server that
 * logs every statement (log_statement = 'all'); use the provider console on such hosts.
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env.local', '.env'], quiet: true });

const APP_ROLE = 'auren_app';
const MIGRATOR_ROLE = 'auren_migrator';
const MIN_PASSWORD_LENGTH = 8;

class UsageError extends Error {}

function credentials(url: string, name: string): { user: string; password: string } {
  try {
    const parsed = new URL(url);
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  } catch {
    // Never echo the value: it contains a password.
    throw new UsageError(`${name} is not a valid connection URL.`);
  }
}

async function main(): Promise<void> {
  const appUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.ROLES_ADMIN_URL || process.env.DIRECT_URL;
  if (!appUrl) throw new UsageError('DATABASE_URL (the auren_app connection) is not set.');
  if (!adminUrl) {
    throw new UsageError(
      'Set DIRECT_URL (or ROLES_ADMIN_URL) to a role that may run ALTER ROLE, not the application role.',
    );
  }

  const app = credentials(appUrl, 'DATABASE_URL');
  if (app.user !== APP_ROLE) {
    throw new UsageError(`DATABASE_URL must connect as ${APP_ROLE} (found "${app.user}").`);
  }
  if (app.password.length < MIN_PASSWORD_LENGTH) {
    throw new UsageError(
      `The password in DATABASE_URL must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  if (credentials(adminUrl, 'DIRECT_URL').user === APP_ROLE) {
    throw new UsageError('The admin connection must not be the application role.');
  }

  const migratorPassword = process.env.AUREN_MIGRATOR_PASSWORD;
  if (migratorPassword !== undefined && migratorPassword.length < MIN_PASSWORD_LENGTH) {
    throw new UsageError(
      `AUREN_MIGRATOR_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ rolname: string }>(
      'SELECT rolname FROM pg_roles WHERE rolname = ANY($1)',
      [[APP_ROLE, MIGRATOR_ROLE]],
    );
    const existing = new Set(rows.map((row) => row.rolname));
    if (!existing.has(APP_ROLE)) {
      throw new UsageError(`Role ${APP_ROLE} does not exist. Run the migrations first.`);
    }
    await client.query(
      `ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD ${client.escapeLiteral(app.password)}`,
    );
    console.log(`${APP_ROLE} can now log in.`);

    if (migratorPassword !== undefined) {
      if (!existing.has(MIGRATOR_ROLE)) {
        throw new UsageError(`Role ${MIGRATOR_ROLE} does not exist. Run the migrations first.`);
      }
      await client.query(
        `ALTER ROLE ${MIGRATOR_ROLE} WITH LOGIN PASSWORD ${client.escapeLiteral(migratorPassword)}`,
      );
      console.log(`${MIGRATOR_ROLE} can now log in.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // Only our own messages are printed; driver errors may quote connection details.
  const code = (error as { code?: unknown }).code;
  console.error(
    error instanceof UsageError
      ? error.message
      : `db:roles failed${typeof code === 'string' ? ` (database error ${code})` : ''}; see the runbook.`,
  );
  process.exitCode = 1;
});
