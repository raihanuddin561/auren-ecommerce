# Key and secret rotation

Rotate on a schedule (at least yearly), when a person with access leaves, and immediately after any suspected exposure. All values live in Vercel project settings (Production and Preview scopes), never in the repository. After any rotation, redeploy and run the checks at the end.

| Secret | Where it is used | Rotation effect |
|---|---|---|
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_SECRETS` | session cookie signing and step-up cookies (current secret), encryption of TOTP secrets, backup codes and OAuth tokens (versioned) | New signing key signs every user out (verified in the installed Better Auth: cookies are signed with the first, current secret only). Encrypted data stays readable through the versioned list. |
| `INNGEST_SIGNING_KEY` (+ `_FALLBACK`) | verifies requests Inngest sends to `/api/inngest` | None when the fallback is used correctly |
| `INNGEST_EVENT_KEY` | sends events to Inngest | None |
| Database passwords (`auren_app`, `auren_migrator`) | runtime and migrations | Connections drop and reconnect |
| `UPSTASH_REDIS_REST_TOKEN` | rate limits | Briefly fails closed for auth limits |
| `RESEND_API_KEY` | transactional email | None |
| `BLOB_READ_WRITE_TOKEN` | media uploads to Vercel Blob (ADR-026) | None; create the new token in the Vercel dashboard, deploy, delete the old one |
| `TURNSTILE_SECRET_KEY` | bot check on sign-in and checkout | Rotate in the Cloudflare dashboard; forms fail closed until deployed, so swap in one deploy |
| `HEALTH_DETAIL_TOKEN` | detailed `/api/health` for the monitor | Update the monitor header at the same time |
| `SENTRY_AUTH_TOKEN` | source map upload in CI | None |
| `GOOGLE_CLIENT_SECRET` | customer social sign-in | None |

## Better Auth secret (sessions and encrypted data)

1. Generate a new secret: `openssl rand -base64 32`.
2. Set `BETTER_AUTH_SECRETS=2:<new secret>,1:<current secret>` (versions count up; newest first). Keep `BETTER_AUTH_SECRET` as the old value: it is only the legacy fallback for data encrypted before versioned secrets.
3. Deploy. The new secret now signs cookies and encrypts new data; data encrypted with version 1 still decrypts. Everyone is signed out once and staff sign in again (this is also the right response to a suspected leak).
4. Once nothing depends on version 1 (after 30 days, the longest customer session), set `BETTER_AUTH_SECRET` to the new value and `BETTER_AUTH_SECRETS=2:<new secret>`. Keep the previous value only in the secret manager, not in the environment.
5. If the old secret leaked together with a database copy, treat stored TOTP secrets and OAuth tokens as exposed: have staff re-enrol two-factor and revoke the Google client secret.

The boot guards refuse weak, placeholder or low-entropy values in production, and refuse a malformed `BETTER_AUTH_SECRETS`.

## Inngest signing key

1. In the Inngest dashboard create a new signing key; do not delete the old one yet.
2. Set `INNGEST_SIGNING_KEY_FALLBACK=<old key>` and `INNGEST_SIGNING_KEY=<new key>`; deploy. Requests signed with either key are accepted (the library tries the fallback when the first key fails).
3. Confirm functions still run (cron dispatcher heartbeat), then remove the old key in the dashboard and clear `INNGEST_SIGNING_KEY_FALLBACK`.

The event key is rotated by creating a new key, updating `INNGEST_EVENT_KEY`, deploying, then deleting the old key.

## Database passwords

Follow `docs/runbooks/database-roles.md` (step 3): set the new password with `pnpm db:roles` or the provider console, update `DATABASE_URL` / `DIRECT_URL` in Vercel, redeploy. Rotate `auren_app` first; the migrator only matters for deployments.

## Everything else

Create the new credential at the provider, update the Vercel variable, redeploy, verify, then revoke the old credential. For Upstash, rate limits restart empty; auth limiters refuse requests while Redis is unreachable, so do the swap in one deploy.

## Checks after a rotation

- `/api/health` returns `ok`.
- A staff sign-in with password and TOTP works; `/admin` loads.
- A test order email and a password-reset email arrive.
- The Inngest dashboard shows the dispatcher running without signature errors.
- Sentry still receives events.
