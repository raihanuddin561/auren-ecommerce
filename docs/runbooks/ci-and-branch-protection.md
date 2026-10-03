# CI and branch protection

The pipeline lives in `.github/workflows/ci.yml` and runs on every pull request and on pushes to `main`.

| Job (check name) | What it proves |
|---|---|
| `typecheck, lint, unit` | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage` (money utilities must stay at 100 %) |
| `integration (PostgreSQL)` | `pnpm test:integration` against a Testcontainers `postgres:16` |
| `production build` | `pnpm build` with environment validation on; uploads Sentry source maps when the secrets exist |
| `end-to-end and accessibility` | Playwright desktop + mobile with axe, against a migrated Postgres service container (`E2E_WITH_DB=1`) |
| `dependency audit` | `pnpm audit --prod --audit-level high` (informational, not a required check: a new advisory should alert without blocking unrelated work) |
| `conventional commits` | commitlint over the commits of the pull request (pull requests only) |

`e2e-preview.yml` additionally smoke tests every Vercel preview deployment with the database-free specs.

## Required checks on `main` (owner action)

Branch protection is a repository setting, so it cannot live in the code. Apply it once with the GitHub CLI
(`gh auth login` first), from any machine:

```bash
gh api -X PUT repos/raihanuddin561/auren-ecommerce/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "typecheck, lint, unit",
      "integration (PostgreSQL)",
      "production build",
      "end-to-end and accessibility",
      "conventional commits"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Or in the GitHub UI: Settings, Branches, add a rule for `main`, tick "Require status checks to pass" and add the five
check names above, plus "Require a pull request before merging". Check names appear in the list only after each job has
run once.

## GitHub and Vercel settings the pipeline expects

- Secret `VERCEL_AUTOMATION_BYPASS_SECRET` if Vercel Deployment Protection is on for previews (the preview smoke test sends it as `x-vercel-protection-bypass`).
- Repository variables `SENTRY_ORG` and `SENTRY_PROJECT`, and secret `SENTRY_AUTH_TOKEN` (optional; without them the build skips source map upload).
- Vercel project linked to the repository so previews deploy; the `e2e-preview` workflow reacts to its `deployment_status` events.
- Vercel environment variables mirror `.env.example` (production values are never stored in the repository).
- Dependabot opens grouped weekly updates; pnpm's `minimumReleaseAge` policy rejects packages newer than one day, so a fresh release may be skipped until it ages.

## Supply-chain controls (owner actions)

The workflows are hardened in code (actions pinned to commit SHAs with the version in a comment, `persist-credentials: false`, least-privilege `permissions`, digest-pinned images, `minimumReleaseAge: 2880` in `pnpm-workspace.yaml`, CODEOWNERS, Dependabot for npm, Actions and docker-compose with a 3-day cooldown). These settings live in GitHub and cannot be committed:

1. **Ruleset or branch protection on `main`:** require pull requests, **Require review from Code Owners**, and the status checks `typecheck, lint, unit`, `integration (PostgreSQL)`, `production build`, `end-to-end and accessibility`, `conventional commits`, `analyze` (CodeQL), `dependency review` and `audit` (workflow `dependency-audit`, which also runs daily). With a single owner GitHub does not let an author approve their own pull request: either add a second reviewer, or allow the owner to bypass the review requirement while keeping the status checks mandatory.
2. **Repository settings, Code security:** enable the dependency graph, Dependabot alerts and security updates, **secret scanning and push protection**, and CodeQL default setup off (the workflow is used instead).
3. **Environment `preview-smoke`:** create it under Settings, Environments, restrict deployment branches to `main`, and put `VERCEL_AUTOMATION_BYPASS_SECRET` there (if Vercel Deployment Protection is on for previews). Previews of other branches then run the smoke test without the secret.
4. **Actions settings:** default workflow permissions "Read repository contents", and "Require approval for all outside collaborators".
5. When Dependabot proposes an Action update, check that the new SHA belongs to the tagged release in the upstream repository before merging.
