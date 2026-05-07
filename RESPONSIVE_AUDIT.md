# Responsive Audit — small + medium tiers

Date: 2026-05-07. Scope: Tailwind v4 breakpoint hygiene, mobile-first compliance, hierarchy hypothesis per surface, image / touch / safe-area exposure. **Constraint: xl tier (`@media (min-width: 64rem)`) must remain byte-identical.** This audit is read-only — no edits made yet.

Register from `PRODUCT.md`: **product** (declared explicitly). Brand register applies only to `/` landing and `/legal/*`.

## 1. Tailwind config

[app/globals.css:62-71](app/globals.css:62) — quoted verbatim:

```css
/*
 * Responsive layout: three tiers (mobile-first).
 * - Small (phones): default, viewport < 768px — unprefixed utilities
 * - Medium (tablets): `medium:` from 768px (48rem)
 * - XL (laptops): `xl:` from 1024px (64rem)
 * Default Tailwind breakpoints (sm/md/lg/2xl) are removed; only `medium:` and `xl:` exist.
 */
--breakpoint-*: initial;
--breakpoint-medium: 48rem;
--breakpoint-xl: 64rem;
```

- ✓ `medium` = 48rem (768px) — exact
- ✓ `xl` = 64rem (1024px) — exact
- ✓ `--breakpoint-*: initial` removes Tailwind's default `sm`/`md`/`lg`/`2xl`
- **Implication**: every `md:`/`sm:`/`lg:`/`2xl:` utility in the codebase is silent dead code that never matches any viewport. They ship in the bundle as unrecognized variants.

## 2. Prefix usage census

Counts (full-codebase grep, excluding TS object keys / CVA variant identifiers / unrelated `body_md:` JSON fields):

| Prefix | Status | Real utility-class occurrences |
|---|---|---|
| `medium:` | ✓ Primary | 459 |
| `xl:` | ✓ Desktop tier (untouchable) | 57 |
| `md:` | ✗ Dead code | **6 lines** |
| `sm:` | ✗ Dead code | **19 lines** |
| `lg:` | ✗ Dead code | **1 line** |
| `2xl:` | ✗ Dead code | 0 (false-positive in earlier scan) |

**False positives preserved (CVA / TS, do NOT touch):**
- [src/components/ui/button.tsx:29-30](src/components/ui/button.tsx:29) — `sm:` / `lg:` are CVA size variant keys
- [src/components/ui/sidebar.tsx:509-510](src/components/ui/sidebar.tsx:509) — same
- [src/components/ui/spotlight-card.tsx:17-19](src/components/ui/spotlight-card.tsx:17) — same
- [src/components/ui/grid-loader.tsx:21](src/components/ui/grid-loader.tsx:21) — TS object literal `{ sm: 28, md: 40, lg: 52 }`
- `body_md:` in admin broadcast schemas — TS field name

### Dead-code utility leaks (foundation PR will fix)

| File | Line | Class | Real meaning today (because prefix is dead) | Intended fix |
|---|---|---|---|---|
| [src/components/admin/billing/admin-trial-claims-actions.tsx](src/components/admin/billing/admin-trial-claims-actions.tsx) | 27 | `md:grid-cols-2` | Always 1-col | `medium:grid-cols-2` |
| [app/student/performance/student-performance-skeleton.tsx](app/student/performance/student-performance-skeleton.tsx) | 8 | `md:py-8` | Always `py-6` | `medium:py-8` |
| [app/student/loading.tsx](app/student/loading.tsx) | 9 | `md:grid-cols-2 xl:grid-cols-4` | 1-col, then jumps straight to 4 at xl | `medium:grid-cols-2 xl:grid-cols-4` |
| [app/student/reports/student-reports-skeleton.tsx](app/student/reports/student-reports-skeleton.tsx) | 8 | `md:py-8` | Always `py-6` | `medium:py-8` |
| [app/parent/loading.tsx](app/parent/loading.tsx) | 9 | `md:grid-cols-2` | Always 1-col | `medium:grid-cols-2` |
| [app/teacher/loading.tsx](app/teacher/loading.tsx) | 9 | `md:grid-cols-3` | Always 1-col | `medium:grid-cols-3` |
| [src/components/admin/billing/admin-plan-edit-form.tsx](src/components/admin/billing/admin-plan-edit-form.tsx) | 65 | `sm:grid-cols-2` | Always 1-col | `medium:grid-cols-2` |
| [src/components/admin/billing/admin-coupon-create-form.tsx](src/components/admin/billing/admin-coupon-create-form.tsx) | 123, 181, 217, 235 | 4× `sm:grid-cols-2` / `sm:col-span-2` | Always single-col | `medium:` equivalents |
| [src/components/admin/billing/admin-coupon-detail-form.tsx](src/components/admin/billing/admin-coupon-detail-form.tsx) | 126, 127, 169, 176, 189 | 5× `sm:` grid + col-span | Always single-col | `medium:` equivalents |
| [app/student/loading.tsx](app/student/loading.tsx) | 7 | `sm:px-4` (base `px-2`) | Always `px-2` — tighter than the real dashboard's `px-4 medium:px-6 xl:px-8` | Match dashboard rhythm: `px-4 medium:px-6 xl:px-8` |
| [app/parent/loading.tsx](app/parent/loading.tsx) | 7 | `sm:px-4` | Same | Same |
| [app/teacher/loading.tsx](app/teacher/loading.tsx) | 7 | `sm:px-4` | Same | Same |
| [app/student/performance/student-performance-skeleton.tsx](app/student/performance/student-performance-skeleton.tsx) | 13 | `sm:grid-cols-2 lg:grid-cols-3` | Always 1-col | `medium:grid-cols-2 xl:grid-cols-3` |
| [app/admin/(authenticated)/billing/plans/[code]/page.tsx](app/admin/(authenticated)/billing/plans/[code]/page.tsx) | 77 | `sm:flex-row sm:items-baseline sm:gap-4` | Always column | `medium:flex-row medium:items-baseline medium:gap-4` |
| [app/admin/(authenticated)/billing/subscriptions/[id]/page.tsx](app/admin/(authenticated)/billing/subscriptions/[id]/page.tsx) | 107 | Same | Same | Same |

**Worst offenders (visible regressions today):**
- The three role-portal loading skeletons (`student/parent/teacher loading.tsx`) stay 1-col forever → real dashboards then snap to 2/3/4 cols at `xl`. Visible layout pop.
- Admin coupon and plan forms stay single-column on big monitors — wasted screen real estate for power-user surfaces.

## 3. Mobile-first compliance

- ✓ Zero raw `@media (min-width:` queries
- ✓ Zero raw `@media (max-width:` queries
- ✓ Zero `[@media...]` arbitrary variants
- ✓ Two `@media (prefers-reduced-motion: reduce)` blocks, both correct ([app/globals.css](app/globals.css))
- ✓ Every `hidden ... medium:flex` / `hidden ... medium:block` use surveyed: 40 instances, all correct mobile-first cascades (drawer→sidebar, mobile-only toolbar, etc.)
- ✗ The dead-code prefixes above are the only mobile-first violations — and they're violations only in intent, not effect (since they don't fire). After the foundation PR they become actual mobile-first rules.

## 4. Per-surface inventory + hierarchy hypothesis

Surfaces are listed with their files, current `medium:` density, and the hierarchy decision the surface PR will validate via `/impeccable critique`. **Important (gets more real estate)** + **Trivial (gets less)** is the lens; the user's framing.

| # | Surface | Files | `medium:` rules today | `xl:` (untouchable) | Important | Trivial |
|---|---|---|---|---|---|---|
| 3a | **Doubt-chat** | [app/student/doubt-chat/page.tsx](app/student/doubt-chat/page.tsx), `src/components/student/doubt/*` | **0** (priority) | 0 | Chat input, AI response, attached image OCR | Timestamps, status pills, regenerate label, quota meter |
| 3b | **Shell** | [src/components/ui/sidebar.tsx](src/components/ui/sidebar.tsx), [src/components/student/student-top-bar.tsx](src/components/student/student-top-bar.tsx), [src/components/layout/app-header-brand-trail.tsx](src/components/layout/app-header-brand-trail.tsx), [src/components/layout/dashboard-shell.tsx](src/components/layout/dashboard-shell.tsx) | Many | Some | Active route signal, primary action | Brand trail decoration, secondary nav chips |
| 3c | **Landing** (brand) | [src/components/marketing/landing-marketing-body.tsx](src/components/marketing/landing-marketing-body.tsx), [src/components/marketing/landing-primary-cta-button.tsx](src/components/marketing/landing-primary-cta-button.tsx), `src/components/blocks/features-*.tsx` | 45+ | 8+ | Primary CTA, value-prop headline, schools-using-it social proof | Repeated feature-card decorations, footer chip rows |
| 3d | **Student dashboard** | [src/components/student/student-dashboard-view.tsx](src/components/student/student-dashboard-view.tsx), [src/components/student/dashboard-subject-card.tsx](src/components/student/dashboard-subject-card.tsx) | 20+ | 0 | "Continue practice" / next-action card, weak areas, current streak | Secondary stats, decorative subject-icon badges, hover-only chevrons |
| 3e | **Practice flow** | [src/components/student/practice/practice-rich-answer-editor.tsx](src/components/student/practice/practice-rich-answer-editor.tsx), `src/components/student/practice/*` | Some | 0 | Question stem, answer field, submit | Question metadata (test name, number), nav chrome, decorative pills |
| 3f | **Subscription / billing** | [app/student/subscription/page.tsx](app/student/subscription/page.tsx), [app/parent/(portal)/subscription/page.tsx](app/parent/(portal)/subscription/page.tsx), `src/components/student/subscription/*` | Some | 0 | Current plan, price, primary upgrade CTA | Plan-comparison feature decorations, FAQ links |
| 3g | **Auth** | [src/components/auth/auth-split-shell.tsx](src/components/auth/auth-split-shell.tsx), [src/components/auth/auth-studio-card.tsx](src/components/auth/auth-studio-card.tsx) | Some | 0 | The form, primary submit | Side panel marketing copy at `medium+` |
| 3h | **Reports / performance** | `src/components/student/reports/*`, [src/components/student/reports-pill-select.tsx](src/components/student/reports-pill-select.tsx) | Some | 0 | One trend, the worst weakness | Chart decorations, repeating filter pills |
| 3i | **Loading skeletons** | [app/student/loading.tsx](app/student/loading.tsx), [app/parent/loading.tsx](app/parent/loading.tsx), [app/teacher/loading.tsx](app/teacher/loading.tsx) | 0 (broken `md:`) | Some | Match the destination column count at every tier | n/a |
| 3j | **Parent / teacher portal sweep** | [src/components/parent/parent-shell.tsx](src/components/parent/parent-shell.tsx), `src/components/teacher/*` | Inherited | Inherited | Same as student | Same |

### Surfaces deliberately not in the table

Admin's 35+ pages, legal pages, error pages, and individual deeply-nested admin sub-screens. Reviewed — they inherit DashboardShell, don't have unique medium-tier hierarchy issues that warrant per-surface PRs. Admin forms get their `sm:`→`medium:` fix in the foundation PR; that's the only touch needed there.

## 5. Design tokens (will respect, not modify)

From [app/globals.css:7-72](app/globals.css:7):

- **Type scale (~12.5% larger than Tailwind defaults)**:
  ```
  --text-xs: 0.84375rem    --text-3xl: 2.109375rem
  --text-sm: 0.984375rem   --text-4xl: 2.53125rem
  --text-base: 1.125rem    --text-5xl: 3.375rem
  --text-lg: 1.265625rem   --text-6xl: 4.21875rem
  --text-xl: 1.40625rem
  --text-2xl: 1.6875rem
  ```
  Ratio between adjacent steps: ~1.187 (just under 1.2). Per `reference/product.md`, "tighter scale ratio" is correct for product UI; `≥1.25` from the user's spec is brand-register guidance and applies to landing only.

- **Radius scale**: `--radius: 0.625rem` plus 6-level derived (sm 0.375rem → 4xl 1.625rem)

- **Spacing**: default Tailwind scale (no `theme.extend.spacing`)

- **Container widths**: no global container utility; padding rhythm `px-4 medium:px-6 xl:px-8` ([dashboard-shell.tsx:66](src/components/layout/dashboard-shell.tsx))

- **Color tokens** (light): `--background oklch(1 0 0)`, `--foreground oklch(0.145 0 0)`, `--primary color-mix(in srgb, #2ea070 40%, white)` (soft mint), `--subject-grid-icon #2ea070` (full brand green for subject icons), `--link oklch(0.39 0.13 156)` (WCAG-AA compliant on white + tinted surfaces). All neutrals `oklch(? 0 0)` — pure greys. Dark theme inverted, plus a `.dark.auth-studio` Supabase-matched scope.

## 6. Touch / hover defects

- ✗ **Hover-only animation, no focus parity**: [src/components/marketing/landing-primary-cta-button.tsx:45](src/components/marketing/landing-primary-cta-button.tsx:45) — `group-hover:right-[calc(100%-36px)] group-hover:rotate-45`. Touch + keyboard users miss the affordance. Fix in 3c (landing).
- ✗ **Hover-only icon opacity change**: [src/components/student/dashboard-subject-card.tsx:652](src/components/student/dashboard-subject-card.tsx:652) — `opacity-80 group-hover/tile:opacity-100`. Fix in 3d (dashboard) — switch to `group-focus-within/tile:opacity-100` parity, or always-100 with subtler base treatment.
- ✗ **Mouse-only handlers**: [src/components/student/practice/practice-rich-answer-editor.tsx:104,129](src/components/student/practice/practice-rich-answer-editor.tsx:104) — `onMouseEnter` / `onMouseLeave` for cell selection. No touch fallback. Fix in 3e (practice) — replace with `onPointerEnter` / `onPointerLeave` so touch + stylus + mouse all work.

### `xs` button hit zones
[src/components/ui/button.tsx:28](src/components/ui/button.tsx:28) defines `xs: "h-6 ..."` (24px height). Below the 44×44px minimum. Where used, verify call-site has hit-zone padding (e.g., `after:absolute after:-inset-2`). Audit during 3e (most likely surface).

## 7. Image inventory

13 `<Image>` components, 1 `<img>` (animated WebP, correctly `loading="lazy"`), 0 `<picture>`.

**Missing `sizes` (foundation PR)**:

| File | Line | Rendered width | Suggested `sizes` |
|---|---|---|---|
| [src/components/ui/features.tsx](src/components/ui/features.tsx) | 120 | 28×28px static | `sizes="28px"` |
| [src/components/ui/demo.tsx](src/components/ui/demo.tsx) | 106 | 460px desktop, full mobile | `sizes="(min-width: 48rem) 460px, 100vw"` |
| [src/components/ui/demo.tsx](src/components/ui/demo.tsx) | 128 | Same | Same |
| [src/components/ui/acme-hero.tsx](src/components/ui/acme-hero.tsx) | 48 | 40×40 static, has `priority` | `sizes="40px"` |
| [src/components/ui/acme-hero.tsx](src/components/ui/acme-hero.tsx) | 127 | 36→40 responsive | `sizes="(min-width: 48rem) 40px, 36px"` |
| [src/components/ui/footer-7.tsx](src/components/ui/footer-7.tsx) | 126 | 32×32 static | `sizes="32px"` |

**Already correct** (kept for reference, no change):
- [src/components/auth/auth-studio-card.tsx:45](src/components/auth/auth-studio-card.tsx:45) — `sizes="(min-width: 768px) 480px, 0px"` ✓
- [src/components/auth/auth-split-shell.tsx:21](src/components/auth/auth-split-shell.tsx:21) — `sizes="40px"` ✓
- [src/components/layout/app-header-brand-trail.tsx:63](src/components/layout/app-header-brand-trail.tsx:63) — `sizes="28px"` ✓

**No `<picture>` art-direction needed today** — surveyed all hero images; same crop reads correctly across viewports.

## 8. Safe-area + viewport

- ✗ **No `viewport` export in [app/layout.tsx](app/layout.tsx)**. Next.js default omits `viewport-fit=cover` → `env(safe-area-inset-*)` resolves to 0 on iOS Safari with notches/Dynamic Island.
- ✗ **No safe-area handling on any fixed/sticky element**:
  - [src/components/ui/sidebar.tsx](src/components/ui/sidebar.tsx) — `position: fixed inset-y-0` at `medium+`; left edge can clip on iPhone with notch in landscape
  - [src/components/ui/sheet.tsx](src/components/ui/sheet.tsx) — `position: fixed z-50`, side-positioned
  - [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) — `fixed top-1/2 left-1/2` centered
  - [src/components/layout/skip-to-content.tsx](src/components/layout/skip-to-content.tsx) — `focus:fixed focus:left-4 focus:top-4`
- ✓ Sticky surfaces are parent-relative (table headers in [features.tsx](src/components/ui/features.tsx), separators in [select.tsx](src/components/ui/select.tsx)) — no safe-area concern.

**Plan**: foundation PR adds `viewport` export with `viewportFit: "cover"`; per-surface PRs (3a doubt-chat, 3b shell) add `pb-[max(...,env(safe-area-inset-bottom))]` and equivalents on the affected fixed elements via arbitrary Tailwind utilities — no new utility class.

## 9. Anti-pattern scan (per user's spec + PRODUCT.md anti-references)

Reviewed across landing + dashboard + subscription:

- ✓ No side-stripe accent borders detected
- ✓ No gradient text (`background-clip: text`) detected
- ✓ No glassmorphism as default surface
- ✓ No hero-metric template (giant number + label + gradient)
- ⚠ **Identical card grids** at `medium:` — most likely defect surface is feature-card grids in [features-8.tsx](src/components/blocks/features-8.tsx) and the subject grid in [dashboard-subject-card.tsx](src/components/student/dashboard-subject-card.tsx). To validate per surface via `/impeccable critique` (3c, 3d).
- ✓ No "modal as first thought" — modals are well-scoped (dialog, sheet are primitives; usage is appropriate).
- ⚠ **Em dashes in copy** — need a copy sweep. Will surface during per-surface PRs (low priority — does not block layout work).

## 10. Verification baseline (for diff guards)

The xl-untouched contract requires byte-identical `@media (min-width: 64rem)` rules + `xl:` utilities. Pre-edit grep for the executor:

```
git diff main -- '*.tsx' '*.ts' '*.css' | grep -nE '^[-+].*\b(xl:|@media \(min-width:\s*64rem)' || echo "xl untouched ✓"
```

After every commit: this command must print `xl untouched ✓` OR show only `+` lines (additions of new `xl:` rules are forbidden by the spec; should be empty).

---

## Summary

The codebase already has a strong responsive foundation: correct breakpoints, mobile-first cascades, no max-width queries. The work splits into:

1. **Foundation (low-risk, mechanical, single PR)**: 26 dead-code prefix rewrites, `viewport` export with `viewportFit: cover`, 6 `<Image> sizes` additions.
2. **Hierarchy reshape (per surface, 10 PRs)**: validate the `Important / Trivial` table per surface via `/impeccable critique`, give important content more visual weight at base + medium, demote trivial elements, attach safe-area + hover/touch fixes to the surface that owns them. xl tier byte-identical.

Doubt-chat (zero `medium:` rules today) is the highest-leverage surface to land first; landing + dashboard are the next two by traffic. All decisions on doubt-chat tablet behavior already resolved (full-bleed, line-length cap 65–75ch, slightly larger input, demoted metadata, safe-area on fixed input).

DESIGN.md is missing — running `/impeccable document` after this PR series would generate it from the resulting cleaner code, which is a better moment than now.
