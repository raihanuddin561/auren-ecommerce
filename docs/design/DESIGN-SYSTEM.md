# AUREN — Brand and Design System

> Goal: every page should feel like a luxury menswear house: quiet confidence, editorial imagery, generous space, precise typography, motion that feels considered rather than flashy.
> **Rule: premium = restraint + precision + speed.** A slow or janky page never feels premium, however beautiful it is.

---

## 1. Brand foundation

| | |
|---|---|
| **Name** | AUREN, from *aurum* (gold): quiet, timeless value |
| **Positioning** | Modern, refined menswear: elevated essentials and tailoring |
| **Personality** | Confident · Understated · Crafted · Modern · Warm |
| **Voice** | Short, assured sentences. No exclamation marks, no "hurry!!" urgency. "Crafted in breathable Egyptian cotton." not "AMAZING SHIRT SALE!!!" |
| **Wordmark** | `AUREN`: uppercase, wide tracking (0.32em), high-contrast serif or custom logotype. Monogram `A` for favicon/app icon/packaging |

---

## 2. Design tokens (Tailwind v4 `@theme` in `src/styles/globals.css`)

### 2.1 Color

Storefront is **light-first** (ivory, ink, gold) with **dark editorial sections** for drama. Admin supports light and dark.

| Token | Hex | Use |
|---|---|---|
| `--color-ink` | `#0F0F0F` | Primary text, primary buttons, dark sections |
| `--color-ink-soft` | `#2A2A2A` | Secondary dark surfaces |
| `--color-ivory` | `#F6F2EB` | Page background (warm, not stark white) |
| `--color-paper` | `#FFFFFF` | Cards, drawers, inputs |
| `--color-stone-100…900` | `#EFEBE4 … #3D3A35` | Warm neutral scale: borders, muted text, skeletons |
| `--color-gold` | `#A8875A` | **Accent only**: active states, underlines, badges, focus ring. Never large fills |
| `--color-gold-soft` | `#D9C7A6` | Hover tints, dividers on dark |
| `--color-oxblood` | `#5A1F24` | Rare secondary accent (limited drops, sale) |
| `--color-success` | `#3F6B4E` | |
| `--color-warning` | `#9A6B1F` | Low stock |
| `--color-danger` | `#9B2C2C` | Errors |

All text/background pairs must pass **WCAG AA (4.5:1)**. Gold on ivory is decorative only and never used for body text.

### 2.2 Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | **Cormorant Garamond** (free) → upgrade path: *Canela* / *Ogg* (licensed) | High-contrast serif, editorial |
| UI / body | **Manrope** | Clean geometric sans with excellent legibility |
| Numerals (prices, admin) | Manrope `tabular-nums` | Aligned prices |

Fluid scale (`clamp`), with mobile → desktop sizes:

| Token | Size | Use |
|---|---|---|
| `display-xl` | 44 → 96 px, serif, -0.02em, light | Hero |
| `display-lg` | 36 → 64 px | Section openers |
| `h1` | 30 → 44 px serif | Page titles, PDP title |
| `h2` | 24 → 32 px serif | |
| `h3` | 18 → 22 px sans, medium | |
| `body` | 15 → 16 px sans, 1.65 line-height | |
| `small` | 13 px | Meta |
| `eyebrow` | 11 → 12 px sans, uppercase, 0.18em tracking | Labels above headings, nav |

### 2.3 Space, layout, shape

- 4-px base spacing; section rhythm `py-20 md:py-32` (generous whitespace = luxury).
- Container max 1440 px; editorial content max 720 px; gutters 20 px mobile / 40 px desktop.
- 12-column grid desktop, 4-column mobile.
- **Radius: 0–2 px** (sharp, tailored). Pills only for filter chips.
- Shadows: almost none. Use borders (`stone-200`) and layered surfaces. One soft shadow for drawers/popovers.
- Product image ratio **4:5** everywhere (consistency = premium).

### 2.4 Motion

| Token | Value |
|---|---|
| `--ease-auren` | `cubic-bezier(0.22, 1, 0.36, 1)` (soft ease-out) |
| `--dur-fast` / `base` / `slow` / `reveal` | 150 / 250 / 450 / 800 ms |

Principles: fade + 8–16 px rise on scroll reveal (once only); image hover = slow 1.04 scale over 800 ms or swap to second image with crossfade; drawers slide with ease-auren; page transitions via View Transitions API (shared element: product card image → PDP gallery). **Respect `prefers-reduced-motion`** (motion turns into instant opacity changes). No parallax on mobile. No auto-playing carousels with text.

### 2.5 Iconography and imagery

- Icons: Lucide at 1.25 px stroke, 20 px default. Thin and quiet.
- **Photography guideline (business deliverable, not code):** consistent warm-neutral backdrop; 4:5 crop; ≥ 2400 px long edge; per product **6–8 images**: front on model, back, side, detail macro (fabric, buttons, stitching), flat lay, lifestyle; color-accurate (calibrated); same model height and pose language per category; model height and size worn noted ("Model is 183 cm, wears M"). Campaign/lookbook: editorial lighting, 16:9 + 4:5 + 9:16 crops for art direction.

---

## 3. Component library (`src/components/ui` + `storefront`)

Primitives (shadcn/Radix restyled): Button (primary ink, secondary outline, ghost, link-underline-gold), IconButton, Input, Select, Combobox, Checkbox, Radio, Switch, Textarea, Sheet/Drawer, Dialog, Popover, Tooltip, Accordion, Tabs, Toast, Skeleton, Badge, Breadcrumb, Pagination, Price, Rating, Spinner (rare; prefer skeletons).

Storefront: AnnouncementBar, Header (transparent-over-hero → solid on scroll), MegaMenu (with editorial image tile), SearchOverlay (instant results + popular searches), CartDrawer (free-shipping progress bar), ProductCard, ProductGrid, FilterBar + FilterDrawer, SortMenu, ColorSwatches, SizeSelector, SizeGuideDrawer, ProductGallery (zoom/lightbox), StickyBuyBar (mobile), QuantityStepper, DeliveryEstimate, TrustRow, ReviewSummary + ReviewList + FitMeter, ProductRail, CollectionHero, EditorialSplit, LookbookHotspot, NewsletterForm, Footer, EmptyState, RecentlyViewed.

Every component ships with **loading (skeleton), empty, error, and disabled** states, keyboard support and visible focus (2 px gold ring offset 2 px).

---

## 4. Page specifications

### 4.1 Global
- **Announcement bar** (CMS, rotating max 3, pausable): "Complimentary delivery over ৳5,000 · Easy size exchange".
- **Header**: left nav (Shop, New, Collections, Lookbook, Journal), centered wordmark, right (search, account, wishlist, bag count). Transparent over hero, ivory with hairline border after 80 px scroll. Mobile: hamburger → full-screen menu with large serif links and category images.
- **Footer**: newsletter ("Receive early access to new collections"), link columns, social, payment marks, store info, country/currency.
- **WhatsApp / Messenger concierge** floating button (subtle, bottom-right, hides on checkout).

### 4.2 Landing / Home (all sections CMS blocks, reorderable)
1. **Hero**: full-bleed campaign image/video (art-directed per breakpoint), serif headline, one CTA ("Explore the Collection"). Video: muted, poster frame = LCP image.
2. **New Arrivals rail**: horizontal scroll, 4 visible desktop / 1.5 mobile.
3. **Category tiles**: Shirts · Trousers · Tailoring · Knitwear · Polos · Accessories, as tall image tiles with eyebrow labels.
4. **Featured collection split**: 50/50 image + story + CTA.
5. **Editorial story / craftsmanship** (dark ink section): fabric, fit, details, with macro imagery.
6. **Bestsellers grid.**
7. **Lookbook teaser** with shoppable hotspots.
8. **Social proof**: review quotes with ratings, press logos if any.
9. **Journal teaser** (SEO content).
10. **UGC / Instagram grid.**
11. **Service promise row**: delivery, exchange, secure payment, concierge.

### 4.3 Shop / Category / Collection (PLP)
- Editorial header (title, short copy, optional hero image), breadcrumb.
- Sticky filter bar: Filter button (count) · quick chips (Size, Color, Fit) · Sort · grid density toggle (2/3/4 desktop, 1/2 mobile).
- Filter drawer: Size, Color (swatches), Fit, Fabric, Occasion, Price range, In stock. Selections reflected in URL.
- **ProductCard**: 4:5 image → second image on hover (desktop); color swatches (switch card image); title, price (compare-at struck-through in stone); badges "New", "Limited", "Low stock"; desktop hover reveals **quick-add size row**; wishlist heart.
- "Load more" + crawlable pagination links; scroll position restored on back.
- Empty filter state: "No pieces match these filters" + clear-filters CTA + suggestions.

### 4.4 Product detail (PDP), the most important page
- **Desktop**: left 60 % stacked gallery (scroll), right 40 % **sticky buy box**. **Mobile**: swipe gallery with progress dots, pinch-zoom, tap → full-screen lightbox.
- Buy box: eyebrow (collection), serif title, price, rating summary (link to reviews), color swatches with name, **size selector** (unavailable sizes struck, "Only 2 left" warning, "Notify me" for OOS), **Size guide** drawer (chart + how to measure + model info + "Find my size" helper from height/weight), fit feedback meter ("Runs true to size: 82 %"), **Add to bag** (full-width ink) + wishlist, delivery estimate by area, trust row (exchange policy, secure payment, COD available).
- Accordions: Details & fit · Fabric & care · Delivery & returns.
- **Complete the look** (curated), **You may also like**, **Recently viewed**.
- Reviews: photo reviews first, filter by size/rating, verified badge.
- Mobile **sticky add-to-bag bar** appears once the main button scrolls out of view.
- After add to bag: cart drawer opens with item, upsell row, and free-shipping progress.

### 4.5 Cart (drawer + page)
Line items with image, variant, qty stepper, remove (with undo toast), save for later → wishlist, discount code field, subtotal, shipping estimate, free-shipping progress, express checkout CTA, trust marks.

### 4.6 Checkout (distraction-free layout: wordmark only, no nav)
- One page, mobile-first, **guest checkout default**, login optional.
- Sections: Contact (phone first for primary market, email optional/required per settings) → Delivery address (Division → District → Thana/Area pickers; saved addresses for logged-in) → Delivery method (zone rates + ETA) → Payment (COD, bKash/Nagad/Card via SSLCommerz, Stripe for international) → Review & place order.
- Right column (collapsible on mobile): order summary, discount code, totals breakdown.
- Inline validation, no page reloads, preserved state on refresh, clear error recovery for failed payments ("Payment didn't go through. Your bag is saved. Try again or choose Cash on Delivery.").

### 4.7 Order confirmation
Serif "Thank you, {name}", order number, a concierge line ("Our team will personally confirm your order shortly, usually within 2 hours."), **visual timeline** (Placed → Verified → Shipped → Delivered), items, address, payment, "Create an account to track orders" (pre-filled), and an editorial "Style it with" rail.

### 4.8 Account
Overview · Orders (status timeline + courier tracking link) · Returns & exchanges (self-service request) · Addresses · Wishlist · Profile & preferences (sizes, marketing consent) · Store credit balance.

### 4.9 Search
Overlay with instant results (products + collections + suggestions); full results page with the same filters as PLP; typo tolerance; "no results" state with popular items.

### 4.10 Content pages
Lookbook (full-bleed editorial, shoppable hotspots), Journal (editorial article layout, 720 px measure, related products inline), About / Our Story, Size Guide hub, Shipping, Returns & Exchange, FAQ, Contact, Privacy, Terms. **404**: editorial image + "This page has stepped out" + search + bestsellers.

### 4.11 Admin console
Calm, data-dense, consistent: left sidebar, top bar with **⌘K command palette**, global search (orders by number/phone, products by SKU). Dashboard KPIs: today's/period net sales, orders, AOV, conversion, **net profit**, gross margin %, pending confirmations, to-ship count, low stock, RTO rate. Tables: TanStack with saved views, bulk actions, CSV export. Forms autosave drafts. Every destructive action needs confirmation, and important ones offer undo.

**Order verification queue** (`/admin/orders/verification`), the most-used staff screen:
- Split view: queue list on the left (age timer in gold → oxblood when SLA is breached, risk chips, payment badge, assignee avatar) and the order workspace on the right.
- Workspace: customer card with order history and risk flags; items with size/colour swap inline; address with area serviceability check; payment status; **verification checklist**; one-click call / SMS / WhatsApp with templates; attempt history.
- Primary actions in a sticky footer: **Confirm order** (enabled only when the checklist is complete), **Call back later** (time picker), **Edit order**, **Cancel** (reason required).
- Keyboard flow: `J/K` next/previous order, `C` confirm, `H` hold, `X` cancel. Filters: mine, unassigned, on hold, overdue, high risk, prepaid.

---

## 5. Accessibility checklist (per component/page)
Semantic landmarks · one H1 per page · alt text required for all product media · keyboard navigable menus/drawers with focus trap & return · 44 px min touch targets · color is never the only signal (size availability uses strike + label) · form errors announced (aria-live) · `prefers-reduced-motion` honored · automated axe checks in Playwright.
