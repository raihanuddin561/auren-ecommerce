---
name: auren-definition-of-done
description: "The gate a sub-feature must pass before it is marked Done in AUREN, plus the exact protocol for updating context/feature-progress.md and context/progress-tracker.md. Use at the end of every sub-feature, and whenever updating progress files."
---

# AUREN Definition of Done and Progress Protocol

## Gate (all applicable items must be true)
1. **Matches the contract:** every acceptance criterion in `context/feature-list.md` for the ID is met. List each criterion with evidence (file or test).
2. **Quality:** `pnpm typecheck`, `pnpm lint` clean, with no new `any`, `@ts-ignore` or eslint-disable without a comment explaining why.
3. **Tests:** unit + integration + E2E per `auren-testing` are green; counts recorded.
4. **Invariants:** relevant `INV-*` from `auren-commerce-invariants` covered by tests.
5. **Security:** Zod + authn/authz on every new action and handler; audit on admin mutations; rate limits where listed.
6. **UI (if any):** `auren-brand` premium checklist passed; loading, empty and error states present; axe clean; mobile and desktop verified; reviewed by the `premium-ui-qa` agent for storefront pages.
7. **SEO (public pages):** metadata, canonical, JSON-LD, sitemap inclusion.
8. **Docs:** DATA-MODEL.md, ARCHITECTURE.md and DECISIONS.md updated if the change affects them; `.env.example` updated for new env vars.
9. **Review:** code review done (the `code-reviewer` agent or `/code-review`), plus the `commerce-invariants-reviewer` agent for commerce/finance areas. High and medium findings fixed and retested.

## Updating `context/feature-progress.md`
- Find the row by ID. Update stage columns as they truly complete: `Todo → WIP → Done`, `N/A` when the stage doesn't apply (e.g. FE for a pure backend utility), `Blocked` with a reason in Notes.
- **Overall = Done** only when every non-N/A stage is Done.
- Notes: `new` / `enhancement` / `fix` classification, short evidence, and blockers. Never delete a `HOLD` marker yourself.
- After changing statuses, update the **Summary** table's Done counts.

## Appending to `context/progress-tracker.md`
Insert a new entry **at the top** (below the template), using the template in that file:
```
### YYYY-MM-DD — <ID> <name> — Done
- Type: new | enhancement | fix
- Changed: <key files>
- Tests: unit a/a · integration b/b · e2e c/c · axe ok
- Review: <findings fixed>
- Decisions: <ADR or none>
- Next: <next ID>
- Blockers/risks: <none | …>
```
Also log `Started` and `Blocked` milestones for anything that takes more than one session.

## Commits
One sub-feature per PR or commit series. Conventional Commits with a scope from the area (`feat(orders): add verification queue`). Never mention module numbers in commit subjects.
