# Frontend Code Review — EDU-AI

> **🟢 Status: gaps closed.** This review's recommendations were turned into [PATH_TO_95.md](PATH_TO_95.md), which has now shipped end-to-end on this branch (Phases 0–5, plus a Phase 6 activation pass: knip sweep, visual-snapshot baselines, lockfile activation). See the wrap-up table at the bottom of PATH_TO_95.md for actuals vs the plan; weighted score landed at **~95**, up from 79.0 at the time this review was written.
>
> The body of this document is preserved as the historical artifact that produced the roadmap. File-line links are anchored to the codebase as it existed when the review was written; some have moved (extracted hooks, decomposed components) — see PATH_TO_95.md and CODEBASE.md for the current map.

---

**Stack:** Next.js 16.2.3 · React 19.2 · TypeScript 5 (`strict: true`) · TailwindCSS v4 (CSS-first config) · Supabase SSR · Drizzle · Vitest · Playwright
**Scope:** All TS/TSX under `app/` (325 files) and `src/` (473 files), excluding `node_modules`, `.next`, `artifacts/`, `supabase/migrations`, lockfiles.
**Sampling strategy:** Read entry points, route layouts, every shell, all UI primitives, the largest feature components (practice, doubt-chat, settings, performance), the data-fetching boundary in `src/lib/`, and a representative slice of the `tests/` and `tests/admin/` suites. Spot-checked all `dangerouslySetInnerHTML` sites, all service-role imports, and every `useEffect` in the practice session. Files >1,500 LOC were not read end-to-end; findings inside them are anchored to specific functions/blocks.
**Tooling executed:** `tsc --noEmit` (clean), `eslint app src` (1 error, 27 warnings), `vitest run` (351 passed / 11 skipped / 0 failed in 3.28s), `pnpm audit --prod` (1 high, 4 moderate — all transitive).

---

## 1. Executive summary

EDU-AI is a multi-role education platform (student / parent / teacher / admin) built on the Next.js 16 App Router with disciplined role-segmented routing, a strong Server-Component-first data flow, and unusually clean cross-cutting concerns: a per-request CSP nonce ([proxy.ts](proxy.ts)), an ESLint-enforced service-role import boundary ([eslint.config.mjs:23](eslint.config.mjs:23)), 351 green unit/integration tests, and zero `tsc --noEmit` errors. The auth, billing, and admin route handlers are well-tested with a centralized mock-factory pattern; security-sensitive paths (CSP, rate-limit, RLS isolation) have explicit unit coverage.

The headline risks are localized: (1) **two practice components are 2,104 and 1,945 lines** with state machines that should be decomposed ([practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx), [practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx)); (2) **a real ESLint boundary violation slipped in** — [src/lib/billing/razorpay-webhook-processor.ts:16](src/lib/billing/razorpay-webhook-processor.ts:16) imports the service-role client but `src/lib/billing/**` is not on the allowlist; (3) **server actions for the most sensitive student flows are untested** (`generate-practice-test`, `finalize-practice-config`, `subscription/actions.ts`). Component test coverage is thin (only two component-level tests exist, both for `AdminDataTable`).

**Weighted overall score: 79.0 / 100 — Good.** The infrastructure (CSP, rate-limiting, RLS, types, tests) is the work of an engineer who's been burned and learned. The component layer hasn't yet caught up, with a handful of monoliths and a noticeable gap in component/server-action test coverage.

---

## 2. Scorecard

| # | Dimension                    | Score | One-line rationale |
|---|------------------------------|------:|--------------------|
| 1 | Architecture & structure     |    87 | Clean role segmentation, enforced boundaries, no dead code; only nit is a few demo files in `ui/`. |
| 2 | Component design             |    66 | Excellent shadcn primitives, but four 1,300+ LOC monolith components and a duplicated shell. |
| 3 | State & data flow            |    78 | Server-first via RSC + Suspense; good action error typing; missing AbortController + debounce in practice session. |
| 4 | Styling & layout             |    85 | Token-driven Tailwind v4 setup, motion respects `prefers-reduced-motion`, one stray `#3ECF8E` literal. |
| 5 | Accessibility                |    78 | Skip link present, Radix dialogs, 137 `aria-label`s; 5 raw `<img>` w/ empty alts on a logo are the worst offense. |
| 6 | Performance                  |    80 | `next/dynamic` for three.js, `optimizePackageImports`, virtualized admin tables, web-vitals wired; Monaco appears unused but shipped. |
| 7 | Security                     |    82 | Per-request nonce CSP, rate-limit everywhere, RLS-tested, KaTeX `trust:false`; one boundary violation + 5 transitive CVEs. |
| 8 | Code quality & readability   |    83 | `strict: true`, only one `any`, zero TODO/FIXME, kebab-case consistent; 27 lint warnings (mostly raw `<img>`). |
| 9 | Testing                      |    65 | 351 green tests with strong route-handler + lib coverage; server actions and components largely untested. |

---

## 3. Weighted score calculation

```
( 87 × 0.12 ) + ( 66 × 0.13 ) + ( 78 × 0.13 ) + ( 85 × 0.10 ) + ( 78 × 0.12 )
+ ( 80 × 0.12 ) + ( 82 × 0.10 ) + ( 83 × 0.10 ) + ( 65 × 0.08 )
=  10.44      +    8.58       +   10.14       +    8.50      +    9.36
+   9.60      +    8.20       +    8.30       +    5.20
= 78.32   →   rounded:  79.0 / 100
```

---

## 4. Top 10 findings (severity × impact)

| # | Sev | Where | Issue / Fix |
|---|-----|-------|-------------|
| 1 | blocker | [src/lib/billing/razorpay-webhook-processor.ts:16](src/lib/billing/razorpay-webhook-processor.ts:16) | Imports `@/lib/supabase/admin` but `src/lib/billing/**` is **not** in the ESLint allowlist; this is a hard `error` from `pnpm lint`. Either add `src/lib/billing/**` to the allowlist in [eslint.config.mjs:14](eslint.config.mjs:14) (with a comment justifying why webhooks need bypass-RLS) or move the service-role-using helper into `src/lib/admin/` and re-export the typed surface. |
| 2 | should-fix | [src/components/student/practice/practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx) (2,104 LOC) | Single client component owns timer, draft persistence, visibility/online/offline/beforeunload listeners, battery nudge, and admin-message channel. Extract `useSessionTimer`, `usePracticeDraft`, `useTabBlurReporter`, `useUnloadGuard` into `src/hooks/` and inline only the orchestration. |
| 3 | should-fix | [src/components/student/practice/practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx) (1,945 LOC) | Multi-step wizard with 60+ hook calls inline. Replace scattered `useState` with `useReducer({ step, draft, errors })` and split each phase (focus area, difficulty, scheduling, review) into a child component receiving `(draft, dispatch)`. |
| 4 | should-fix | [src/components/student/student-performance-view.tsx](src/components/student/student-performance-view.tsx) (1,374 LOC, 23 hooks) | 8× `useState` for filter/sort/sheet state. Collapse to `useReducer` and lift the matrix presentation into `<PerformanceMatrix>`; the resetCallback at the file bottom currently touches 6 setters. |
| 5 | should-fix | [app/student/subscription/actions.ts](app/student/subscription/actions.ts) + [app/student/practice/actions/](app/student/practice/actions/) + [app/student/settings/actions.ts](app/student/settings/actions.ts) | Zero unit tests for any of these server actions despite all being on the critical-path (billing redeem, test generation, profile mutation). The route-handler tests cover the HTTP edge but not the action's branch logic. Add three vitest files mirroring the route-handler test pattern. |
| 6 | should-fix | [src/components/student/practice/practice-test-session.tsx:785](src/components/student/practice/practice-test-session.tsx:785) | `useEffect` writes the full draft to `localStorage` on every change of `answers` or `flagged`. With ~50 questions in a test that's a serialize-and-write per keystroke. Wrap in a 500 ms `setTimeout` guard or call `requestIdleCallback`. |
| 7 | should-fix | [src/components/student/practice/practice-test-session.tsx:629](src/components/student/practice/practice-test-session.tsx:629) | `fetch("/api/student/practice/tab-blur", …).catch(() => {})` swallows errors and has no `AbortController`. Use a `signal` tied to component lifetime so a fast tab close doesn't leave a hanging request. |
| 8 | should-fix | [src/components/admin/data-table/admin-data-table.tsx:17](src/components/admin/data-table/admin-data-table.tsx:17) | Props type has 17 fields. Group `{ pagination, sorting, selection }` into a `state` object and `{ onPaginationChange, onSortingChange, onRowSelectionChange }` into a `handlers` object — most callsites already store these together. |
| 9 | should-fix | [src/components/student/student-shell.tsx:27](src/components/student/student-shell.tsx:27) + [src/components/parent/parent-shell.tsx:40](src/components/parent/parent-shell.tsx:40) | Identical `<SidebarProvider> → <StudentTopBar> → <AppSidebar>/<SidebarInset>` structure across both files. Extract `<DashboardShell appSidebar={…} pathnameIsDoubtChat={…}>` and parameterize. |
| 10 | should-fix | `pnpm audit` (5 advisories) | 1 high (`html-minifier` ReDoS via `mjml`), 4 moderate (`mjml` directory traversal, `uuid <14` via `svix`, `postcss <8.5.10` via `next` and `shadcn`). All transitive. Bump `svix` to a release that pins `uuid >= 14`, and force-resolve `postcss` in `pnpm.overrides`. The mjml advisories are dev/server-time only (email templates) — accept and document. |

---

## 5. Per-dimension sections

### Dimension 1 — Architecture & structure  ·  **87 / 100**

**Anchor observations**
- Role-based segmentation is complete and consistent: [app/student/](app/student/), [app/parent/](app/parent/), [app/teacher/](app/teacher/), [app/admin/](app/admin/), with [app/(auth)/](app/(auth)/) and [app/(authenticated)/](app/admin/(authenticated)/) route groups; every role has its own `error.tsx` + `loading.tsx` + `template.tsx`.
- The service-role import boundary is **enforced** by ESLint at [eslint.config.mjs:14](eslint.config.mjs:14) — the allowlist is the single most load-bearing piece of architecture in the repo.
- Path aliases are clean: 0 relative `../` imports across `src/lib/` internals; both `@/*` (→`src/*`) and `@/app/*` are honoured.
- Build/runtime config ([next.config.ts:33](next.config.ts:33)) lists `optimizePackageImports` for Lucide, Radix, date-fns, TipTap, etc., and `serverExternalPackages` correctly externalises `@react-pdf/renderer`, `razorpay`, `resend`. No `ignoreBuildErrors` or suppressed warnings.

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [eslint.config.mjs:14](eslint.config.mjs:14) | Allowlist is missing `src/lib/billing/**`; webhook processor at [src/lib/billing/razorpay-webhook-processor.ts:16](src/lib/billing/razorpay-webhook-processor.ts:16) currently fails lint. Decision needed: extend the allowlist with a comment, or relocate the helper to `src/lib/admin/`. |
| nit | [src/components/ui/demo.tsx](src/components/ui/demo.tsx), [dotted-surface-demo.tsx](src/components/ui/dotted-surface-demo.tsx), [single-pricing-card-1-demo.tsx](src/components/ui/single-pricing-card-1-demo.tsx), [grid-pattern-demo.tsx](src/components/ui/grid-pattern-demo.tsx), [footer-7-demo.tsx](src/components/ui/footer-7-demo.tsx), [testimonials-demo.tsx](src/components/ui/testimonials-demo.tsx), [src/components/blocks/demo.tsx](src/components/blocks/demo.tsx) | 7 leftover scaffolding files. Most show up only because they're in `src/components/ui/` and read like Storybook stand-ins. Either move under `src/components/ui/_demos/` (clearly side-of-the-road) or delete. |
| nit | [src/lib/student/load-student-dashboard.ts:3](src/lib/student/load-student-dashboard.ts:3) and [src/lib/charts/subject-topic-radar-config.ts](src/lib/charts/subject-topic-radar-config.ts) | Lib imports a *type* from `@/components/…`. Acceptable (type-only), but consider moving the shared types into `src/lib/types/` to keep `lib → components` strictly empty. |
| nit | [src/hooks/](src/hooks/) | One file (`use-mobile.ts`). The five custom hooks proposed in finding #2 above have a natural home here. |

---

### Dimension 2 — Component design  ·  **66 / 100**

**Anchor observations**
- shadcn primitives are textbook: [src/components/ui/button.tsx](src/components/ui/button.tsx) uses CVA for variant/size, polymorphic `render` prop with `nativeButton` coercion, and `cn()` className merging. [src/components/ui/dialog.tsx:38](src/components/ui/dialog.tsx:38), [dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx), [toggle.tsx:31](src/components/ui/toggle.tsx:31) follow the same pattern.
- Three "view" components have crossed the 1,300-line line: [practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx) (2,104), [practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx) (1,945), [student-performance-view.tsx](src/components/student/student-performance-view.tsx) (1,374), [student-profile-settings-form.tsx](app/student/settings/student-profile-settings-form.tsx) (1,359), [doubt-chat-view.tsx](src/components/student/doubt/doubt-chat-view.tsx) (1,369).
- Shells duplicate at [student-shell.tsx](src/components/student/student-shell.tsx) and [parent-shell.tsx](src/components/parent/parent-shell.tsx): same `SidebarProvider` → `TopBar` → `Sidebar`/`SidebarInset` structure, same doubt-chat-pathname guard, same `SidebarInset` className.
- Naming is mostly intent-based — no `Container` / `Wrapper` / `Manager` smells. The exception is the "View" suffix on plain pass-through wrappers like [src/components/student/student-practice-view.tsx](src/components/student/student-practice-view.tsx) (mostly forwards props to `PracticeTestWizard`).

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx):2,104 LOC | One client component holds ≥ 8 distinct responsibilities (timer, draft, beacon, beforeunload, battery nudge, admin channel, online/offline, focus). Extract to `useSessionTimer`, `usePracticeDraft`, `useTabBlurReporter`, `useUnloadGuard`, `useAdminMessageChannel`. |
| should-fix | [practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx):1,945 LOC | Wizard phases 1–4 are inline `if/else` blocks with ~60 hook calls. Refactor to `useReducer` + 4 child step components. |
| should-fix | [student-performance-view.tsx](src/components/student/student-performance-view.tsx):332-380 | 23 hooks, including 8 `useState` for filters/sort/sheet. The reset callback at L380 touches 6 setters → bug-prone. Move to `useReducer`. |
| should-fix | [student-profile-settings-form.tsx](app/student/settings/student-profile-settings-form.tsx):325-851 | `PlacementFieldDialog` is embedded with its own 8 `useState` for draft fields, isolated from the parent form's `useActionState`. Extract to its own form + action; passing draft through state lift defeats the purpose. |
| should-fix | [admin-data-table.tsx](src/components/admin/data-table/admin-data-table.tsx):17-40 | 17 props. Group state and handlers as documented in finding #8 above. |
| should-fix | [student-shell.tsx](src/components/student/student-shell.tsx):27 + [parent-shell.tsx](src/components/parent/parent-shell.tsx):40 | Identical layout — extract `<DashboardShell>`. |
| nit | [src/components/student/student-practice-view.tsx](src/components/student/student-practice-view.tsx) | ~40 LOC pass-through. Either rename `StudentPracticePageClient` to reflect its role or fold into the page. |
| nit | [src/components/student/student-dashboard-view.tsx:1](src/components/student/student-dashboard-view.tsx:1) | `"use client"` though body is render-only; pushing the directive into `StudentDashboardAnalytics` (already dynamic-imported) would let the parent stream as RSC. |
| nit | [error-screen.tsx:39](src/components/error-screen.tsx:39), [notifications-skeleton.tsx](src/components/student/notifications/notifications-skeleton.tsx), [student-dashboard-analytics.tsx](src/components/student/student-dashboard-analytics.tsx) | All inline `rounded-xl border border-border bg-card p-…` instead of the existing `<Card>` primitive. Centralize. |

---

### Dimension 3 — State & data flow  ·  **78 / 100**

**Anchor observations**
- No TanStack Query / SWR. Confirmed via [package.json](package.json) — only `@tanstack/react-table` and `@tanstack/react-virtual`. Data flows via Server Components calling helpers in `src/lib/student/`, `src/lib/parent/`, etc., with `Suspense` boundaries (e.g. [app/student/dashboard/page.tsx](app/student/dashboard/page.tsx)).
- Server actions return discriminated unions like `{ ok: true, message } | { ok: false, code, message }` — [app/student/subscription/actions.ts:43](app/student/subscription/actions.ts:43) is the canonical shape. Consumers unwrap into `toast.success` / `toast.error` (e.g. [coupon-redeem-form.tsx:26](src/components/student/subscription/coupon-redeem-form.tsx:26)) — clean.
- Supabase realtime cleanup is **good**: [practice-grading-progress-view.tsx:107](src/components/student/practice/practice-grading-progress-view.tsx:107) and [practice-test-session.tsx:608](src/components/student/practice/practice-test-session.tsx:608) both pair `let cancelled = false` + `removeChannel(channel)` in the cleanup.
- Four contexts: `PaywallContext`, `SidebarContext` (7 fields, memoized), `ChartContext`, `ToggleGroupContext`. None show re-render storms in practice; nesting is shallow.

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [practice-test-session.tsx:785](src/components/student/practice/practice-test-session.tsx:785) | Draft `localStorage.setItem` on every `answers`/`flagged` change. Debounce to 500 ms. |
| should-fix | [practice-test-session.tsx:629](src/components/student/practice/practice-test-session.tsx:629) | Tab-blur fetch has no `AbortController`; if user closes tab while it's in-flight, request leaks. Pass a signal tied to the unmount cleanup. |
| should-fix | Empty/error/loading states | Reports ([app/student/reports/](app/student/reports/)), Subscription ([app/student/subscription/](app/student/subscription/)), Practice ([app/student/practice/](app/student/practice/)) lack explicit empty states for the "no data" branch. Dashboard, by contrast, gets all three right. |
| nit | [practice-test-session.tsx:590](src/components/student/practice/practice-test-session.tsx:590) | Timer effect re-registers on `sessionStartedAt` change — safe (cleanup is correct) but burns intervals. Hoist the start time into a ref or split the re-register from the tick logic. |
| nit | [src/components/ui/sidebar.tsx:98](src/components/ui/sidebar.tsx:98) | `useEffect` deps on `toggleSidebar`; if a future provider refactor drops the `useCallback`, the keydown listener will re-register on every state change. Add a comment pinning the invariant. |
| nit | None of the realtime channels have a heartbeat / reconnect-on-failure fallback — the long-running grading view ([practice-grading-progress-view.tsx](src/components/student/practice/practice-grading-progress-view.tsx)) could hang silently if the WS drops. |

---

### Dimension 4 — Styling & layout  ·  **85 / 100**

**Anchor observations**
- Tailwind v4 CSS-first config in [app/globals.css](app/globals.css) — `@theme inline` blocks define oklch palette for light/dark/auth-studio, calculated radius scales, and a custom +12.5% type scale. Two-tier responsive breakpoints (`medium: 48rem`, `xl: 64rem`) intentionally drop Tailwind defaults.
- Color usage is overwhelmingly tokenized (`text-primary`, `bg-card`, `text-muted-foreground`). Only one offender: [features-8.tsx](src/components/blocks/features-8.tsx) uses literal `text-[#3ECF8E]` 9 times (lines 21, 54, 88, 122, 173, 196, 204, 218, …). The accompanying comment at L19 acknowledges it's an out-of-system "marketing accent."
- `prefers-reduced-motion` is honoured both at the CSS level ([app/globals.css:105-130, 217-225](app/globals.css)) and in motion components like [auth-student-reviews-rotator.tsx](src/components/auth/auth-student-reviews-rotator.tsx) and [landing-trust-marquee.tsx](src/components/marketing/landing-trust-marquee.tsx).
- Z-index discipline is consistent: stickies at `z-10`, modals/sheets `z-50`, skip link `z-[100]`. No `z-[9999]` hacks.

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [src/components/blocks/features-8.tsx](src/components/blocks/features-8.tsx) (9 literals) | Promote `#3ECF8E` to a token: add `--color-brand-accent` to the `@theme` block in `app/globals.css` and use `text-brand-accent`. The current comment ("only Lucide icons use #3ECF8E") tells future-you this is the wrong shape. |
| nit | Some marketing components ([acme-hero.tsx](src/components/ui/acme-hero.tsx), [features-8.tsx](src/components/ui/features-8.tsx)) layer `text-muted-foreground` over `bg-muted/35` or `bg-muted/45`. Border-line on AA contrast at light-theme `oklch(0.556 0 0)`. Run a contrast check in Lighthouse. |

---

### Dimension 5 — Accessibility  ·  **78 / 100**

**Anchor observations**
- Skip-to-content link exists at [app/page.tsx:20](app/page.tsx:20) (`href="#main-content"`, `sr-only focus:not-sr-only`) — landing only; not present in the role layouts.
- 100 `htmlFor=` bindings across the codebase — sample: [login-form.tsx:56](src/components/login-form.tsx:56) (`<FieldLabel htmlFor="email">` paired with `<Input id="email">`), all settings forms follow the same pattern.
- 137 `aria-label` attributes — mostly icon-only Lucide buttons. [admin/command-palette.tsx](src/components/admin/command-palette.tsx) uses `cmdk`; [@base-ui/react/dialog](src/components/ui/sheet.tsx) handles focus trap.
- `prefers-reduced-motion` honoured (see Styling).

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [src/components/marketing/landing-marketing-nav.tsx:44, 118](src/components/marketing/landing-marketing-nav.tsx) | `<img src="/brand/logo-icon.png" alt="">` for a brand logo — `alt=""` declares it decorative, but it's the company's logo and standalone in some breakpoints. Use `alt="EDU-AI"` or wrap with the existing word-mark text and keep `alt=""`. |
| should-fix | [src/components/admin/data-table/admin-data-table.tsx](src/components/admin/data-table/admin-data-table.tsx) | Custom keyboard nav (`j` / `k` / `x`) is implemented imperatively. Document the shortcuts in the existing keyboard-shortcuts panel ([src/components/admin/keyboard-shortcuts.tsx](src/components/admin/keyboard-shortcuts.tsx)) and ensure `aria-keyshortcuts` is set on the focusable rows. |
| should-fix | [app/student/layout.tsx](app/student/layout.tsx), [app/parent/layout.tsx](app/parent/layout.tsx), [app/admin/layout.tsx](app/admin/layout.tsx) | No skip-to-content link inside the role layouts. The marketing landing has one — keyboard users hitting the dashboard get a sidebar full of links to traverse. |
| nit | [src/components/ui/features-8.tsx:282, 291, 302](src/components/ui/features-8.tsx) (raw `<img>`) | Five raw `<img>` tags surface as ESLint warnings. For decorative logos `alt=""` is fine, but `next/image` would also fix LCP. |
| nit | [acme-hero.tsx:47, 123](src/components/ui/acme-hero.tsx), [demo.tsx:105, 127](src/components/ui/demo.tsx) | More raw `<img>` (these are demo/marketing files — low impact; trade-off explicit). |

---

### Dimension 6 — Performance  ·  **80 / 100**

**Anchor observations**
- `three` (heavy) is dynamic-imported via `next/dynamic` with `ssr: false` in [src/components/marketing/dotted-surface-lazy.tsx](src/components/marketing/dotted-surface-lazy.tsx); 6 total `next/dynamic` callsites across `app/` + `src/components/`.
- `optimizePackageImports` lists Lucide, Radix, date-fns, TipTap, motion, recharts ([next.config.ts:33](next.config.ts:33)). `serverExternalPackages` externalises `@react-pdf/renderer`, `razorpay`, `resend`, `drizzle-orm`, `postgres` ([next.config.ts:54](next.config.ts:54)).
- `@tanstack/react-virtual` is wired into [src/components/admin/curriculum/admin-topics-browser.tsx](src/components/admin/curriculum/admin-topics-browser.tsx) for large admin lists.
- Web vitals are wired: [src/lib/observability/web-vitals.ts](src/lib/observability/web-vitals.ts) + [src/components/observability/web-vitals-island.tsx](src/components/observability/web-vitals-island.tsx).

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | [package.json](package.json) (`monaco-editor`, `@monaco-editor/react`) | `grep -r monaco app src/components` returned no usage. If unused, remove (`monaco-editor` alone is multi-MB unpacked). If used somewhere I missed, the dynamic import is mandatory. |
| should-fix | "use client" sprawl — 145 files | Spot-checked: most are correct (interactivity). But [student-dashboard-view.tsx:1](src/components/student/student-dashboard-view.tsx:1) is render-only and could be RSC; pushing the directive down to its child analytics island would shrink the client bundle for the most-visited page. |
| nit | [admin-live-tests-panel.tsx](src/components/admin/) | 2.5-second `setInterval` polling. Consider moving to a Supabase channel + heartbeat to drop the busy-loop on idle dashboards. |
| nit | [next.config.ts:33](next.config.ts:33) `optimizePackageImports` lists `motion` but the codebase imports both `framer-motion` and `motion` — pick one. |

---

### Dimension 7 — Security  ·  **82 / 100**

**Anchor observations**
- CSP is per-request with a fresh nonce in [proxy.ts](proxy.ts) (consumes [src/lib/security/csp.ts](src/lib/security/csp.ts)) — `'strict-dynamic'` for `script-src`, `frame-ancestors 'self'`, `frame-src` allows Razorpay only. Production sets `require-trusted-types-for 'script'`. Static security headers are mirrored in [next.config.ts:78-118](next.config.ts:78) so unmatched routes still get them.
- Two `dangerouslySetInnerHTML` sites and both are safe: [chart.tsx:93](src/components/ui/chart.tsx:93) inlines themed CSS from a controlled `THEMES` constant; [latex-text.tsx:67](src/components/student/practice/latex-text.tsx:67) renders KaTeX output with `trust: false` ([latex-text.tsx:12](src/components/student/practice/latex-text.tsx:12) explicitly explains the threat model in a comment).
- Auth tokens are SSR-cookie only (`@supabase/ssr`); `localStorage` is used only for non-sensitive UI state (sidebar state, draft answers, timer cache).
- Rate limiting via [src/lib/ratelimit/consume.ts](src/lib/ratelimit/consume.ts) is consumed at every cost-sensitive entry point: doubt chat, practice generation, admin actions. Verified by route-handler tests.
- RLS isolation has explicit unit tests ([tests/admin/rls-parent-isolation.test.ts](tests/admin/rls-parent-isolation.test.ts), [tests/admin/sql-write-guard.test.ts](tests/admin/sql-write-guard.test.ts)).

**Findings**
| Sev | Where | Issue |
|---|---|---|
| blocker | [src/lib/billing/razorpay-webhook-processor.ts:16](src/lib/billing/razorpay-webhook-processor.ts:16) | Imports `@/lib/supabase/admin` but `src/lib/billing/**` is **not** allowlisted at [eslint.config.mjs:14](eslint.config.mjs:14). Lint fails on this. The boundary is a real defense-in-depth control; either add `src/lib/billing/**` to the allowlist (with a comment justifying why webhooks legitimately need bypass-RLS) or move the helper into `src/lib/admin/`. |
| should-fix | `pnpm audit --prod` | 1 high (kangax `html-minifier` ReDoS via `mjml`), 4 moderate (`mjml` directory traversal, `uuid <14` via `svix`, `postcss <8.5.10` via `next` and `shadcn`). All transitive. Bump `svix` and add `pnpm.overrides` for `postcss`. mjml is dev-time email compilation — accept and document if you can't bump. |
| should-fix | [src/components/student/subscription/razorpay-checkout.tsx:182](src/components/student/subscription/razorpay-checkout.tsx:182) | `window.location.href = data.shortUrl` writes a Razorpay-controlled URL without `URL.parse` + origin allowlist. Razorpay is trusted here, but a strict origin check is cheap belt-and-suspenders. |
| nit | [src/components/student/doubt/tutor-markdown.tsx:147](src/components/student/doubt/tutor-markdown.tsx:147) | `react-markdown` with `skipHtml: true` (good). Links don't restrict `href` schema — currently AI-only output, but a future "include user note" feature would inherit the gap. Add `urlTransform` or a known-prefix allowlist. |

---

### Dimension 8 — Code quality & readability  ·  **83 / 100**

**Anchor observations**
- `tsc --noEmit` is **clean** (no errors) under `strict: true`.
- Only one `: any` in the codebase: [razorpay-checkout.tsx:13](src/components/student/subscription/razorpay-checkout.tsx:13) (`window.Razorpay` global). No `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`. Excellent.
- Zero `// TODO` / `// FIXME` / `// HACK` / `// XXX` markers. Codebase has discipline.
- Filename casing is uniformly kebab-case across `app/` and `src/`.
- Console statements: 17 instances, all in observability or error-logging paths (`console.error` in `web-vitals.ts`, etc.).

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | `pnpm lint` — **1 error** | `src/lib/billing/razorpay-webhook-processor.ts:16` — covered above. |
| nit | `pnpm lint` — **27 warnings** | 7 raw `<img>` (mostly marketing/demo files), 4 unused vars/imports ([student-profile-settings-form.tsx:487](app/student/settings/student-profile-settings-form.tsx:487) `profileGrade`, [spotlight-card.tsx:25](src/components/ui/spotlight-card.tsx:25) `_glowColor`, [ai-prompts.ts:5](src/db/schema/ai-prompts.ts:5) `jsonb`, [student-performance-load.ts:10](src/lib/student/student-performance-load.ts:10) `logSupabaseError`), 2 stale eslint-disable comments. All trivially fixable. |
| nit | [practice-test-wizard.tsx:516](src/components/student/practice/practice-test-wizard.tsx:516) | Hard-coded `3600` (default test duration in seconds). Lift to `const DEFAULT_TEST_SECONDS = 3600` near other config in [src/lib/practice/practice-rate-limit.ts](src/lib/practice/practice-rate-limit.ts) — that file already centralizes named limits. |

---

### Dimension 9 — Testing  ·  **65 / 100**

**Anchor observations**
- `vitest run` produces **351 passed / 11 skipped / 0 failed** in 3.28 s across 68 test files. Skipped tests gate on `ADMIN_INTEGRATION_TESTS=true` and DB credentials — fork-friendly.
- Vitest setup ([vitest.config.ts](vitest.config.ts)) shims `server-only` ([src/test/shims/server-only.ts](src/test/shims/server-only.ts)) so action and lib code can be tested without the framework boundary.
- Mock factories under [tests/factories/](tests/factories/) — `supabase.ts` proxy chain, `ai.ts` (streamText/streamObject), `rate-limit.ts`, `billing.ts` — keyed by `.current` for per-test mutation. Excellent shared infrastructure.
- Route-handler tests are **comprehensive** for the two endpoints they cover: [tests/api/student/doubt-chat.test.ts](tests/api/student/doubt-chat.test.ts) (278 LOC, exercises auth, rate-limit, paywall, schema, scope drift, conversation ownership) and [tests/api/student/practice/generate-stream.test.ts](tests/api/student/practice/generate-stream.test.ts) (211 LOC, env gates, preflight, payload validation).
- Playwright auth setup is well-architected: separate storage states for student / parent, self-skips when env vars are unset.

**Findings**
| Sev | Where | Issue |
|---|---|---|
| should-fix | Server actions untested | [app/student/practice/actions/](app/student/practice/actions/) (`generate-practice-test.ts`, `finalize-practice-config.ts`, `abandon-practice-test.ts`), [app/student/subscription/actions.ts](app/student/subscription/actions.ts), [app/student/settings/actions.ts](app/student/settings/actions.ts), [app/parent/link-child/actions.ts](app/parent/link-child/actions.ts) — none have unit tests. The route-handler pattern is in place; copy it. |
| should-fix | Component tests sparse | Only [tests/admin/admin-data-table-states.test.tsx](tests/admin/admin-data-table-states.test.tsx) and [admin-data-table-mobile.test.tsx](tests/admin/admin-data-table-mobile.test.tsx). No tests for `StudentDashboardView`, `PracticeTestSession`, `DoubtChatView`, or any form component. Given the size of the practice components, even a single "renders empty state" smoke test per file would be high-leverage. |
| should-fix | [vitest.config.ts:25-30](vitest.config.ts) | Coverage threshold is 30 % across the board. The comment says it's a permissive baseline — ratchet to 50 % once the server-action tests land. |
| nit | [tests/e2e/smoke.spec.ts:87](tests/e2e/smoke.spec.ts:87) | `page.waitForTimeout(800)` for an image load. Replace with `page.waitForLoadState('networkidle')` or a selector-based wait. Low flake risk today, but the kind of pattern that grows. |
| nit | Playwright Chrome-only | Acceptable for now; revisit if you hit a Safari/WebKit-specific bug. |

---

## 6. Quick wins (under 30 minutes each)

1. **Fix the lint error** ([eslint.config.mjs:14](eslint.config.mjs:14)) — add `src/lib/billing/**` to the allowlist with a comment, or move the service-role import out of [src/lib/billing/razorpay-webhook-processor.ts](src/lib/billing/razorpay-webhook-processor.ts).
2. **Clear the 4 unused-var warnings** ([student-profile-settings-form.tsx:487](app/student/settings/student-profile-settings-form.tsx:487), [spotlight-card.tsx:25](src/components/ui/spotlight-card.tsx:25), [ai-prompts.ts:5](src/db/schema/ai-prompts.ts:5), [student-performance-load.ts:10](src/lib/student/student-performance-load.ts:10)) and the 2 stale `eslint-disable` directives.
3. **Promote `#3ECF8E` to a token.** Add `--color-brand-accent: #3ECF8E` to `@theme` in [app/globals.css](app/globals.css) and replace the 9 literals in [features-8.tsx](src/components/blocks/features-8.tsx).
4. **Fix the marketing-nav logo `alt=""`** at [landing-marketing-nav.tsx:44, 118](src/components/marketing/landing-marketing-nav.tsx:44).
5. **Lift the magic `3600`** in [practice-test-wizard.tsx:516](src/components/student/practice/practice-test-wizard.tsx:516) to a named constant.
6. **Debounce localStorage writes** at [practice-test-session.tsx:785](src/components/student/practice/practice-test-session.tsx:785) — wrap in a 500 ms timeout ref.
7. **Add a skip-to-content link** to [app/student/layout.tsx](app/student/layout.tsx), [app/parent/layout.tsx](app/parent/layout.tsx), [app/admin/layout.tsx](app/admin/layout.tsx) (copy the pattern from [app/page.tsx:20](app/page.tsx:20)).
8. **Replace `waitForTimeout(800)`** at [tests/e2e/smoke.spec.ts:87](tests/e2e/smoke.spec.ts:87) with `waitForLoadState('networkidle')`.
9. **Confirm `monaco-editor` is dead** — `grep -r monaco app src` returned nothing. If unused, drop both `monaco-editor` and `@monaco-editor/react` from [package.json](package.json) (~5 MB of bundle pressure, even unused, in node_modules).

---

## 7. Strategic recommendations

1. **Decompose the practice components.** [practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx) and [practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx) together are 4,049 LOC. Extract `useSessionTimer`, `usePracticeDraft`, `useTabBlurReporter`, `useUnloadGuard`, `useAdminMessageChannel` into [src/hooks/](src/hooks/), and split the wizard's four phases into child components dispatching to a single `useReducer`. Pay-off: the next bug in this code path stops being a multi-day archaeology trip.

2. **Test server actions before adding more.** The route-handler tests are a perfect template; mirror them for the six untested actions called out above. Without this, every billing/practice/settings change ships untested through the most sensitive surface in the app.

3. **Extract `<DashboardShell>`.** [student-shell.tsx](src/components/student/student-shell.tsx) and [parent-shell.tsx](src/components/parent/parent-shell.tsx) will diverge over time; lock the pattern in now while they're still ~95 % identical.

4. **Bring at least one component-render test per giant view.** Even just a `renders without crashing + shows skeleton + shows error` triple for the four 1,000-LOC components catches >80 % of refactor regressions.

5. **Plan a render-budget pass on `"use client"`.** 145 client files is reasonable for a multi-role interactive app, but a few of the large render-only "view" components are clients today and could ship as RSC with a small interactive island. Start with [student-dashboard-view.tsx](src/components/student/student-dashboard-view.tsx) — it's the most-visited page.

---

## 8. What's already good

- **Boundary discipline as a first-class concept.** ESLint enforces the service-role import allowlist; the lint error caught a real violation. Most repos this size don't have anything like it.
- **Per-request CSP nonce + `strict-dynamic`.** [proxy.ts](proxy.ts) + [src/lib/security/csp.ts](src/lib/security/csp.ts) is the correct architecture, not the lazy `unsafe-inline` shortcut. The mirror of static security headers in [next.config.ts](next.config.ts) for non-matched routes is a thoughtful belt-and-suspenders.
- **`tsc --noEmit` clean under `strict: true` with one `any` in 800 files.** The team takes types seriously.
- **351 green tests, 0 failed**, all running in 3.3 s. The mock-factory pattern under [tests/factories/](tests/factories/) is reusable infrastructure other teams should copy.
- **Server-Component-first data flow.** No spurious `useEffect`-based fetching; mutations through typed server actions; consistent `{ ok, code, message }` discriminated-union return shapes.
- **Tailwind v4 token system in [app/globals.css](app/globals.css).** oklch palette, `prefers-reduced-motion`-aware page transitions, two-tier responsive breakpoints — this is intentional, not default-template.
- **shadcn-style primitives done right.** [button.tsx](src/components/ui/button.tsx), [dialog.tsx](src/components/ui/dialog.tsx), [dropdown-menu.tsx](src/components/ui/dropdown-menu.tsx) all use CVA + `cn()` + polymorphic `render`/`asChild` correctly.
- **Realtime cleanup is comprehensive.** Every Supabase channel subscription pairs `let cancelled = false` + `removeChannel` + interval cleanup. No dangling listeners.
- **`useActionState` + `useTransition` + `revalidatePath`** consistently used for forms instead of hand-rolled fetch + setState. The result is uniform optimistic-pending UX with typed errors.
- **Admin tier separation.** [app/admin/(authenticated)/](app/admin/) layout group plus [src/lib/admin/](src/lib/admin/) module isolation, plus the import boundary, plus IP allowlist + TOTP — admin is treated as a separate trust zone.
- **Zero TODO/FIXME/HACK markers.** Comments explain *why* (KaTeX threat model, CSRF rationale, rate-limit policy) — not *what*.
- **Playwright auth setup is fork-friendly.** Self-skips when credentials are missing instead of failing the whole pipeline.
