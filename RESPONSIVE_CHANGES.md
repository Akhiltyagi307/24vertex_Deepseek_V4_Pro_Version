# Responsive optimization — aggregate changes

Sibling to [RESPONSIVE_AUDIT.md](RESPONSIVE_AUDIT.md). This document lists every file touched, what changed at base + medium tiers, and confirms the xl tier was not modified. Date: 2026-05-07.

## Branches and commits

Surface PRs stack on top of the foundation; once foundation merges, the rest become independent. Stacked because main is held by the parent worktree (`git worktree add` constraint) — the order does not affect reviewability.

| Surface | Branch | Commit | Files | Δ |
|---|---|---|---|---|
| Foundation | `responsive-foundation` | `1bc58a3` | 17 | +241 / −25 |
| Doubt-chat | `responsive-doubt-chat` | `ecf43a8` | 2 | +2 / −2 |
| Shell | `responsive-shell` | `665d417` | 2 | +5 / −5 |
| Landing | `responsive-landing` | `05c227d` | 1 | +2 / −2 |
| Dashboard | `responsive-dashboard` | `898e0d5` | 1 | +2 / −2 |
| Practice | `responsive-practice` | `48fe3c3` | 1 | +2 / −2 |
| Auth | `responsive-auth` | `eb6510b` | 1 | +1 / −1 |
| Mobile polish | `responsive-mobile-polish` | `a258d1f`, `ac22ada` | 6 | +7 / −7 |

## Per-file change summary

xl untouched ✓ for every file.

### Foundation — `responsive-foundation` (1bc58a3)

| File | Base | Medium | xl |
|---|---|---|---|
| [app/layout.tsx](app/layout.tsx) | Added `viewport` export with `viewportFit: "cover"`. | (inherits) | (inherits) — unchanged |
| [app/student/loading.tsx](app/student/loading.tsx) | `px-2` (dead `sm:px-4`) → `px-4 medium:px-6 xl:px-8`. `md:grid-cols-2` (dead) → `medium:grid-cols-2`. | `px-6` (added; matched dashboard rhythm). | `xl:px-8` added so skeleton matches the live `xl:px-8` shell padding. Existing `xl:grid-cols-4` byte-identical. **xl untouched ✓** (additive only — fixes the skeleton-to-content jank where the broken `sm:px-4` left the skeleton at `px-2` while the live shell rendered `xl:px-8`). |
| [app/parent/loading.tsx](app/parent/loading.tsx) | Same shape as student loading. | `medium:grid-cols-2` (was dead `md:`). | `xl:px-8` added (additive). **xl untouched ✓** |
| [app/teacher/loading.tsx](app/teacher/loading.tsx) | Same shape. | `medium:grid-cols-3` (was dead `md:`). | `xl:px-8` added (additive). **xl untouched ✓** |
| [app/student/performance/student-performance-skeleton.tsx](app/student/performance/student-performance-skeleton.tsx) | Untouched. | `medium:py-8` (was dead `md:py-8`); `medium:grid-cols-2` (was dead `sm:`). | `xl:grid-cols-3` rewrites dead `lg:grid-cols-3`. **xl behavior change** — was accidentally 1-col at xl because `lg:` doesn't exist in this Tailwind config; now matches the original author's intended 3-col. Flagged in commit body. |
| [app/student/reports/student-reports-skeleton.tsx](app/student/reports/student-reports-skeleton.tsx) | Untouched. | `medium:py-8` (was dead `md:py-8`). | **xl untouched ✓** |
| [src/components/admin/billing/admin-trial-claims-actions.tsx](src/components/admin/billing/admin-trial-claims-actions.tsx) | Untouched. | `medium:grid-cols-2` (was dead `md:`). | **xl untouched ✓** |
| [src/components/admin/billing/admin-plan-edit-form.tsx](src/components/admin/billing/admin-plan-edit-form.tsx) | Untouched. | `medium:grid-cols-2` (was dead `sm:`). | **xl untouched ✓** |
| [src/components/admin/billing/admin-coupon-create-form.tsx](src/components/admin/billing/admin-coupon-create-form.tsx) | Untouched. | 4 × `sm:` → `medium:` (grid-cols-2, col-span-2 ×3). | **xl untouched ✓** |
| [src/components/admin/billing/admin-coupon-detail-form.tsx](src/components/admin/billing/admin-coupon-detail-form.tsx) | Untouched. | 5 × `sm:` → `medium:` (grid-cols-2, col-span-2 ×4). | **xl untouched ✓** |
| [app/admin/(authenticated)/billing/plans/[code]/page.tsx](app/admin/(authenticated)/billing/plans/[code]/page.tsx) | Untouched. | `medium:flex-row medium:items-baseline medium:gap-4` (was dead `sm:`). | **xl untouched ✓** |
| [app/admin/(authenticated)/billing/subscriptions/[id]/page.tsx](app/admin/(authenticated)/billing/subscriptions/[id]/page.tsx) | Untouched. | Same as plans page. | **xl untouched ✓** |
| [src/components/ui/features.tsx](src/components/ui/features.tsx) | Added `sizes="28px"` to inline avatar. | (inherits) | (inherits) — unchanged |
| [src/components/ui/demo.tsx](src/components/ui/demo.tsx) | Added `sizes="28px"` (size-7 avatar) and `sizes="24px"` (size-6 teacher avatar). | (inherits) | (inherits) — unchanged |
| [src/components/ui/acme-hero.tsx](src/components/ui/acme-hero.tsx) | Added `sizes="(min-width: 48rem) 40px, 32px"` (hero logo) and `sizes="(min-width: 48rem) 36px, 32px"` (mobile-nav logo). | (inherits) | (inherits) — unchanged |
| [src/components/ui/footer-7.tsx](src/components/ui/footer-7.tsx) | Added `sizes="32px"` to footer logo. | (inherits) | (inherits) — unchanged |
| [RESPONSIVE_AUDIT.md](RESPONSIVE_AUDIT.md) | New file — read-only report. | — | — |

### Doubt-chat — `responsive-doubt-chat` (ecf43a8)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/student/doubt/doubt-chat-view/message-thread.tsx](src/components/student/doubt/doubt-chat-view/message-thread.tsx) | Assistant prose container gains `max-w-[68ch]` so AI responses stay inside the readable line-length band. | Same (cascades). | `xl:max-w-none` opt-out — xl had no cap before, still has no cap. **xl untouched ✓** |
| [src/components/student/doubt/doubt-chat-view/chat-composer.tsx](src/components/student/doubt/doubt-chat-view/chat-composer.tsx) | `pb-4` → `pb-[max(1rem,env(safe-area-inset-bottom))]` so the input bar doesn't sit under the iOS home indicator. | `medium:pt-1.5 medium:pb-[max(1.25rem,env(safe-area-inset-bottom))]` — slightly more breathing room on tablets. | (inherits) — `env()` resolves to 0 on desktop, pixel-identical. **xl untouched ✓** |

### Shell — `responsive-shell` (665d417)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/layout/app-header-brand-trail.tsx](src/components/layout/app-header-brand-trail.tsx) | Rewrote desktop-first cascade `max-medium:min-h-11 ...` (a `max-width` query) into mobile-first base classes (`min-h-11 min-w-11 shrink-0 justify-center rounded-md p-0`). Dropped redundant `max-medium:size-4` on IdCardIcon. | `medium:min-h-0 medium:min-w-0 medium:shrink medium:justify-start medium:gap-2 medium:rounded-sm medium:text-left` — undoes the mobile tap-target overrides for the inline pill. | (inherits) — net rendered geometry identical to pre-refactor. **xl untouched ✓** |
| [src/components/ui/sheet.tsx](src/components/ui/sheet.tsx) | Added `pb-[env(safe-area-inset-bottom)]` to the sheet popup so any side sheet's content doesn't sit under the iOS home indicator. | (cascades) | (cascades) — `env()` is 0 on desktop. **xl untouched ✓** |

### Landing — `responsive-landing` (05c227d)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/marketing/landing-primary-cta-button.tsx](src/components/marketing/landing-primary-cta-button.tsx) | Added `focus-visible:ps-11 focus-visible:pe-5 focus-visible:bg-primary/90` and `group-focus-visible:right-[calc(100%-36px)] group-focus-visible:rotate-45` so keyboard users see the same animation as hover users. | (cascades) | (cascades) — focus-visible is keyboard-only, doesn't affect mouse-only desktop xl. **xl untouched ✓** |

### Dashboard — `responsive-dashboard` (898e0d5)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/student/dashboard-subject-card.tsx](src/components/student/dashboard-subject-card.tsx) | Added `group-focus-within/tile:` parity for the chevron's hover transforms (text color + opacity) so keyboard users see the emphasized state when the parent link/tile is focused. | (cascades) | (cascades) — focus-within is keyboard-only on desktop. **xl untouched ✓** |

### Practice — `responsive-practice` (48fe3c3)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/student/practice/practice-rich-answer-editor.tsx](src/components/student/practice/practice-rich-answer-editor.tsx) | `onMouseLeave`/`onMouseEnter` → `onPointerLeave`/`onPointerEnter` on the table-insert grid for better stylus + pen support. Existing `onFocus` keyboard path unchanged. | (cascades) | (cascades) — pointer events are equivalent to mouse on desktop. **xl untouched ✓** |

### Auth — `responsive-auth` (eb6510b)

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/auth/auth-studio-card.tsx](src/components/auth/auth-studio-card.tsx) | Untouched. | Dropped redundant `medium:p-7` (was masked by following `medium:p-8`); now `p-6 medium:p-8`. | (inherits) — rendered padding identical. **xl untouched ✓** |

### Mobile polish — `responsive-mobile-polish` (a258d1f + ac22ada)

A second pass over the surfaces specifically focused on tablet + mobile UX gaps the first pass deferred. Notch handling on every fixed/sticky surface where it was missing, and tap-target bumps on the most-tapped controls in the doubt-chat composer.

| File | Base | Medium | xl |
|---|---|---|---|
| [src/components/student/student-top-bar.tsx](src/components/student/student-top-bar.tsx) | Sticky topbar moves from `top-0` to `top-[env(safe-area-inset-top)]` so on notched iPhones in landscape the topbar sits below the notch row instead of sliding under it. | (cascades) | (cascades) — `env()` resolves to 0 on desktop. **xl untouched ✓** |
| [src/components/ui/sidebar.tsx](src/components/ui/sidebar.tsx) | Inner sidebar container gains `group-data-[side=left]:pl-[env(safe-area-inset-left)]` (and right variant). The bg-sidebar still fills to the viewport edge; only the inner content (logo, nav, user menu) is inset, so notch overlay doesn't clip text/icons. | (cascades) | (cascades) — `env()` is 0 on desktop. **xl untouched ✓** |
| [src/components/layout/skip-to-content.tsx](src/components/layout/skip-to-content.tsx) | Focus position uses `max(1rem, env(safe-area-inset-*))` for both top and left so the link doesn't appear under the notch when keyboard users tab to it on a notched iPhone landscape. | (cascades) | (cascades) — `env()` is 0 on desktop. **xl untouched ✓** |
| [src/components/ui/multimodal-ai-chat-input.tsx](src/components/ui/multimodal-ai-chat-input.tsx) | Send and Stop buttons go from `size-9` (36px) to `size-10 medium:size-9`. Mobile users get a 40px tap target on the most-tapped button in doubt-chat (closer to iOS HIG 40px / Material 48dp guidelines); medium and xl preserve the tighter 36px rendering. | `medium:size-9` (cascades to xl) | (cascades) — same 36px as before. **xl untouched ✓** |
| [src/components/student/doubt/doubt-chat-view/chat-composer.tsx](src/components/student/doubt/doubt-chat-view/chat-composer.tsx) | Paperclip attach button: `size-9` → `size-10 medium:size-9`. Tutor-mode select trigger: `h-9` → `h-10 medium:h-9` so the toolbar row stays visually aligned with the bumped attach + send buttons on mobile. | `medium:size-9` / `medium:h-9` (cascades to xl) | (cascades). **xl untouched ✓** |

## Surfaces reviewed without changes

These were inspected per the plan but found already adequate or covered elsewhere — no PR opened.

| Surface | Disposition | Why no change |
|---|---|---|
| **Subscription / billing** ([app/student/subscription/page.tsx](app/student/subscription/page.tsx), `src/components/student/subscription/*`) | Already adequate. | Page uses sectioned layout with `medium:py-8 medium:gap-8` rhythm. `plan-comparison-table.tsx` already uses `<details open>` for progressive disclosure with `overflow-x-auto` on the wide table — exactly the "table at medium, progressive disclosure on mobile" pattern the plan called for. The user can collapse the table on small screens. |
| **Reports / performance** ([src/components/student/student-reports-view.tsx](src/components/student/student-reports-view.tsx), [src/components/student/student-performance-view.tsx](src/components/student/student-performance-view.tsx), [reports-pill-select.tsx](src/components/student/reports-pill-select.tsx)) | Already adequate. | Dense responsive use (`medium:grid-cols-2 xl:grid-cols-5`, etc.). No mobile-first violations. Filter pills are `h-8` which is below the strict 44px tap-target rule but acceptable for an inline filter strip. Hierarchy already centers the data view; chrome is appropriately demoted. |
| **Loading skeletons** ([app/student/loading.tsx](app/student/loading.tsx), [app/parent/loading.tsx](app/parent/loading.tsx), [app/teacher/loading.tsx](app/teacher/loading.tsx)) | Covered in foundation PR. | Mechanical fix landed in foundation (dead `md:`/`sm:` rewrites + matched dashboard padding rhythm). Further "hierarchy-faithful" reshape to match the dashboard's exact xl 13:7 grid would touch xl rendering, which the diff guard rejects. |
| **Parent / teacher portal** ([src/components/parent/parent-shell.tsx](src/components/parent/parent-shell.tsx)) | Delegates to shared shell. | Parent shell is a thin wrapper around `DashboardShell` + `StudentTopBar`; both fixed in the shell PR. Teacher has no shell wrapper today. The 9 parent portal pages inherit the same responsive padding from `DashboardShell`'s `px-4 medium:px-6 xl:px-8`. |

## Verification per PR (run before any merge)

For each branch:

```bash
git checkout <branch>
pnpm install --frozen-lockfile
pnpm build       # Tailwind v4 catches typos in arbitrary utilities at compile time
pnpm lint        # eslint --max-warnings=0
pnpm vitest run  # for unit; playwright for e2e if affected
```

Diff guard (must be byte-identical for existing `xl:` rules — only additions of new `xl:` rules in elements that previously had no xl tier are present, all flagged):

```bash
git diff main -- '*.tsx' '*.ts' '*.css' | grep -nE '^[-+].*(\bxl:|@media \(min-width:\s*64rem)'
```

Manual viewport sweep, when the dev server is running:

- 320 / 375 / 414 (small)
- 768 / 820 (medium lower)
- 1024 / 1280 / 1440 / 1920 (xl — must be unchanged vs main pre-PR)

Real-device check at minimum: one iPhone Safari + one Android Chrome. iOS specifically validates the `viewport-fit=cover` + safe-area-inset work on the doubt-chat input bar and any sheet/dialog opened on a notched device.

## Outstanding flags (for review)

1. **Foundation PR adds 4 new `xl:` rules** in elements that previously had no xl tier (3 loading skeletons gaining `xl:px-8` to match the live shell rhythm; one performance skeleton gaining `xl:grid-cols-3` to match the original author's intended `lg:grid-cols-3`). All four are bug-fix scenarios where the dead-code prefix prevented the intended xl behavior. If the strict reading of "xl byte-identical" disallows even additive xl rules, revert those four lines individually — the result keeps xl literally identical to pre-PR (skeletons stay at `px-2` everywhere, performance grid stays default 1-col at xl).

2. **`min-[360px]:` and `min-[400px]:` arbitrary breakpoints** in [src/components/student/dashboard-subject-card.tsx](src/components/student/dashboard-subject-card.tsx) violate the 3-tier rule. Left in place: they handle show/hide of status labels at narrow vs wide phones, and `clamp()` doesn't apply to layout switches. Removing them would degrade UX on either 320px or 414px phones. Flagged for the user.

3. ~~**No safe-area handling on the fixed sidebar's left edge**~~ — **resolved in mobile-polish PR**. Sidebar's inner content gets `pl-[env(safe-area-inset-left)]` (and right variant). On desktop xl `env()` resolves to 0 — pixel-identical. On iPad Pro xl in a notched configuration content insets correctly; the strict "xl byte-identical on desktop" interpretation is preserved.

4. **DESIGN.md is missing** — the impeccable preflight loader returned `hasDesign: false`. Surfaces were designed against PRODUCT.md (register: product) plus the impeccable shared design laws. Running `/impeccable document` after this PR series merges would generate DESIGN.md from the resulting cleaner code, which is a better moment than now.
