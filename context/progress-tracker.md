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

### 2026-10-10 — 11.1–11.4, 11.7–11.10, 11.13 Finance and Cost Tracking — Done
- Type: new and enhancement
- Scope: Implemented end-to-end atelier finance tracking, cost center categorization, operational expense recording with audit logging, recurring commitments scheduling, marketing campaign ROI & ROAS tracking, product margin contribution matrix, and comprehensive executive Profit & Loss statement with Delivered vs Placed revenue recognition modes.
- Changed:
  - Database & Migrations:
    - `prisma/migrations/20261010100000_add_finance_expenses_and_campaigns/migration.sql`: Created tables `expense_categories`, `marketing_campaigns`, `recurring_expenses`, `expenses`, `daily_financial_summaries`, seeded 12 default atelier cost centers, applied RLS with `public.auren_secure_table()`.
    - `prisma/schema.prisma`: Added models `ExpenseCategory`, `MarketingCampaign`, `RecurringExpense`, `Expense`, `DailyFinancialSummary` with relations to `StaffMember`, `OrderCostLine`.
  - Finance Module Core (`src/modules/finance/`):
    - `types.ts`: Defined `ExpenseCategoryItem`, `MarketingCampaignItem`, `RecurringExpenseItem`, `ExpenseListItem`, `ExpenseFilterParams`, `ProfitAndLossReport`, `ProductProfitabilityRow`, `FinanceOverviewMetrics`.
    - `schemas.ts`: Strict Zod validation schemas with positive BigInt money, date formatting, and enum constraints.
    - `repository.ts`: Database queries and aggregations for expenses, recurring OpEx, marketing spend & ROAS, raw SQL daily rollups, and product profitability matrix.
    - `service.ts`: Business logic, transactional audit logging for expense creation/modification, and CSV generators for expenses log and P&L statements.
    - `queries.ts`: Server queries `getFinanceOverview`, `getProfitAndLossReport`, `listExpenses`, `listExpenseCategories`, `listMarketingCampaigns`, `listRecurringExpenses`, `getProductProfitability` guarded by `finance.read`.
    - `actions.ts`: Server Actions for CRUD operations and CSV exports guarded by `finance.write` using `ok`, `fail`, `validationError`, and `toActionError`.
    - `__tests__/finance-schemas.test.ts`: Unit tests validating all finance input schemas and enum validations.
  - Admin Finance Console UI (`src/components/admin/finance/`):
    - `finance-nav.tsx`: Sub-navigation tabs with active path highlighting across P&L, Expenses, Categories, Campaigns, Recurring, and Profitability.
    - `finance-overview-strip.tsx`: 4-metric executive KPI bar with Net Sales, Gross Profit, Total OpEx, and Net Operating Income.
    - `pnl-view.tsx`: Financial statement table with quick period selectors (Today, 7D, MTD, Last Month), Delivered (Accrual) vs Placed (Pipeline) toggle, and CSV export.
    - `create-expense-dialog.tsx`: Record Expense modal with category selection, campaign association, and BDT input parsing via `fromDecimalString`.
    - `expenses-table.tsx`: Filterable expense ledger with search, category filtering, delete action, and CSV export.
    - `categories-table.tsx`: Cost center categories table with Direct COGS vs Operating OpEx classification badges.
    - `campaigns-table.tsx`: Marketing campaigns table with budget vs spend, attributed revenue, orders count, and ROAS performance badges.
    - `recurring-table.tsx`: Recurring commitments table with monthly/weekly/yearly cadence, day of period, active/pause toggle, and removal.
    - `product-profitability-table.tsx`: Garment margin matrix ranking catalog pieces by revenue, unit volume, landed COGS, return rate %, and gross margin %.
  - Admin App Routes & Navigation:
    - `src/app/admin/(console)/finance/layout.tsx`: Layout guarded by `requireStaffWith('finance.read')`.
    - `src/app/admin/(console)/finance/page.tsx`: Overview & P&L page.
    - `src/app/admin/(console)/finance/expenses/page.tsx`: Expenses log page.
    - `src/app/admin/(console)/finance/categories/page.tsx`: Cost centers page.
    - `src/app/admin/(console)/finance/campaigns/page.tsx`: Marketing campaigns page.
    - `src/app/admin/(console)/finance/recurring/page.tsx`: Recurring commitments page.
    - `src/app/admin/(console)/finance/profitability/page.tsx`: Product profitability page.
    - `src/lib/admin-nav.ts`: Activated Finance (`/admin/finance`) navigation item with `ready: true`.
- Tests: `pnpm typecheck`, `pnpm lint`, `pnpm format`, and Vitest test suites (finance schemas, profit calculation, design tokens) all green (70 tests passing).
- Review: Enforced INV-M1 (no floats, `fromDecimalString` parsing), RBAC permissions (`finance.read`, `finance.write`), semantic design tokens only, zero arbitrary CSS brackets.
- Decisions: ADR-015, ADR-023, ADR-025 preserved.
- Next: Module 8.1 Section-block page builder (P0).
- Blockers/risks: none.

### 2026-10-10 — 15.5, 15.6 Audit Log Viewer & System Health Diagnostics — Done
- Type: new and enhancement
- Scope: Implemented admin audit trail inspector with filtered tabular view, actor joins, pagination, and JSON diff modal. Built real-time system health dashboard probing database round-trip latency, outbox event pipeline queues and poison states, idempotency key locks, and external infrastructure integrations.
- Changed:
  - Audit Log Viewer (15.5):
    - `src/modules/audit/types.ts`: Extended types with `AuditLogListItem`, `AuditLogFilterParams`, and `AuditLogListResult`.
    - `src/modules/audit/repository.ts`: Added `listAuditLogsForAdmin` joining actor staff records with action/entity filtering and cursor pagination.
    - `src/modules/audit/queries.ts`: Added `getAuditLogsForAdmin` query.
    - `src/components/admin/audit/audit-filter-bar.tsx`: Interactive filter controls for actions, entity types, dates, and actor IDs.
    - `src/components/admin/audit/audit-log-table.tsx`: Luxury audit log table with badge styling, actor badges, IP/UA forensic display, and JSON payload inspect dialog.
    - `src/app/admin/(console)/settings/audit/page.tsx`: Dedicated audit trail console page guarded by `audit.read` permission.
    - `src/modules/audit/__tests__/audit-viewer.test.ts`: Unit tests validating audit repository filtering and parameter normalization.
  - System Health Diagnostics (15.6):
    - `src/modules/settings/types.ts`: Defined `SystemHealthData` diagnostics model.
    - `src/modules/settings/queries.ts`: Implemented `getSystemHealthForAdmin` probing Postgres latency, outbox queue metrics (pending/dispatched/failed/oldest), inbox deduplication count, and integrations (Email, Storage, Inngest, Redis, Sentry, Maintenance mode).
    - `src/components/admin/health/health-dashboard.tsx`: Real-time system diagnostics interface with status badges, latency indicators, outbox queue breakdown, and environment status cards.
    - `src/app/admin/(console)/settings/health/page.tsx`: System health dashboard page guarded by `settings.manage` permission.
    - `src/modules/settings/__tests__/system-health.test.ts`: Unit tests validating diagnostic probes and healthy/degraded classification logic.
  - Settings Hub & Navigation:
    - `src/app/admin/(console)/settings/page.tsx`: Added "Audit Log & History" and "System Health & Pipeline" cards.
    - `src/lib/admin-nav.ts`: Enabled Audit Log (`/admin/settings/audit`) and System Health (`/admin/settings/health`) with `ready: true`.
- Tests: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and Vitest suites for audit and settings all passing cleanly.
- Review: Module boundaries respected (components consume shared types), RBAC security enforced, design tokens strictly followed without raw hex colors.
- Decisions: ADR-015, ADR-023, ADR-025 preserved.
- Next: Module 11 (Finance and Cost Tracking) or Module 8.1 (Section-block page builder).
- Blockers/risks: none.

### 2026-10-10 — 14.1, 14.2, 14.3, 14.4, 14.6 SEO, Rich Structured Data & Dynamic OG Images — Done
- Type: new and enhancement
- Scope: Implemented comprehensive SEO metadata framework, rich schema.org structured data (Organization, WebSite + SearchAction, MerchantReturnPolicy, OfferShippingDetails, FAQPage, Article), complete sitemap with image metadata, faceted navigation crawler protection rules, and dynamic luxury Open Graph card generation.
- Changed:
  - Metadata Framework (14.1):
    - `src/lib/seo/metadata.ts`: Created `buildPageMetadata` and `sanitizeTitle` helpers ensuring clean canonical URLs, title templates, and Open Graph defaults without duplicated brand suffixes.
    - `src/lib/seo/__tests__/metadata.test.ts`: Unit tests validating title sanitization and Open Graph metadata generation.
  - Structured Data (14.2):
    - `src/lib/seo/jsonld.ts`: Added `organizationJsonLd`, `websiteJsonLd`, `merchantReturnPolicyNode` (7-day doorstep exchange in BD), `offerShippingDetailsNodes` (Dhaka ৳80 & Nationwide ৳150 delivery rates), `faqPageJsonLd`, and `articleJsonLd`.
    - `src/app/(storefront)/layout.tsx`: Injected `Organization` and `WebSite` JSON-LD globally for brand panel and Google Sitelinks Searchbox eligibility.
    - `src/app/(storefront)/faq/page.tsx`: Embedded `FAQPage` JSON-LD for rich accordion search snippet eligibility.
    - `src/lib/seo/__tests__/jsonld-advanced.test.ts`: 6 unit tests covering advanced JSON-LD schemas.
  - Sitemaps & Robots (14.3):
    - `src/app/sitemap.ts`: Extended sitemap to index all 10 static storefront pages, categories, collections, and live products with high-res photography attachments, priorities, and change frequencies.
  - Faceted Navigation Rules (14.4):
    - `src/lib/seo/faceted.ts`: Implemented `getFacetedRobotsAndCanonical` allowing clean category landings to index while applying `noindex, follow` and canonical root references to faceted filter combinations, pagination (> 1), and internal search queries.
    - `src/lib/seo/__tests__/faceted.test.ts`: 4 unit tests covering faceted navigation crawling rules.
  - Dynamic Open Graph Images (14.6):
    - `src/lib/seo/og-theme.ts`: Created luxury color tokens for Satori rendering without violating CSS design token guards.
    - `src/app/(storefront)/opengraph-image.tsx`: Root luxury Open Graph card with gold crest and Cormorant Garamond typography.
    - `src/app/(storefront)/products/[slug]/opengraph-image.tsx`: Dynamic product Open Graph card rendering product title, fabric, live price, and atelier branding.
    - `src/app/(storefront)/collections/[slug]/opengraph-image.tsx`: Dynamic collection capsule Open Graph card.
- Tests: `pnpm check` passed cleanly (0 typecheck errors, 0 lint errors, 100% Prettier formatting, 105 test files and 1,264 tests passed).
- Review: Design tokens respected without raw hex colors in components, module boundaries preserved, and SSR safety verified.
- Decisions: Architecture section 9 and 10 requirements strictly fulfilled.
- Next: Module 15.5/15.6 (Audit Log Viewer & System Health) or Module 11 (Finance & Expenses).
- Blockers/risks: none.

### 2026-10-10 — 15.1, 15.3, 15.4 Store General Settings, Staff Management & Dashboard KPIs — Done
- Type: new and enhancement
- Scope: Implemented store general settings configuration, staff directory & RBAC management, and advanced executive dashboard KPIs (AOV, overdue verification SLA countdown, RTO % and order cancellation metrics).
- Changed:
  - Store Settings (15.3):
    - `src/modules/settings/schemas.ts`: Strict Zod schema `storeGeneralSettingsSchema` covering store identity, studio address, BD BIN/VAT registration, VAT rates, currency/timezone, and social handles.
    - `src/modules/settings/service.ts`: Implemented `getStoreGeneralSettings` and `saveStoreGeneralSettings` with transactional audit logging (`store_general`).
    - `src/modules/settings/actions.ts`: Server Action `saveStoreGeneralSettingsAction` guarded by `settings.manage` permission.
    - `src/components/admin/settings/general-settings-form.tsx`: Luxury admin settings form with field validation, number handling, and toast feedback.
    - `src/app/admin/(console)/settings/general/page.tsx`: Dedicated admin store configuration page.
    - `src/app/admin/(console)/settings/page.tsx`: Updated hub navigation with direct links to Store Information and Staff Management.
    - `src/modules/settings/__tests__/store-general-settings.test.ts`: Unit tests validating schema rules and boundary conditions.
  - Staff Management (15.4):
    - `src/modules/staff/types.ts` & `schemas.ts`: Defined staff member records, invite input schema, role update schema, and status toggle schema.
    - `src/modules/staff/repository.ts`: Data access layer for listing staff with Better Auth user details, creating new staff with credentials, and atomic status/role updates.
    - `src/modules/staff/service.ts`: Business logic enforcing owner-only role escalation, self-deactivation prevention, owner account protection, password hashing via Better Auth hasher, and transactional audit logging (`staff_member`).
    - `src/modules/staff/actions.ts`: Server Actions `createStaffMemberAction`, `updateStaffRoleAction`, and `toggleStaffStatusAction` guarded by `staff.manage` permission.
    - `src/components/admin/settings/staff/staff-role-badge.tsx`: Curated role badges with semantic tones.
    - `src/components/admin/settings/staff/create-staff-dialog.tsx`: Add staff dialog modal with secure one-time temporary password display and clipboard copy.
    - `src/components/admin/settings/staff/staff-table.tsx`: Management table with role select dropdowns, 2FA status, and activation controls.
    - `src/app/admin/(console)/settings/staff/page.tsx`: Staff directory page guarded by `staff.manage`.
    - `src/lib/admin-nav.ts`: Enabled Staff navigation link in admin sidebar.
    - `src/modules/staff/__tests__/staff-management.test.ts`: Unit tests validating staff schemas and UUID checks.
  - Dashboard KPIs (15.1):
    - `src/modules/orders/queries.ts`: Extended `AdminDashboardOrderStats` and `getAdminDashboardOrderStats` to calculate average order value (AOV), overdue verifications (> 120m), return-to-origin (RTO) rate, and cancellation rate.
    - `src/app/admin/(console)/page.tsx`: Expanded KPI metric strip to 6 responsive cards featuring AOV, Low stock count, and RTO/Cancel rate.
- Tests: `pnpm check` passed cleanly (0 typecheck errors, 0 lint errors, 100% Prettier formatting, 102 test files and 1,251 tests passed).
- Review: Module boundaries, RBAC permissions, and design tokens strictly followed without arbitrary styling or unhashed secrets.
- Decisions: ADR-015, ADR-023, ADR-025 preserved.
- Next: Module 11 (Finance & Expense Tracking) or Module 14 (SEO & Discovery).
- Blockers/risks: none.

### 2026-10-09 — Admin Console Live Dashboard & Customer Account Order Linking — Done
- Type: enhancement and fix
- Scope: Activated live dashboard reporting for staff console `/admin` with real metrics (Net sales, Pending confirmations, To ship, Low stock), operations attention queue, and recent orders stream. Linked guest checkout orders by email/phone in customer portal `/account`. Configured `.env.local` to point directly to Supabase production store database.
- Changed:
  - Admin Dashboard (`src/app/admin/(console)/page.tsx`):
    - Transformed empty hardcoded placeholders into live executive dashboard.
    - Connected 4 live KPI cards: Net sales (`orderStats.netSalesFormatted` + delivered revenue note), Pending confirmations (queue tone warning), To ship (dispatch ready), and Low stock (buffer check).
    - Added quick operations shortcuts (Verification Queue, Fulfilment, Inventory, Clients).
    - Rendered interactive "Operations Attention Queue" for orders needing verification or packaging.
    - Rendered "Recent Commissions" table with live order numbers, client contacts, pieces summary, BDT totals, and status badges.
  - Query Layer:
    - `src/modules/orders/queries.ts`: Added `getAdminDashboardOrderStats` query aggregating status counts, net sales, delivered sales, attention orders, and recent commissions.
    - `src/modules/inventory/queries.ts`: Added `getLowStockVariantCount` query reading variants below reorder threshold.
    - `src/modules/customer/repository.ts`: Enhanced `findCustomerOrders` to match by `userId`, `email`, or `phone` so orders placed through guest checkout appear in the client's account dashboard.
  - Environment:
    - Updated `.env.local` with Supabase connection strings from `.env.supabase.local` so local dev and live store share the real customer orders and product catalog.
- Tests: `pnpm check` passed cleanly (0 typecheck errors, 0 lint errors, 100% Prettier formatting, 99 test files and 1,231 unit tests passed).
- Review: Invariants preserved (admin pages call `requireStaff`, no status bypasses, boundaries clean).
- Decisions: ADR-015 and ADR-025 preserved.
- Next: Module 10 (Promotions and Pricing) or Module 8.1 (Section-block page builder).
- Blockers/risks: none.

### 2026-10-09 — 9.1, 9.2, 9.3 Search and Discovery, Search Overlay & Results Page — Done
- Type: new and enhancement
- Scope: Implemented full search engine infrastructure, fast debounced live suggestions, luxury slide-down search overlay in storefront header, and complete results page with live inventory availability and curated fallback signatures.
- Changed:
  - Search Module (`src/modules/search/`):
    - `types.ts`: Defined `SearchProductSuggestion`, `CategorySuggestion`, `SearchSuggestionsResult`, and `SearchResultsData`.
    - `schemas.ts`: Strict Zod validation schemas (`searchInputSchema`, `suggestionsInputSchema`).
    - `repository.ts`: Multi-word weighted search query matching title, subtitle, description, material, productType, tags, category name, and variant SKU with typed `searchCardInclude` payload.
    - `service.ts`: Business logic for live typeahead suggestions, fallback curated signatures, and `toCardSource` transformation.
    - `queries.ts`: Server queries `getSearchResults` and `getSearchSuggestions`.
    - `actions.ts`: Storefront Server Action `getSearchSuggestionsAction` for client overlay integration.
    - `__tests__/search.test.ts`: Unit tests validating search schemas, trimming, length caps, and popular search curation.
  - Storefront Search UI:
    - `src/components/storefront/search/search-overlay.tsx`: Luxury modal overlay with debounced search suggestions, product thumbnails, matching categories, and popular query chips ("Linen Shirt", "Pleated Trousers", "Cashmere Polo", etc.).
    - `src/components/storefront/header.tsx`: Connected Search icon to trigger `SearchOverlay`.
    - `src/app/(storefront)/search/page.tsx`: Transformed stand-in into full search results page with live stock integration (`withLiveStock`), `ProductGrid` rendering, zero-results curated signature alternatives, quick search input, and `noindex` robots tag per spec.
- Tests: `pnpm check` passed cleanly (0 typecheck errors, 0 lint errors, 100% Prettier formatting, 99 test files and 1,231 unit tests passed).
- Review: Module boundaries respected (components import actions; app routes import queries), zero arbitrary CSS classes, and SEO `noindex` applied to internal search.
- Decisions: Architecture section 9 search indexing and crawler isolation rules strictly followed.
- Next: Module 10 (Promotions and Pricing) or Module 8.1 (Section-block page builder).
- Blockers/risks: none.

### 2026-10-09 — 7.8 Admin Customer Management, Lifetime Metrics & Access Controls — Done
- Type: new and enhancement
- Scope: Built complete admin customer directory and detail management, lifetime value (LTV) and average order value (AOV) metrics, order history timeline, saved delivery addresses, and audited block/unblock controls.
- Changed:
  - Database Query Layer:
    - `src/modules/customer/repository.ts`: Added `listCustomersForAdmin` (search by name, email, phone; status filter; order count and LTV calculation), `findCustomerDetailForAdmin` (metrics, order lines, addresses), and `setCustomerBlockedStatus` (session revocation upon block).
  - Validation & Service Layer:
    - `src/modules/customer/schemas.ts`: Added `blockCustomerSchema` and `unblockCustomerSchema` with strict length and UUID validation.
    - `src/modules/customer/service.ts`: Added `blockCustomer` and `unblockCustomer` transactional methods with append-only audit logging (`customer.block`, `customer.unblock`).
    - `src/modules/customer/queries.ts`: Exported `getCustomersForAdmin` and `getCustomerDetailForAdmin`.
  - Admin Server Actions:
    - `src/modules/customer/actions.ts`: Added `blockCustomerAction` and `unblockCustomerAction` with `requireStaff()` authentication and `assertPermission(staff, 'customers.write')`.
  - Admin Console UI & Pages:
    - `src/components/admin/customers/customer-status-badge.tsx`: Active (success) vs Blocked (danger) luxury status badges.
    - `src/components/admin/customers/customer-block-dialog.tsx`: Reason input dialog for blocking/unblocking clients with feedback toasts.
    - `src/components/admin/customers/customers-table.tsx`: Filterable directory table with search, status tabs, LTV formatting, and action links.
    - `src/app/admin/(console)/customers/page.tsx`: Directory page guarded by `customers.read`.
    - `src/app/admin/(console)/customers/[id]/page.tsx`: Client detail view with KPI cards (LTV, AOV, order volume), account credentials, saved delivery destinations, and complete order history.
  - Admin Navigation:
    - `src/lib/admin-nav.ts`: Set Customers item to `ready: true`.
  - Unit Tests:
    - `src/modules/customer/__tests__/schemas.test.ts`: Added test cases for block and unblock schemas.
    - `src/modules/customer/__tests__/actions.test.ts`: 4 unit tests validating authorization, input schemas, and execution flow.
- Tests: `pnpm check` passed cleanly (0 typecheck errors, 0 lint errors, 100% Prettier formatting, 98 test files and 1,224 unit tests passed).
- Review: Admin guard invariants verified (`tests/lint/admin-guards.test.ts`), design token rules followed, and audit log entries generated in-transaction.
- Decisions: ADR-019 CSV export compatibility, strict role permissions (`customers.read` and `customers.write`).
- Next: Module 8.1 (Section-block page builder) or Module 9 (Search and Discovery).
- Blockers/risks: none.

### 2026-10-09 — 7.1, 7.2, 7.4 Customer Accounts, Auth Pages & Address Book — Done
- Type: new and enhancement
- Scope: Implemented customer authentication pages, account dashboard, order history listing, address book management, and profile preferences with luxury styling and security protections.
- Changed:
  - Customer Module Architecture:
    - `src/modules/customer/schemas.ts`: Strict Zod validation schemas for address CRUD and profile updates (`saveAddressSchema`, `deleteAddressSchema`, `setDefaultAddressSchema`, `updateProfileSchema`).
    - `src/modules/customer/repository.ts`: Database query layer for customer addresses, orders with line item snapshots and product media, and user profile data.
    - `src/modules/customer/service.ts`: Transactional business logic with default address promotion and user data isolation.
    - `src/modules/customer/queries.ts`: Cached server queries (`getCustomerDashboardData`, `getCustomerAddresses`, `getCustomerOrders`, `getCustomerProfile`).
    - `src/modules/customer/actions.ts`: Secure server actions with `authMutation` rate limiting, user session gating, and cache revalidation (`saveAddressAction`, `deleteAddressAction`, `setDefaultAddressAction`, `updateProfileAction`).
  - Auth Pages (7.1):
    - `src/app/(storefront)/login/page.tsx` & `src/components/storefront/auth/login-form.tsx`: Sign-in form with email/password, Cloudflare Turnstile bot protection, and `?next=` redirection.
    - `src/app/(storefront)/register/page.tsx` & `src/components/storefront/auth/register-form.tsx`: Customer registration with 10+ character password requirement and verification email dispatch.
    - `src/app/(storefront)/forgot-password/page.tsx` & `src/components/storefront/auth/forgot-password-form.tsx`: Anti-enumeration password recovery request flow.
    - `src/app/(storefront)/reset-password/page.tsx` & `src/components/storefront/auth/reset-password-form.tsx`: Token-verified password reset form with session invalidation.
  - Account Dashboard & Pages (7.2, 7.4):
    - `src/app/(storefront)/account/layout.tsx`: Dynamic nonce section layout (`instant = false`, `await connection()`) and `requireUser()` authentication gate.
    - `src/components/storefront/account/account-nav.tsx`: Luxury client sidebar with active indicators and `authClient.signOut` action.
    - `src/app/(storefront)/account/page.tsx`: Overview dashboard with commissions metric, saved destinations, and atelier privileges.
    - `src/app/(storefront)/account/orders/page.tsx` & `src/components/storefront/account/orders-list.tsx`: Order history listing with status badges, line item thumbnails, prices, and tracking links.
    - `src/app/(storefront)/account/addresses/page.tsx` & `src/components/storefront/account/address-book.tsx`: Address management with cascading Bangladesh divisions/districts selection, default destination toggle, edit, and delete.
    - `src/app/(storefront)/account/profile/page.tsx` & `src/components/storefront/account/profile-form.tsx`: Profile details, phone update, and membership status.
  - Storefront Navigation:
    - `src/components/storefront/header.tsx`: Added `User` icon linking to `/account`.
- Tests: `pnpm check` passed (typecheck 0 errors, lint 0 errors, Prettier 100% compliant, 97 test files and 1,217 unit tests passed).
- Review: Module boundaries, design token compliance, fail-closed rate limiting, and zero arbitrary color/radius values verified.
- Decisions: ADR-022 nonce section requirements strictly applied on `/account`.
- Next: Module 7.8 (Admin customer management) and Module 8.1 (Section-block page builder).
- Blockers/risks: none.

### 2026-10-09 — 10.1, 10.2, 10.5 Promotions Engine, Checkout Discounts, Sale Badges & Admin Console — Done
- Type: new and enhancement
- Scope: Implemented production discount engine, checkout promo codes, line-level discount allocations, compare-at sale displays, and full admin promotion management.
- Changed:
  - Database & Migrations:
    - Added tables `discounts` and `discount_redemptions`, plus `carts.discount_code` column with index (`20261009100000_add_promotions_and_discounts`).
  - Promotions Module (`src/modules/promotions/`):
    - `types.ts`, `schemas.ts`, `repository.ts`, `service.ts`, `queries.ts`, `actions.ts`.
    - Enforced INV-D1: atomic conditional `usage_count` increment (`usage_count < usage_limit`), ledger recording in `discount_redemptions`, and automatic redemption release on order cancellation.
    - Proportional line-item allocation using `allocate()` to guarantee line-item rounding exactness (INV-M4).
    - Generic enumeration-resistant error message: `"Invalid or expired discount code"`.
    - Fail-closed rate limiting via `couponApply`.
  - Storefront Integration:
    - `src/modules/checkout/service.ts`: Evaluates and applies discount coupons to checkout quotes and orders.
    - `src/components/storefront/checkout/checkout-form.tsx` & `order-summary.tsx`: Live promo code input field, apply/remove actions, discount line display, and error toasts.
    - `src/modules/catalog/card.ts` & `product-card.tsx`: Activated `sale` oxblood badge and strike-through pricing for items with `compareAt`.
  - Admin Console:
    - `src/app/admin/(console)/promotions/page.tsx`: Promotions management console with status filtering and search.
    - `src/components/admin/promotions/create-discount-dialog.tsx`: Dialog for creating percentage/fixed/free-shipping discounts with usage limits, minimum subtotals, and schedule dates.
    - `src/components/admin/promotions/discounts-table.tsx`: Promotions listing with active/inactive status toggle and usage counters.
    - `src/lib/admin-nav.ts`: Set Promotions nav item to `ready: true`.
- Tests: `pnpm check` passed cleanly (100 test files, 1,241 unit tests, 0 TS errors, 0 ESLint errors, 100% Prettier formatted).
- Next: Module 11 (Finance and Cost Tracking) or remaining P0 items.

---

### 2026-10-09 — 8.2, 8.3, 8.4, 8.7, 8.8 Storefront Luxury Aesthetics, Editorial Sections & Client Care Pages — Done
- Type: new and enhancement
- Scope: Elevated AUREN digital storefront into a world-class luxury menswear brand experience with rich editorial content, atelier storytelling, client concierge services, complete static/legal infrastructure, and cookie consent preferences.
- Changed:
  - Editorial Photography: Generated and integrated photorealistic atelier and lookbook assets in `public/editorial/` (`craftsmanship.jpg`, `lookbook.jpg`, `atelier.jpg`).
  - Homepage Sections (8.2, 8.7):
    - `src/components/storefront/home/atelier-story.tsx`: Dark editorial surface with noble natural fiber standards (Egyptian Giza 87, French linen, merino wool) and master craftsmanship pillars.
    - `src/components/storefront/home/lookbook-curation.tsx`: Seasonal relaxed elegance curation banner with direct shoppable links.
    - `src/components/storefront/home/concierge-banner.tsx`: Bespoke client privileges, WhatsApp desk, phone verification, and doorstep size exchange.
    - `src/components/storefront/home/newsletter-section.tsx`: The AUREN Inner Circle dispatch subscription block with instant client-side feedback.
    - `src/app/(storefront)/page.tsx`: Seamlessly unified the luxury landing sequence.
  - Client Care & Brand Pages (8.4):
    - `src/app/(storefront)/about/page.tsx`: The House of AUREN, origin story (*aurum*), atelier fit standards, and ethical tailoring.
    - `src/app/(storefront)/shipping/page.tsx`: Comprehensive delivery matrix for Dhaka (24–48h, ৳80) and Nationwide (48–72h, ৳150) via Pathao and Steadfast, doorstep inspection policies.
    - `src/app/(storefront)/returns/page.tsx`: 7-Day Doorstep Size Exchange guide, 3-step swap workflow, condition guidelines, and refund schedules.
    - `src/app/(storefront)/faq/page.tsx`: Categorized accordions covering ordering, sizing, delivery, and payments, backed by `FAQPage` JSON-LD schema for SEO.
    - `src/app/(storefront)/contact/page.tsx` & `contact-form.tsx`: Direct concierge channels (WhatsApp, phone, email, Banani Dhaka studio) and interactive inquiry form.
    - `src/app/(storefront)/size-guide/page.tsx` & `size-guide-tables.tsx`: Interactive size matrix with inch/cm unit toggle (shirts, trousers, blazers) and measurement instructions.
    - `src/app/(storefront)/privacy/page.tsx` & `src/app/(storefront)/terms/page.tsx`: Comprehensive e-commerce legal terms for Bangladesh and international clients.
  - Privacy & Cookie Consent (8.8):
    - `src/components/storefront/cookie-consent.tsx`: Non-intrusive luxury cookie banner in `storefront-shell.tsx` with localStorage persistence.
  - Chrome & Navigation (8.3):
    - `src/lib/site.ts`: Populated complete `FOOTER_COLUMNS`, `LEGAL_LINKS`, and `SOCIAL_LINKS` (Instagram, Facebook, WhatsApp Concierge).
  - Tracking Documentation:
    - `context/feature-progress.md`: Updated rows for Module 6 (6.1–6.15), Module 7 (7.3, 7.5, 7.6), Module 8 (8.2, 8.3, 8.4, 8.7, 8.8), Module 11 (11.5, 11.6), and Module 13 (13.1–13.3) to reflect completed stages.
- Tests: `pnpm check` passed cleanly (0 TypeScript errors, 0 ESLint errors, 100% Prettier formatting, and 96 test files / 1,210 unit tests passing).
- Next: Customer Accounts (Module 7 remaining rows: 7.1 auth pages, 7.2 dashboard, 7.4 address book) and SSLCommerz payment integration (5.3).
- Blockers/risks: none

---

### 2026-10-08 — Modules 5, 6, 11 order lifecycle (verification, fulfilment, returns, profit, notifications) — Done (checkpoint 3 finalized)
- Type: new and enhancement. Plan order: (1) review follow-ups (a)-(e) of the cost-basis commit, (2) 6.1-6.5, 6.13-6.15 verification, (3) fulfilment and shipping 6.6-6.9, 6.11, (4) COD payments and refunds 5.4/5.5, (5) returns 6.12, (6) order costs and profit 11.5/11.6, (7) notifications 13.1-13.3, (8) E2E journey.
- DONE so far (uncommitted): follow-ups (a) Adjust stock cost needs the Set cost step-up and the maker-checker valuation counts re-costed on-hand stock (setCostBasis too), (b) previewProductCost uses catalog.readVariantCosts (no locks), (c) e2e asserts On hand, Available and Cost cells, (d) resolveArea again rejects a district not in the chosen division and a thana of another district when ids come from the known lists (integration test restored), (e) set-cost dialog catch, previewFailed reset, password focus, variant currency. Inventory and checkout integration 67/67.
- Migration 20261008120000_add_fulfilment_returns_and_order_costs APPLIED to the dev database (auren): order_verification_attempts, order_cost_lines, refunds (amount guard trigger), shipments, shipment_events, packaging_profiles, return_requests, return_items, store_credit_ledger, orders claim and review columns, shipped/RTO/completed timestamps, order_items.replacement_of_item_id; RLS, append-only triggers, REVOKEs. database-roles test list updated.
- New pure code with unit tests green (28): modules/orders/state-machine.ts, modules/orders/sla.ts, modules/finance/profit.ts, settings verification and return settings (schemas and getters).
- Existing permissions reused (no new migration): orders.verify, orders.update, orders.cancel, orders.refund, orders.fulfill, shipping.manage, returns.manage, finance.read; cost columns use canSeeCostOfGoods.
- DONE since (uncommitted): orders/state-machine, transitions (single status write path), verification service rewrite (claim lock, release, assign, checklist gated confirm, hold with attempts and manager flag, cancel with refund request and net restock, notes), edit-during-verification (edit.ts, server re-price, stock deltas, DB triggers freeze lines and totals after confirmation, migration 20261008130000), manual order entry (checkout/manual.ts), verification queue page and workspace UI with J K C H X, new order page, escalation job logic, finance module (cost lines, profit), payments refunds and COD collection, couriers (manual, Pathao and Steadfast adapters behind env keys, fake transport), shipments service, fulfilment (processing, ship, parcel updates, RTO, completion, polling). Migration 20261008140000 lets cost lines be reversed with negative lines.
- Tests green: integration verification 24/24, fulfilment 14/14, inventory+checkout 67/67; unit state machine, sla, profit, couriers, order-status-writes (no job or webhook path writes confirmed or cancelled).
- DONE since (uncommitted, 2026-10-09 checkpoint 2): refunds (processRefund, maker-checker, store credit ledger, COD collection at delivery) with integration tests 13/13 (returns and refunds); returns module (customer request with window rules, approve, reject, receive, inspect with restock or write-off, settle refund, store credit or exchange, replacement parcel); notifications (React Email templates, copy module, SMS adapter log, send log, Inngest handlers, escalation mail) integration 9/9; invoice and packing slip PDFs with batch print (confirmed orders only); order detail page rewritten (fulfilment, refund, returns, profit and cost panels, timeline, verification history); orders list with filters, saved views, bulk print and start-picking, CSV export with step-up and audit; shipping board, returns list, approvals page, Settings > Orders and fulfilment (verification rules, return window, packaging profiles); customer order page shows parcel, dated updates, returns and the return request form; ADR-036..041 and DATA-MODEL appended. Specs written, not yet run: tests/e2e/order-journey.db.spec.ts and order-cancel-return.db.spec.ts (runner: scratchpad run-e2e.cjs).
- CHECKPOINT 3 (2026-10-09, after the rate-limit stop): boundary refactor done (eslint.boundaries.mjs lists the new service, repository and action files; admin read-model types in orders/admin-types.ts and finance/types.ts; actions call same-module service wrappers; pages read through queries.ts). pnpm typecheck clean, pnpm lint clean (one run), prettier applied, unit 1210 green, integration 19 files green file by file (320 passed, 1 skipped by design; run with scratchpad run-int.sh because the machine has about 6 GB RAM and little free). Next.js production build for E2E failed with an out-of-memory error (Turbopack): E2E specs written (tests/e2e/order-journey.db.spec.ts, order-cancel-return.db.spec.ts) but NOT yet run. Code-reviewer and commerce-invariants-reviewer agents were killed by the rate limit and must be re-run. Small pending change: show courier charge inputs to staff with shipping.manage (not only cost-of-goods viewers).
- STILL TO DO: retry build with more headroom, run the two E2E specs, reviewers, premium-ui-qa, feature-progress rows, secret scan, pnpm check, final report.

---

### 2026-10-08 — 3.2, 3.7, 4.6 Cost basis for variants without cost (owner report) — WIP (state checkpoint, results added below when gates finish)
- Type: enhancement and fix
- Problem: orders were refused with "variant has no cost basis" because avg cost was set only by goods receipts; admin-created products stocked through Adjust stock had stock but zero cost. The product edit page also showed stale stock because the variants table kept its row state (including On hand) from first mount and its key ignored stock.
- Changed: purchasing/cost.ts averageCostAfterAddition; inventory schemas (opening_stock reason, unitCost, setCostBasisSchema, costPreviewSchema, no_cost filter), service (adjustStock with cost, setCostBasis, previewProductCost, reportNoCostRefusal, countVariantsWithoutCost), actions (setCostBasis, previewCostBasis), queries, repository; catalog service and repository (setVariantCostIfUnset, liveVariantIdsOfProduct); audit service and repository (recentlyRecorded); checkout service (audit alert after a no-cost refusal, outside the rolled-back transaction); lib/permissions canSeeCostOfGoods; admin: inventory page banner, filter, Set cost dialog (single or whole product with preview), Unit cost field in Adjust stock, product edit page On hand, Available, Cost, chip and links read live, publish warning; docs: ADR-035, ARCHITECTURE 7.1, docs/runbooks/how-cost-works.md, README. No migration.
- Tests so far: unit (cost worked examples, schemas, actions) green; integration inventory and checkout 62/62 on auren_test (incl. first addition on zero-cost variant, later addition at another cost, set cost refusal and bulk, alert once per hour, orderable after Set cost); Playwright spec tests/e2e/inventory-cost.db.spec.ts written.
- Decisions: ADR-035. Stale integration assertions about mismatched addresses updated to the owner's manual-address behaviour (commit 8900328).
- Next: gates (Playwright, reviews, secret scan), then final report.
- Blockers/risks: none

---

### 2026-10-05 — 4.1 to 4.8, 5.1, 5.2 order flow (stage 2) — WIP (state checkpoint)
- Type: new
- Done so far (uncommitted, in the working tree): migration add_cart_checkout_orders (carts, cart_items, geo_areas, addresses, shipping_zones/rates, orders, order_items, order_events, payments, customer_risk_flags, notification_logs, order_number_seq, INV-O9 CHECK + trigger, append-only triggers, RLS) applied to dev and test DBs; modules shipping (geo data 8 divisions, 64 districts, ~355 thanas; zones, quote, admin actions), settings (checkout protection, COD), cart (service, cookie, actions, view; integration 14/14); storefront cart UI (store, drawer, bag page, header BagButton, wishlist page, PDP and card wired, dead header and footer links removed).
- UPDATE (resume checkpoint): all code for 4.1-4.8, 5.1, 5.2 is written (payments, orders, checkout, notifications modules; checkout, track, cart, wishlist pages; admin /orders and /settings/shipping; migration applied; ADR-031..034; DATA-MODEL updated). Integration: cart 14/14, checkout 30/30 on real Postgres; unit 1127 pass (cod registry bug fixed). Playwright spec tests/e2e/checkout.db.spec.ts written; last fixes applied (empty-bag revision, uncached geo list, form-scoped locators) and NOT yet rebuilt or re-run. Run e2e with the scratchpad runner (loads .env.local TEST_ vars; server as auren_app). Then: dev-server cold-start performance task, code-reviewer, commerce-invariants-reviewer, premium-ui-qa (E2E_SHOTS=1 screenshots in tests/e2e/__qa__/shots), feature-progress rows, secret scan.
- Next: reconcile checks, performance task, rebuild + e2e, reviews, progress rows.
- Blockers/risks: none yet. Settings permission is the existing settings.manage (not settings.write).

---

### 2026-10-04 — 2.9 to 2.14 and 3.1 to 3.7 Inventory, purchasing, storefront listing and product page — Done
- Type: new (all rows)
- Changed: prisma migrations add_inventory_and_purchasing and harden_reservation_release; src/modules/inventory and src/modules/purchasing (repository, service, schemas, actions, queries, cost maths, PO state machine, PDF); catalog (pdp.ts, card.ts, listing.ts, storefront queries, sitemap queries, cost helpers); src/modules/cart (addToCart contract, not persisted); admin pages inventory, movements, suppliers, purchasing (list, new, detail, edit, PDF route); storefront routes shop, collections, search stub, products/[slug] (page, live island, OG image), sitemap.ts, robots.ts; components storefront/{catalog,pdp}, admin/{inventory,purchasing}; prisma seed (supplier and four purchase orders through the real services); ADR-029; DATA-MODEL; admin nav; navigation links to existing routes only.
- Tests: unit 1034/1034 · integration 242 passed, 1 skipped by design on the real local PostgreSQL (incl. 50 parallel buys, mixed reserve/receive/expiry, ledger reconcile, avg cost worked examples, receipts, roles) · Playwright 245 passed on the full run, with axe at desktop and mobile; two first-pass flakes (catalog-categories create form clicked before hydration; shop back-navigation count) passed on rerun and with retries · typecheck, lint, format:check, secret-scan --all clean · build ok
- Review: commerce-invariants-reviewer 3 high (missing EXECUTE grant on the expiry function, commit of an expired hold silently succeeding, landed cost added after a partial receipt), 6 medium, 7 low; code-reviewer 13 medium, 18 low; premium-ui-qa FAIL on first run (PDP overflow at 375, chat button over the sticky bar, dead Collections menu links, wrong title face, gallery not a stacked column). All high and medium findings fixed: new migration, commitReservation names its lines, landed costs only before the first delivery, step-up for any removal, NO KEY UPDATE variant lock, cost base over all locations and a currency check, audit allowlist, cost visibility limited to purchasing and finance staff, buy box availability from the resolved variant, try/catch around every action call, focus return, gallery column, menu links, safe-area bar. premium-ui-qa re-run: all fixes verified (no overflow at 375, 768 or 1440, axe clean, CLS about 0); a last buy-box row overflow at 375 was fixed and re-checked: verdict pass, with two low axe notes left (accordion heading order, chat button outside a landmark) and a cosmetic 48 px heart beside a 56 px button.
- Decisions: ADR-029 (ledger semantics, landed cost allocation, weighted average cost, expiry and commit rules)
- Next: cart and checkout (4.x) replace the addToCart integration point in src/modules/cart/service.ts
- Blockers/risks: add to bag does not persist (honest toast); soft 404 (unknown product answers 200 with noindex because the page streams behind loading.tsx); sitemap is prerendered and revalidated hourly; the receive-time currency is BDT only; all product pictures are SVG placeholders so crop and hover images were not judged; PDP spec items for later modules (ratings, fit meter, delivery estimate, Complete the look); header links /new, /lookbook, /journal and the cart prefetch still point at pages that do not exist yet; the catalog-categories Playwright spec flakes on the first create click under load; PLP header is tall on desktop and 768 defaults to four columns (design polish)

### 2026-10-04 — 3.1, 3.2, 3.3 Stock ledger, adjustments, atomic reserve/commit/release (backend milestone) — Done
- Type: new
- Changed: prisma schema and migration add_inventory_and_purchasing (stock_reservations, suppliers, purchase orders and items, landed costs, goods receipts, PO sequence, release_expired_reservations(), default warehouse, RLS, receipts append-only); src/modules/inventory (repository, service, schemas, actions, queries, tags, Inngest job releaseExpiredStock); catalog service cost helpers (lockVariantCosts, setVariantAverageCost, productIdsForVariants)
- Tests: inventory integration 16/16 on the real local test DB (incl. 50 parallel buys); inventory actions unit 5/5
- Review: pending (runs after 3.7)
- Decisions: ledger semantics (on_hand vs reserved) documented in service.ts; ADR to follow with purchasing
- Next: 3.4 suppliers, 3.5 purchase orders, 3.6 landed costs, 3.7 goods receipt
- Blockers/risks: none

### 2026-10-04 — Part 1 runnable base, 2.1 to 2.5 and 2.7 catalogue admin, Blocked rows verified on real PostgreSQL — Done
- Type: new (2.1 to 2.5, 2.7), enhancement and fix (runnable base)
- Changed: src/modules/catalog (schemas, service, repository, actions, queries, redirect snapshot, matrix, slug, rules), migrations session_timezone_utc, add_collections_size_charts_redirects, catalog_constraints; admin screens for products, categories, collections, size charts; shared SortableList, SingleImageField, shrink-image; home page catalogue sections; proxy slug redirects; demo admin switch (SEED_DEMO_ADMIN) with production guards; env loading from .env.local for Prisma, seed and integration tests; auth client origin fix; stub loader fix for Playwright; README Quick start; ADR-027 and ADR-028.
- Tests: unit 891/891 · integration 207 passed, 1 skipped by design (CI-only guard) on the real local PostgreSQL (auren_test, auren_app real login block ran) · Playwright 170 passed with axe on desktop and mobile (16 skipped: visual and preview-only) incl. demo admin TOTP enrolment, catalogue specs, 301 redirect through the proxy · typecheck, lint, format:check, secret-scan --all clean
- Review: code-reviewer (2 high, 14 medium) and commerce-invariants-reviewer (1 high, 6 medium) findings fixed and re-reviewed (1 high regex typo and 4 medium fixed): product row locks, option/value ids, redirect hardening and cache, publish rights in the service, upload authorisation order, constraint mapping, advisory locks, NOT-rule NULLs, SKU probing, UI fixes. Real-Postgres run found: time zone shift of timestamps, probe-role grants, stale specs, auth client pointing at the build-time URL, SKU suffix collision, mobile overflow in FormSection.
- Decisions: ADR-027 (UTC session time zone), ADR-028 (redirects in the proxy, collections rebuilt on write, publish rights)
- Next: Module 2 storefront rows 2.9 to 2.14 (PLP, card, PDP, island, SEO); 3.1 inventory (variants currently start without stock rows)
- Blockers/risks: 0.4 stays Blocked (docker compose db:up unverified) and 0.12 (GitHub runs); a customer opening a console URL gets the 404 page with HTTP 200 (streamed shell); redirect snapshot per instance is up to 15 s stale; variants start with avg cost 0 until purchasing sets it (orders must refuse a variant without a cost basis); uploads over about 4.5 MB on Vercel rely on the browser shrinking the file; no step-up on catalogue deletes; premium-ui-qa visual gate not run on the new home sections; 2.6 and 2.8 (P1) skipped as instructed

### 2026-10-03 — 18.7 to 18.11 Telemetry, secret scan, abuse specs, security operations, insider risk — Done
- Type: enhancement (18.9 new, specs only)
- Changed: audit of the work already in a6a2e9d per row (see feature-progress Notes for the evidence). Added: JWT rule in src/lib/observability/scrub.ts, console gate extracted to src/components/admin/shell/staff-gate.tsx, /.well-known/ open during maintenance (src/proxy.ts), runbook step for GitHub secret scanning and push protection (ci-and-branch-protection.md), key-rotation runbook refreshed (no Cloudinary, adds Blob, Turnstile, health token), new tests: telemetry (JWT, E.164), staff-gate 404, sourcemaps-config, abuse-control-specs, security-operations, proxy well-known
- Tests: unit 746/746 (was 714) · integration 162 passed, 3 skipped (real-login block) on PGlite with TZ=UTC and DB_POOL_MAX=1, no integration code changed · typecheck, lint, format:check, secret-scan --all and --history clean
- Review: code-reviewer 1 high (a progress-file edit script corrupted context/feature-progress.md; restored from git and re-applied) and 4 medium (tests coupled to the element tree, source-text regexes on next.config.ts, weak keyword needles, section lookup) fixed
- Decisions: none (ADR-015, INV-O1 and INV-O2 untouched; ADR-021..026 cover the controls)
- Next: Module 18 remaining rows (18.2 stays Blocked until the owner's local PostgreSQL logins work), then Module 4
- Blockers/risks: Playwright checks need a working local database (not run here); GitHub secret scanning and push protection are owner settings, not verifiable from code; owner alert email delivery not exercised against a real provider

### 2026-10-03 — 18.12 Hosting and media infrastructure (Supabase, Vercel Blob, local database) — Done
- Type: enhancement
- Changed: step 0 verified the interrupted tree (typecheck, lint, unit 644/644 green; format fixed). Docs: ARCHITECTURE, DECISIONS (ADR-025 Supabase supersedes the Neon choice and updates OD-5; ADR-026 Vercel Blob/local supersedes ADR-012), DATA-MODEL, CLAUDE.md, README, .env.example, auren-testing and auren-db-change skills (new tables must call auren_secure_table / ENABLE ROW LEVEL SECURITY), runbooks (database-roles Supabase section, local-database, production-environment). Code: src/lib/media/* (MediaProvider local + Vercel Blob, random keys, HMAC signed private links, magic-byte validation with no SVG, sharp re-encode stripping EXIF/GPS, Blob host check), media route handlers, CSP img-src for *.public.blob.vercel-storage.com, migration media_storage_columns (product_media provider, storage_key, content_type, size_bytes with CHECKs), global-setup TEST_APP_DATABASE_URL, secret-scan skips .local-media, ignores for git/prettier/eslint, Cloudinary removed from env. package.json: @vercel/blob, sharp. feature-list rows 2.3, 14.8, 18.1, 18.9 updated and 18.12 added
- Tests: unit 714/714 (media upload, traversal and signed links, Blob provider and host check; CSP; config) · integration 162 passed, 3 skipped (real-login block) on an in-process PGlite server with TZ=UTC (the local PostgreSQL rejected the .env.local logins), including public-schema-security (RLS on every table, API roles empty) and media-storage constraints · typecheck, lint, format:check, secret scan clean
- Review: code-reviewer 3 medium and 7 low; fixed: future-function default privileges (global REVOKE per creator role, test), DB CHECKs on storage_key and URL per provider, scope private and public pdf keys refused, NaN size cap, anchored test-host guard. Accepted: PUBLIC USAGE on schema public kept (Supabase internals), CSP uses the store wildcard, receipts are stored as received
- Decisions: ADR-025, ADR-026
- Next: 18.7 (and the owner's one-time local database setup, which clears the Blocked state of 18.2)
- Blockers/risks: local PostgreSQL logins fail (28P01), so 18.2 stays Blocked; PGlite reports local time as UTC unless TZ=UTC, which broke one alert test until the server ran with TZ=UTC; public/seed SVG placeholders still ship in public/ (documented, replaced when catalog media goes live)

### 2026-10-03 — 18.3 Session hardening — Done
- Type: enhancement
- Changed: src/lib/{auth,staff,session-policy,step-up,step-up-token,owner,errors,action-result}.ts, src/modules/identity/*, src/components/admin/{password-change-form,sign-out-everywhere-button,field}.tsx, src/app/admin/(auth)/security, src/app/admin/(console)/account, prisma migration add_forced_password_change, env BETTER_AUTH_SECRETS, docs/runbooks/key-rotation.md
- Tests: unit and integration cover revocation on reset and change, no sliding, staff cap, bootstrap flag, step-up (password, real TOTP, purpose, expiry, other session, delays, audit), sign out everywhere · e2e account page with axe
- Review: code-reviewer 6 medium and security-auditor 4 medium fixed (step-up uses the rotated secret and a purpose, audit before grant, trusted-device shortcut disabled, unchanged password refused server side, reset clears the bootstrap flag, self-service lint allowlist, a11y of the form); the hooks.before body mutation did not take effect until it returned the new context (found by the integration tests)
- Decisions: none (ADR-021 covers roles)
- Next: 18.4
- Blockers/risks: Better Auth 1.7.6 cannot hash session tokens; TOTP codes can be replayed within one 30 s step

### 2026-10-03 — 18.4 Fail-closed auth rate limits — Done
- Type: enhancement
- Changed: src/lib/{rate-limit,attempts,trusted-proxy,request-meta,request-body,turnstile}.ts, src/app/api/auth/[...all]/route.ts, src/components/admin/{sign-in-form,turnstile-widget}.tsx, env schema (TRUSTED_PROXY hops, Turnstile keys)
- Tests: unit (attempts, fail-closed limiters, route behaviour, hops and IPv4-mapped addresses, Turnstile) · integration (no enumeration for sign-in, reset and sign-up, per-account delay for known and unknown emails, real TOTP lockout, trusted-device refusal) · e2e per-account limit
- Review: security-auditor 1 high (requests that could not be tied to an account skipped the delay: now JSON with an email is required and the body is byte-capped), 6 medium (atomic reservation instead of check then record, IPv4-mapped bucket collapse, Turnstile hostname, unknown-address and lockout trade-offs documented) fixed
- Decisions: none
- Next: 18.5
- Blockers/risks: an attacker can delay a victim account (max 15 min, password reset still works); origin must only be reachable through the proxy when using hops:N

### 2026-10-03 — 18.5 CI/CD supply-chain hardening — Done
- Type: enhancement
- Changed: .github/workflows/{ci,e2e-preview,codeql,dependency-review,dependency-audit}.yml, .github/{CODEOWNERS,dependabot.yml}, docker-compose.yml, pnpm-workspace.yaml, tests/integration/global-setup.ts, tests/unit/ci-config.test.ts, docs/runbooks/ci-and-branch-protection.md
- Tests: 6 configuration tests (SHA pins, persist-credentials, no PR code next to secrets, identical image digests, release age and Dependabot, required workflows)
- Review: security-auditor 2 high and medium findings fixed (preview workflow trust: vercel[bot] creator, Environment-scoped secret, host allowlist; scheduled blocking audit; CodeQL concurrency; CODEOWNERS gaps; Dependabot cooldown)
- Decisions: none
- Next: 18.6
- Blockers/risks: workflows cannot run locally; action SHAs resolved from the GitHub API today and must be re-verified by the owner; minimumReleaseAge 4320 was rejected by pnpm because the lockfile holds packages younger than 3 days (2880 used)

### 2026-10-03 — 18.6 Nonce CSP for dynamic sections — Done
- Type: enhancement
- Changed: src/lib/security/headers.ts, src/proxy.ts, next.config.ts, src/app/admin/layout.tsx, docs/architecture/DECISIONS.md (ADR-022, OD-12 closed), tests (unit, lint, e2e), playwright.config.ts (readiness probe on a console page)
- Tests: unit (sections, header rules against Next path-to-regexp, nonce freshness, cache headers, maintenance) · lint (sections must be per-request) · e2e console hydrates under the nonce policy, injected inline handlers are blocked, storefront keeps the static policy, API locked down
- Review: security-auditor 4 medium fixed (matcher skipped file-like paths in sections, maintenance rewrite without CSP, no explicit no-store for nonce responses, weak lint test); low: decoded and case-insensitive section matching, script-src-attr none, autoplay=(self)
- Decisions: ADR-022 (supersedes ADR-016 for dynamic sections, closes OD-12)
- Next: 18.7
- Blockers/risks: first request to a console page loads the whole server bundle (about 40 s on this machine), so the browser-test readiness probe now waits on a console page; a corrupted .next cache made Turbopack panic until it was deleted

### 2026-10-02 — 18.2 Database least privilege — Blocked (real-login proof waiting for Docker (WSL))
- Type: new
- Changed: prisma/migrations/20261002100000_add_database_roles, scripts/db-roles.ts, scripts/db-reset.ts, tests/integration/{database-roles.int.test.ts,global-setup.ts}, docs/runbooks/database-roles.md, docs/architecture/DECISIONS.md (ADR-021), .env.example (DATABASE_URL = auren_app, DIRECT_URL = owner), .claude/skills/auren-db-change (ledger REVOKE rule), package.json (db:roles)
- Tests: integration 87 passed, 3 skipped by design (real-login block, runs when the harness owns a server) on PGlite with DB_POOL_MAX=1 · unit 412/412 · typecheck, lint, format green
- Review: security-auditor + code-reviewer: 2 high (migrator never became owner in the documented flow: runbook rewritten with explicit ownership handover and ROLES_ADMIN_URL; tests never ran dispatcher/runOnce/runIdempotent as auren_app: added), 6 medium fixed (outbox replay via status: dispatched is now terminal; migration verifies its own effect and fails the deploy; default privileges FOR ROLE auren_migrator; column-level privilege assertions and exact six-column grant; processed_events insert-only; loose regexes, SET ROLE guard in beforeAll, CI must provide real-login proof), lows fixed (TEMP revoke, search_path, timeouts, script error handling without echoing URLs)
- Decisions: ADR-021
- Next: 18.3
- Blockers/risks: waiting for Docker (WSL) for the real-login proof and a multi-connection run; password travels in ALTER ROLE (runbook warns about statement logging); inventory_levels and staff_members remain app-writable (covered by inventory constraints and 18.11 alerts)

### 2026-10-02 — 18.1 Production boot guards — Done
- Type: enhancement
- Changed: src/lib/env/{production,schema}.ts, src/lib/env.ts, next.config.ts (phase function), src/instrumentation.ts, src/lib/jobs/client.ts, src/app/api/inngest/route.ts, playwright.config.ts (LOCAL_PRODUCTION), .env.example, docs/runbooks/database-roles.md (started)
- Tests: unit 412/412 (39 new: one per refusal, local-run opt-in, build phase, SKIP flag, Inngest client mode and keys) · integration 61/61 (PGlite, DB_POOL_MAX=1) · e2e 110 pass, 14 skipped by design (production build served with LOCAL_PRODUCTION=1) · typecheck, lint, format green
- Review: code-reviewer 1 high (localhost APP_URL switched all guards off: now needs explicit LOCAL_PRODUCTION=1, never on Vercel), 5 medium (boot-time validation on serverless via register(), NEXT_PUBLIC_APP_URL must equal APP_URL, wider local-host SMTP check, hops:N message, redundant VERCEL_ENV check) all fixed; security-auditor: H1 H2 M1 closed, M2 closed once 18.4 adds hop-count mode; unsigned Inngest PUT sync disabled, serveOrigin pinned, INNGEST_BASE_URL refused
- Decisions: none (behaviour change documented in .env.example and ARCHITECTURE section 11 at 18.9)
- Next: 18.2
- Blockers/risks: Inngest cloud signature verification confirmed from the installed library source (mode cloud + signing key, fails closed), not exercised against Inngest Cloud

### 2026-10-02 — Module 1 Design System and Brand UI — run summary
- Type: 1.1 enhancement, 1.2–1.8 new
- Changed: tokens/fonts/base styles, src/components/{ui,motion,storefront,admin,style-guide}, storefront and admin shells, system pages, proxy (maintenance mode, matcher), test-only staff bypass, ADR-019 and ADR-020
- Tests: unit 368/368 · e2e 109 pass, 13 skipped by design (desktop, mobile, desktop-admin, mobile-admin) incl. axe · visual snapshots 28/28 stable · typecheck, lint, format, build green · integration not run (needs Docker)
- Review: code-reviewer 4 high, 12 medium, 11 low: all high and medium fixed (bypass hardening, access-denied boundary, 3:1 control borders, select/palette focus, proxy matcher, maintenance allow-list, selection counts, sign-out failure, copy that overpromised); premium-ui-qa: axe clean, high and medium fixed (44px targets, palette focus return, hero, taka glyph, mega menu scrim, toast close, mobile menu)
- Decisions: ADR-019 in-house DataTable, ADR-020 test-only staff bypass
- Next: Module 2
- Blockers/risks: 1.6 and 1.7 E2E Blocked on Docker (real-login spec written); visual baselines are win32 only; placeholder seed art shows colour names; social links, store address and WhatsApp number need owner input; no staff-facing guard yet distinguishes non-staff from errors beyond the layout check

### 2026-10-02 — 1.8 System pages — Done
- Type: new
- Changed: src/app/{not-found,global-error}.tsx, (storefront)/{not-found,error}.tsx, maintenance/page.tsx, proxy.ts, components/storefront/not-found-content.tsx, env MAINTENANCE_MODE
- Tests: unit 16 new (system pages, maintenance, matcher) · e2e system-pages 6 runs, axe ok
- Review: matcher no longer skips dotted paths, maintenance allow-list is explicit, error copy no longer claims an order is unchanged
- Decisions: none
- Next: module wrap-up
- Blockers/risks: no server-level run with MAINTENANCE_MODE=1

### 2026-10-02 — 1.7 Internal style guide page — Blocked (real-login E2E waiting for Docker)
- Type: new
- Changed: src/app/admin/(console)/style-guide, src/components/style-guide/*, tests/e2e/style-guide.*.spec.ts, playwright.config.ts (bypass server, visual opt-in), pnpm test:e2e:visual
- Tests: 28 visual snapshots (light and dark) · 22 interaction/axe specs on desktop and mobile
- Review: fixed mobile overflow, single h1, unique landmark names
- Decisions: ADR-020
- Next: 1.8
- Blockers/risks: waiting for Docker for admin-shell.db.spec.ts

### 2026-10-02 — 1.6 Admin shell — Blocked (real-login E2E waiting for Docker)
- Type: new
- Changed: src/components/admin/{shell,data-table,kpi-card,form-section,page-header,access-denied}, lib/{admin-nav,admin-theme,csv,test-bypass}, console layout and dashboard
- Tests: unit 22 + csv 6 + bypass 15 · bypass E2E on desktop and mobile with axe in light and dark
- Review: bypass hardened (explicit local APP_URL, local Host, loopback forwarded-for only), FORBIDDEN rendered by the layout
- Decisions: ADR-019, ADR-020
- Next: 1.7
- Blockers/risks: see 1.7

### 2026-10-02 — 1.1–1.5 Tokens, fonts, primitives, motion, storefront shell — stages Done, review gate pending
- Type: 1.1 enhancement, 1.2–1.5 new
- Changed: src/styles/globals.css, src/app/fonts.ts, src/app/layout.tsx, src/lib/{cn,brand,motion,site}.ts, src/components/{ui,motion,storefront}/*, src/app/(storefront)/*, admin field/sign-out/two-factor-setup migrated to primitives, env NEXT_PUBLIC_WHATSAPP_NUMBER
- Tests: unit 311/311 (93 new: tokens and contrast, primitives, motion, site) · e2e 25 pass + 6 skipped by design on desktop+mobile against a dev server (storefront shell, keyboard, focus trap, reduced motion, axe with menus open)
- Review: pending (code-reviewer, premium-ui-qa)
- Decisions: none
- Next: 1.6
- Blockers/risks: gold #A8875A (3.0:1) and warning #9A6B1F (4.2:1) fail AA as text on ivory, so small accent/warning text uses gold-strong and warning-strong; the spec colours stay for borders, fills and the focus ring

### 2026-10-02 — Module 0 Foundation and Platform — run summary
- Type: new
- Changed: whole foundation (see per-item entries), CHANGELOG.md, README.md, ADR-016/017/018 + OD-12, DATA-MODEL and ARCHITECTURE corrections, skills auren-nextjs-patterns / auren-db-change / auren-testing updated for installed versions
- Tests: unit 218/218 · integration 61/61 (PGlite, not Docker) · e2e 26/26 DB-free desktop+mobile, axe clean · typecheck, lint, format, build green
- Review: code-reviewer x4 and commerce-invariants-reviewer x2 run; all high and medium findings fixed
- Decisions: ADR-016 CSP without nonces, ADR-017 identity, ADR-018 outbox dispatcher, OD-12
- Next: Module 1 (after Docker verification of the blocked items)
- Blockers/risks: 4 sub-features Done, 11 Blocked on Docker/GitHub verification only; db:reset never executed

### 2026-10-02 — 0.10–0.13 review gate — Done (Docker-dependent verification still pending)
- Type: fix
- Changed: audit redaction by whole word + truncation hash; Sentry scrubbing for transactions/breadcrumbs/IP headers; CI (cancel only on PRs, Sentry upload on main only, audit informational, dependabot commit lint ignore, preview bypass); integration database name guard; catalog integration tests
- Tests: unit 218/218 · integration 61/61 on PGlite · e2e 26/26 DB-free
- Review: code-reviewer found 2 high (E2E sign-ins sharing one rate-limit bucket, missing catalog constraint tests) and 7 medium; all addressed
- Decisions: none
- Next: 0.15
- Blockers/risks: see per-item Blocked entries

### 2026-10-02 — 0.15 Seed data — Blocked (db:reset and Docker run pending)
- Type: new
- Changed: prisma/seed.ts, seed-catalog.ts, seed-data.ts, scripts/generate-seed-images.ts, public/seed/*; migration add_catalog_foundation
- Tests: unit 8/8 · integration 14 on PGlite (constraints, ledger reconciliation, idempotent reseed) · db:seed verified twice
- Review: code-reviewer: seed production guard, catalog constraint tests, extra CHECKs (movement direction, non-negative threshold and cost)
- Decisions: none
- Next: module wrap-up
- Blockers/risks: run pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed, and pnpm db:reset once, when Docker exists

### 2026-10-02 — 0.14 Security headers + rate limiting — Done
- Type: new
- Changed: src/lib/security/headers.ts, rate-limit.ts, request-meta.ts, src/app/api/auth/[...all]/route.ts, next.config.ts, ADR-016/OD-12
- Tests: unit 31 new · e2e 12 new (desktop+mobile) all green · axe ok
- Review: code-reviewer: client IP validation and trust modes, strict default bucket for unlisted auth mutations, per-account login limit, Redis timeout falls back to memory, LRU eviction, HSTS without preload
- Decisions: ADR-016 (CSP without nonces), OD-12
- Next: 0.15
- Blockers/risks: script-src keeps unsafe-inline until Next.js supports nonces with PPR; set TRUSTED_PROXY when hosting outside Vercel

### 2026-10-02 — 0.13 Observability — Blocked (DB-backed E2E waiting for Docker)
- Type: new
- Changed: src/instrumentation.ts, instrumentation-client.ts, src/lib/observability/*, src/app/global-error.tsx, src/app/api/health/route.ts, src/lib/health*.ts, src/lib/redis.ts, next.config.ts
- Tests: unit 12 new (172 total green); integration health check added
- Review: pending batch
- Decisions: @sentry/nextjs v11 exports withSentryConfig from the /config subpath and has no sendDefaultPii option
- Next: 0.14
- Blockers/risks: real Sentry delivery and source map upload need a DSN and token

### 2026-10-02 — 0.12 CI pipeline — Blocked (needs GitHub run and owner branch protection)
- Type: new
- Changed: .github/workflows/*, .github/dependabot.yml, .github/pull_request_template.md, docs/runbooks/ci-and-branch-protection.md
- Tests: workflow YAML formatted; every command in it verified locally except Docker based ones
- Review: pending
- Decisions: none
- Next: 0.13
- Blockers/risks: gh CLI not installed here, so branch protection could not be applied

### 2026-10-02 — 0.11 Testing harness — Blocked (Docker-dependent parts unverified)
- Type: new
- Changed: vitest.integration.config.ts, tests/integration/*, tests/factories, playwright.config.ts, tests/e2e/*; scripts test:integration, test:e2e
- Tests: unit 160/160 · integration 43/43 on PGlite (not Docker Postgres; no true concurrency) · e2e 14/14 DB-free (desktop+mobile, axe clean)
- Review: pending batch review
- Decisions: credential accounts must use account_id = user id (found by the integration run; fixed in owner bootstrap and factory)
- Next: 0.12
- Blockers/risks: Testcontainers startup, concurrent-connection behaviour and *.db.spec.ts need Docker

### 2026-10-02 — 0.10 Audit log — Blocked (integration waiting for Docker)
- Type: new
- Changed: src/modules/audit/*, src/lib/request-meta.ts; prisma AuditLog + migration add_audit_log
- Tests: unit 11/11; integration pending Docker
- Review: batch review pending
- Decisions: no FK from audit_logs.actor_id to users so the trail outlives accounts
- Next: 0.11
- Blockers/risks: none

### 2026-10-02 — 0.9 Outbox + background jobs — Blocked (integration proofs waiting for Docker)
- Type: new
- Changed: src/lib/outbox.ts, inbox.ts, events.ts, jobs/client.ts, jobs/functions.ts, src/app/api/inngest/route.ts; prisma OutboxEvent, ProcessedEvent + migration add_outbox
- Tests: unit 14/14; integration pending Docker
- Review: commerce-invariants-reviewer PASS; fixed 4 medium (batch poison isolation, status guards on updates, crash-loop terminal state, MATERIALIZED lease CTE) plus TRUNCATE guard and dispatched_at check
- Decisions: dispatcher leases rows, sends outside the transaction, Inngest event id = outbox id for de-duplication; handlers use runOnce
- Next: 0.10
- Blockers/risks: processed_events and dispatched outbox rows need a retention job later

### 2026-10-02 — 0.7/0.8 review gate — Done
- Type: fix
- Changed: auth.ts (linking off, staff social block, rate limits, no auto sign-in), users.role removed, owner bootstrap (lib/owner.ts, scripts/create-owner.ts), tests/lint/admin-guards.test.ts, safer next param, backup code acknowledgement
- Tests: unit 134/134 after fixes
- Review: code-reviewer found 2 high (Google skips staff TOTP, account-linking pre-hijack) and 5 medium; all addressed
- Decisions: social login is customer-only and unlinked until customer accounts work revisits it
- Next: 0.9
- Blockers/risks: none new

### 2026-10-01 — 0.8 Staff RBAC — Blocked (integration and E2E waiting for Docker)
- Type: new
- Changed: src/lib/permissions.ts, staff.ts, src/proxy.ts, src/app/admin/**, src/components/admin/*; prisma staff_members, role_permissions + migration add_staff_access (seeded grants)
- Tests: unit 21 new (permissions, staff, proxy); integration and E2E pending Docker
- Review: code-reviewer running
- Decisions: users.two_factor_enabled is the single source of truth for staff 2FA (staff_members.two_factor_enabled from DATA-MODEL dropped to avoid drift)
- Next: 0.9
- Blockers/risks: PPR means the admin layout gate redirects client-side after the shell streams; unauthenticated users get a true 307 from the proxy first

### 2026-10-01 — 0.7 Authentication core — Blocked (integration flow waiting for Docker)
- Type: new
- Changed: src/lib/auth.ts, auth-client.ts, email.ts, src/emails/auth.ts, src/app/api/auth/[...all]/route.ts; prisma users/sessions/accounts/verifications/two_factors + migration add_auth_tables
- Tests: unit 11/11; integration (sign up, verify, sign in, reset) pending Docker
- Review: pending batch review with 0.8
- Decisions: auth mail is sent directly by Better Auth callbacks, not through the outbox (no transaction, user can re-request); ADR to be added with 0.9
- Next: 0.8
- Blockers/risks: none beyond Docker

### 2026-10-01 — 0.6 Money and core utilities — Blocked (idempotency DB proof waiting for Docker)
- Type: new
- Changed: src/lib/money.ts, logger.ts, errors.ts, action-result.ts, idempotency.ts, ids.ts; prisma IdempotencyKey + migration add_idempotency_keys
- Tests: unit 94/94 (money 100% stmt/branch/func/line)
- Review: commerce-invariants-reviewer: no high. Fixed medium: idempotency keys namespaced per actor, TTL by DB clock (7 days), strict thousands-separator parsing, currency whitelist via Intl, int64 range check in money(), rate validation, MoneyError maps to VALIDATION
- Decisions: none
- Next: 0.7
- Blockers/risks: replay and concurrency tests for runIdempotent need Postgres

### 2026-10-01 — 0.2 Code quality tooling — Done
- Type: new
- Changed: eslint.config.mjs, eslint.boundaries.mjs, .prettierrc.json, .lintstagedrc.json, commitlint.config.mjs, .husky/*, tests/lint/*
- Tests: unit 17/17 fixture tests for layering (allowed and forbidden imports)
- Review: code-reviewer: boundaries test no longer writes into src/, internal module files and generated client classified
- Decisions: lib/db may be imported by services, queries and repositories (skill text updated)
- Next: 0.3
- Blockers/risks: eslint-plugin-boundaries 7.2 prints a deprecation warning for mode full (partialMatch false does not classify files)

### 2026-10-01 — 0.3 Environment config — Done
- Type: new
- Changed: src/lib/env/schema.ts, src/lib/env.ts, src/lib/env.client.ts, .env.example, next.config.ts
- Tests: unit 14/14; build fails with readable message when required vars missing (manual proof)
- Review: SKIP_ENV_VALIDATION honoured in env.ts; placeholder secret only rejected for non-local APP_URL in production
- Decisions: none
- Next: 0.4
- Blockers/risks: none

### 2026-10-01 — 0.4 Local infrastructure — Blocked (waiting for Docker)
- Type: new
- Changed: docker-compose.yml, scripts/db-reset.ts, prisma/seed.ts (stub), db:* scripts
- Tests: compose and scripts not executable without Docker
- Review: code-reviewer HIGH fixed: db-reset now checks DATABASE_URL and DIRECT_URL for local hosts; ports bound to 127.0.0.1; mailpit pinned to v1.31
- Decisions: none
- Next: 0.5
- Blockers/risks: verify with pnpm db:up once Docker Desktop is installed

### 2026-10-01 — 0.5 Database + Prisma baseline — Blocked (waiting for Docker)
- Type: new
- Changed: prisma/schema.prisma, prisma.config.ts, prisma/migrations/20261001230000_init_baseline, src/lib/db.ts, src/lib/ids.ts
- Tests: unit 3 (ids); integration pending Docker. Migration SQL applied cleanly on in-process PGlite as a syntax sanity check only
- Review: code-reviewer: placeholder URL for prisma generate, DB_POOL_MAX, generated-client boundary added
- Decisions: Prisma generates UUIDv7 ids (uuid(7)); no ADR needed
- Next: 0.6 (no DB needed)
- Blockers/risks: run pnpm db:up && pnpm db:migrate:deploy once Docker exists

### 2026-10-01 — 0.1 Project scaffold — Done
- Type: new
- Changed: package.json, pnpm-workspace.yaml (allowBuilds), tsconfig.json, next.config.ts, src/app, src/styles/globals.css, AGENTS.md (generated by Next)
- Tests: typecheck, lint, build green
- Review: code-reviewer pass on 0.1-0.5; findings fixed
- Decisions: none. better-auth pinned to 1.7.6 because pnpm 12 minimumReleaseAge rejects releases younger than 1 day (1.7.7)
- Next: 0.2
- Blockers/risks: Prisma warns Node 26 is not in its supported list (20.19+, 22.12+, 24+); works so far

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
