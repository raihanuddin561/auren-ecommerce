---
name: auren-brand
description: "AUREN's brand, visual language and premium-quality bar. Use for ANY AUREN UI work (storefront page, component, email template, admin screen, OG image, copywriting). It REPLACES the generic `brand-guidelines` skill (that one is Anthropic's brand and must never be applied to AUREN). Takes precedence over palettes/styles suggested by `ui-ux-pro-max` or `theme-factory`."
---

# AUREN Brand and Premium Bar

Source of truth: `docs/design/DESIGN-SYSTEM.md`. Read the relevant section before designing. This skill is the short version plus the review checklist.

## Brand in one line
Modern, refined menswear. Quiet confidence. **Premium = restraint + precision + speed.**

## Hard rules (never break)
1. **Tokens only.** Colors, type, spacing, radius and motion come from `src/styles/globals.css` `@theme`. No raw hex values and no arbitrary Tailwind values (`text-[#...]`, `p-[13px]`) unless the token is genuinely missing. If one is missing, add it to the theme first.
2. **Palette:** ink `#0F0F0F`, ivory `#F6F2EB` page background, paper `#FFFFFF` surfaces, warm stone neutrals, gold `#A8875A` **accent only** (focus ring, active underline, small badges, never large fills or body text), oxblood `#5A1F24` rare.
3. **Type:** serif display (Cormorant Garamond) for headings and editorial; Manrope for UI and body; `tabular-nums` for prices. Eyebrow labels: 11–12 px uppercase, 0.18em tracking.
4. **Shape:** radius 0–2 px (pills only for filter chips). Borders over shadows. Product imagery is always **4:5**.
5. **Space:** generous. Section rhythm `py-20 md:py-32`. When unsure, add whitespace instead of a divider or a box.
6. **Motion:** `--ease-auren` `cubic-bezier(0.22,1,0.36,1)`, 150–800 ms; reveal once; no bouncy springs, no auto-advancing text carousels, no parallax on mobile; honor `prefers-reduced-motion`.
7. **Voice:** short, assured, sensory ("Woven from breathable Egyptian cotton."). No exclamation marks, no ALL-CAPS shouting, no fake urgency, no emoji in storefront copy. Use the British/international spelling already in the docs ("colour" in copy is fine, but be consistent within a screen).
8. **Every state designed:** loading (skeleton matching final layout, zero CLS), empty, error, disabled, hover, focus-visible (2 px gold ring, 2 px offset), active.
9. **Speed is part of the brand:** LCP image `priority` with correct `sizes`; no client JS where a Server Component works; no layout shift.
10. **Accessibility:** WCAG 2.2 AA contrast, 44 px touch targets, keyboard paths, alt text on every product image.

## Premium review checklist (run before marking any UI done)
- [ ] Would this sit comfortably next to a luxury menswear house's site? If it looks "template", simplify and enlarge imagery and type.
- [ ] One clear focal point and one primary action per viewport.
- [ ] Typography hierarchy readable at a glance (display serif → eyebrow → body); line length ≤ 75 ch.
- [ ] Alignment on the 12/4-column grid; consistent gutters; no orphaned elements.
- [ ] Images 4:5, consistent crops, placeholders use the dominant colour.
- [ ] Motion feels calm; nothing jumps; reduced-motion verified.
- [ ] Mobile (375 px), tablet (768 px), desktop (1440 px) all intentional, not just "stacked".
- [ ] Copy follows the voice rules; prices formatted via `lib/money.ts`.
- [ ] All states present; skeletons match the final layout.
- [ ] Lighthouse/axe pass for the page.

## Admin console variant
Same tokens, denser layout: 14 px body, compact tables, light/dark themes, sans-only headings except the wordmark. Calm over flashy, with fast keyboard flows.

## Email templates (React Email)
Ivory background, centered 600 px column, serif headline, ink button with 0 radius, product images 4:5, plain-text fallback, no web fonts relied on for meaning.
