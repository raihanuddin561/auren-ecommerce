# Incident response

For a suspected breach, a leaked secret, a fraud wave or an outage caused by an attack. Keep notes with timestamps as you go; the audit log (`audit_logs`) and Vercel, Supabase, Upstash, Inngest and Sentry logs are the evidence.

## 0. First 15 minutes

1. **Name an incident lead** (the owner unless delegated) and start a private timeline document.
2. **Contain, do not delete.** Preserve logs and database state; do not run cleanup scripts.
3. Decide the blast radius with the table below and take the matching containment step.

| Signal | Likely cause | Containment |
|---|---|---|
| Unknown staff sign-ins, audit entries `staff.step_up_failed`, many `staff.step_up_blocked` | Stolen password or session | Deactivate the staff member (`staff_members.active = false` takes effect on the next request); "Sign out of every device" for the account; reset the password; rotate `BETTER_AUTH_SECRET` if more than one account is involved (signs everyone out) |
| Orders confirmed that nobody verified | Application bug or injected SQL | The database refuses `confirmed` without `confirmed_by` (INV-O9); if rows exist, treat the database role as compromised and rotate it (below) |
| Spike of fake orders or OTP abuse | Bot traffic | Set `MAINTENANCE_MODE=1` only if needed (orders are never cancelled by it); enable Turnstile keys; tighten limits; add phone numbers to the blocklist |
| Secret in a public place (git history, log, screenshot) | Leak | Rotate it now, then investigate: `docs/runbooks/key-rotation.md` |
| Customer data exposed | Breach | Follow section 3 (notification), then 4 |
| Sign-in locked for the owner | Someone is guessing the account (delays up to 15 minutes) | Wait for the delay or use the password-reset email; reset is not blocked. Check Upstash keys `auren:af:login:*` only if you must clear it |

### Security alerts and approvals

- `security.alert` emails come from the five-minute audit scan (rules in `src/modules/audit/alerts.ts`). Each names a rule, an actor id and the audit entry id: look the entry up in `audit_logs`. A "digest" alert means more alerts than could be listed: query `audit_logs` directly for the period.
- `role_permission.*` and `staff_member.*` audit rows are written by database triggers. If one appears and no reviewed migration or staff change explains it, treat the database credentials as compromised.
- Large refunds and adjustments wait in `approval_requests` (status pending) for a second person with `approvals.decide`; an approval lasts 7 days and is used once. The thresholds live in `store_settings` (`approvals.thresholds`) and are capped in code.
- If `PRIVILEGED_IP_ALLOWLIST` locks the owner out (new office or VPN address): change the environment variable in Vercel and redeploy; owner and finance accounts see a 404 until then. A malformed value stops the deploy.

## 1. Rotate credentials

Use `docs/runbooks/key-rotation.md`. Database passwords: `docs/runbooks/database-roles.md`. After rotating, redeploy and run the post-rotation checks. Revoke the old credential at the provider; do not just stop using it.

## 2. Investigate

- **Who did what:** `SELECT * FROM audit_logs WHERE created_at > '<since>' ORDER BY created_at` (actor, action, entity, ip, user agent). Staff events: `staff.step_up`, `staff.step_up_failed`, `staff.step_up_blocked`, `staff.sessions_revoked`.
- **Orders** (once the order modules exist): `order_events` and `order_verification_attempts` show every transition and the staff member behind it.
- **Edge and application logs:** Vercel logs (client address, path), Sentry (scrubbed errors), Inngest (job runs).
- **Database:** the application role cannot change schema or ledgers (ADR-021); anything that did was done with the migrator or provider credentials: check Supabase's audit/connection history for those roles.
- **Dependencies:** GitHub security alerts, `pnpm audit --prod`, the last CI runs and merged pull requests.

## 3. Notify

- Customers and regulators as the law requires. Take legal advice on the data protection and cyber security rules that apply in your jurisdiction for anything involving personal data.
- Payment providers (SSLCommerz, bKash, Nagad, Stripe) if payment credentials or webhooks were abused.
- Keep the wording factual: what happened, which data, what you did, what customers should do (for example change reused passwords).

## 4. Recover and learn

1. Restore from Supabase point-in-time recovery only if data was corrupted; never to hide evidence.
2. Re-enable normal operation, confirm with the checks in the key-rotation runbook.
3. Write a short post-incident note: timeline, root cause, what detected it, what fixes follow. Add tests for the failure; add an ADR if a design decision changes.

## Known trade-offs to remember during an incident

- A burst of wrong passwords delays that account (max 15 minutes) for every address. It protects the account but also lets an attacker annoy the owner; password reset still works.
- When Redis is down, credential limiters refuse sign-ins on purpose (fail closed). Restore Upstash first; do not weaken the limiter.
- With `TRUSTED_PROXY=hops:N` the origin must only be reachable through the proxy; a direct connection could forge the client address.
- The first request after a deploy to a per-request-rendered page (admin) is slow while the server bundle loads.
