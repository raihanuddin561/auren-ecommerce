# AUREN — Progress Tracker (rolling log)

> Append newest entries at the **top**. One entry per sub-feature milestone (started, done, blocked) and per decision.
> Status table: [feature-progress.md](./feature-progress.md)

## Entry template

```
### YYYY-MM-DD — <ID> <sub-feature> — <Started | Done | Blocked>
- Type: new | enhancement | fix
- Changed: <files / modules touched>
- Tests: <unit x/x, integration x/x, e2e x/x, axe ok>
- Review: <code review result, issues fixed>
- Decisions: <ADR id or "none">
- Next: <next sub-feature ID>
- Blockers/risks: <none | details>
```

---

### 2026-10-01 — Implementation readiness: skills, agents, tooling — Done
- Type: enhancement
- Changed: removed auto-cancel everywhere (owner decision; INV-O2); added skills `auren-brand`, `auren-nextjs-patterns`, `auren-module-scaffold`, `auren-db-change`, `auren-commerce-invariants`, `auren-testing`, `auren-definition-of-done`; rewrote `module-feature-completer` for this stack (fixed `context/` paths, removed Java/surefire steps, replaced Anthropic `brand-guidelines` with `auren-brand`); added agents `commerce-invariants-reviewer`, `premium-ui-qa`; fixed `find-bugs` base branch (`main`); fenced off `brand-guidelines`; fixed YAML in `architect-review.md`; added `.claude/settings.json` allowlist; installed pnpm 12.8.1
- Tests: all 76 skill/agent frontmatters YAML-validated
- Decisions: OD-11 updated (no auto-cancel)
- Next: 0.1 Project scaffold
- Blockers/risks: no Docker/PostgreSQL locally (affects 0.4, 0.11); payment and courier merchant accounts still to apply for

### 2026-10-01 — Requirement change: mandatory staff order verification — Done (planning)
- Type: enhancement (requirement from business owner)
- Changed: ARCHITECTURE §3.2 events, §5 orders, §6 state machine, new §6.1, §11 roles · DATA-MODEL orders fields, `order_verification_attempts`, `customer_risk_flags`, roles · DESIGN §4.7 copy, §4.11 verification queue screen · DECISIONS ADR-015, OD-11 · feature-list 0.8, 4.7, 6.1–6.5, **new 6.13–6.15**, 13.2, 13.3, 13.7, 15.1, **new 15.7**
- Decisions: ADR-015 (supersedes auto-confirm of prepaid orders); bulk confirm removed from order list
- Next: unchanged; confirm OD-1 … OD-11, then start 0.1
- Blockers/risks: verification needs staff coverage during business hours; SLA defaults pending OD-11

### 2026-10-01 — Architecture baseline — Done
- Type: new
- Changed: `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA-MODEL.md`, `docs/architecture/DECISIONS.md`, `docs/design/DESIGN-SYSTEM.md`, `context/feature-list.md`, `context/feature-progress.md`, `CLAUDE.md`
- Tests: n/a (planning)
- Decisions: ADR-001 … ADR-014 accepted; OD-1 … OD-10 open with defaults
- Next: confirm open decisions OD-1 … OD-10, then start **Module 0, sub-feature 0.1 (Project scaffold)**
- Blockers/risks: Payment gateway (SSLCommerz) and courier (Pathao/Steadfast) merchant accounts need business registration lead time. **Start applications now.**
