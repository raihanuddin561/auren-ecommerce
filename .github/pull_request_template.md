## What and why

<!-- One or two sentences. Link the sub-feature ID from context/feature-list.md. -->

## Definition of done

- [ ] Acceptance criteria met (list evidence)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` green
- [ ] E2E and accessibility checks for user-visible flows
- [ ] Zod validation plus server-side authn/authz on every new action or handler
- [ ] Admin mutations call `audit()`; side effects go through the outbox
- [ ] Orders are still staff-verified before confirmation and never auto-cancelled
- [ ] `.env.example`, `DATA-MODEL.md`, `DECISIONS.md` updated where affected
- [ ] `context/feature-progress.md` and `context/progress-tracker.md` updated
