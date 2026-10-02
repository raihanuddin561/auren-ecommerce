# Changelog

All notable changes to AUREN. Newest first. This file is written from `context/progress-tracker.md`; commits have not been made yet.

## Unreleased: Design system and brand UI

### New

- **Design tokens and type.** The AUREN palette (ink, ivory, paper, warm stone, gold, oxblood), fluid type scale, sharp 0 to 2 px corners, one soft shadow and calm motion, with every text colour pair checked against WCAG AA. Cormorant Garamond and Manrope are self-hosted with no layout shift.
- **Component library.** Buttons, form controls, dialogs, drawers, menus, tabs, accordions, toasts, skeletons, badges, breadcrumbs, price, rating, pagination and empty states, each with loading, empty, error, disabled and focus states and keyboard support.
- **Motion.** Reveal on scroll, image hover and swap, drawer transitions and a view-transition helper, all reduced to instant changes for visitors who prefer reduced motion.
- **Storefront shell.** Announcement bar, header that turns solid on scroll, mega menu, full-screen mobile menu, footer with newsletter form, and a WhatsApp concierge button.
- **Admin shell.** Sidebar that follows each person's permissions, a top bar with a command palette (Ctrl or Cmd + K), light and dark themes, a sortable and exportable data table, KPI cards and form sections.
- **Style guide.** `/admin/style-guide` (staff only) shows every component and state in light and dark and backs the visual snapshots.
- **System pages.** An editorial 404, calm error pages, and a maintenance page served with a 503 when `MAINTENANCE_MODE=1`. Staff sign-in, health checks, webhooks and background jobs keep working during maintenance.

### Decisions worth knowing

- The admin data table is a small in-house component rather than TanStack Table v9 (ADR-019).
- A permissionless test identity lets browser tests render admin screens without a database. It refuses to start anywhere but a local test run (ADR-020).
- Nothing in this release confirms or cancels an order; copy states that people verify every order.

### Known limitations

- The real sign-in checks for the console shell and style guide are written but have not run (they need Docker and PostgreSQL).
- Visual baselines were generated on Windows. Regenerate them on the CI platform before enabling them there.
- The landing page is a placeholder hero; the newsletter form validates but does not subscribe yet; footer social links wait for the owner's profiles.

## Unreleased: Foundation and platform

### New

- **Project base.** Next.js 16 with the App Router, TypeScript strict mode, Tailwind v4, pnpm, and the planned `src/` layout.
- **Quality gates.** Linting that enforces the module layering rules, Prettier, pre-commit checks, and Conventional Commit enforcement (commit subjects may not mention module numbers).
- **Configuration.** One validated place for environment settings. A missing database URL or auth secret stops `dev` and `build` with a readable list. External services (Google sign-in, Resend, Upstash, Inngest, Sentry, Cloudinary) are optional and fall back to local behaviour.
- **Local infrastructure and database.** Docker Compose with PostgreSQL 16 and Mailpit, Prisma 7 with time-ordered ids, versioned migrations, and a development seed: owner account, 6 categories, 40 menswear products with 390 colour and size variants, images, one warehouse and opening stock.
- **Money.** All amounts are whole minor units (poisha) handled in one tested module: addition, percentages, banker's rounding, exact splitting of discounts across order lines, and display formatting.
- **Accounts.** Email and password sign-in with verified email, password reset, optional Google sign-in for customers, and rate limiting on every auth route.
- **Staff access.** Roles and permissions (including the order verifier role and the `orders.verify` permission), a gated `/admin`, mandatory two-factor authentication for staff, and `pnpm owner:create` for first-time setup.
- **Reliable background work.** Events are saved with the change that caused them and delivered to Inngest with retries. Handlers can safely receive the same event twice.
- **Audit trail.** Every admin change records who, what, before and after. The trail cannot be edited or deleted.
- **Observability.** Sentry for browser, server and edge with personal data removed, and a `/api/health` endpoint for uptime monitoring.
- **Security headers.** Content-Security-Policy, HSTS, frame and content-type protections on every response.
- **Tests and CI.** Unit, integration (real PostgreSQL), end-to-end and accessibility tests on desktop and mobile, and a GitHub Actions pipeline with weekly dependency updates.

### Decisions worth knowing

- Every order must be verified by staff before it can be confirmed, and the system never cancels an order by itself. Nothing in this release can do either.
- The Content-Security-Policy does not use per-request nonces, because Next.js cannot combine them with the fast prerendered pages the shop depends on (ADR-016).
- Social sign-in is customer-only and never linked to an existing account or to staff (ADR-017).

### Known limitations

- Docker-based checks (compose startup, Testcontainers, database-backed end-to-end specs, `pnpm db:reset`) have not been run on a machine with Docker yet.
- GitHub branch protection (required checks on `main`) has to be applied by the owner; the command is in `docs/runbooks/ci-and-branch-protection.md`.
