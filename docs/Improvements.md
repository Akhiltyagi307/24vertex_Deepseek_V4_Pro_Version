# Application performance and speed — improvements

This document captures **why** each improvement matters, **what** to change, and **how** to implement it in this codebase (Next.js App Router, Supabase, server components).

It extends and updates the bloat/audit notes: some items here overlap with `New-bloat-and-improvements.md`, but this file is focused on **speed** and includes **implementation guidance**.

**Stack context:** Next 16, React 19, Supabase (`@supabase/ssr`), Drizzle/Postgres where applicable, RSC + client islands for student flows.

---

## Rollout status (sub-1s program, April 2026)

| Area | Status |
|------|--------|
| Single cached `profiles` per request | **Done** — `getCachedAppProfileRow` + React `cache()` in [`src/lib/auth/cached-profile.ts`](src/lib/auth/cached-profile.ts) |
| Layout parallel profile + entitlements | **Done** — `Promise.all` in [`app/student/layout.tsx`](app/student/layout.tsx) |
| `get_entitlement_snapshot` in deployed DB | **Ops** — apply [`supabase/migrations/20260424120000_get_entitlement_snapshot.sql`](supabase/migrations/20260424120000_get_entitlement_snapshot.sql) in staging/prod (`SECURITY INVOKER`; RLS unchanged) |
| Tracker sync off render path | **Done** — session-bound server action [`src/lib/student/sync-performance-tracker-action.ts`](src/lib/student/sync-performance-tracker-action.ts) + [`StudentPerformanceTrackerHydrate`](src/components/student/student-performance-tracker-hydrate.tsx) |
| RSC streaming (dashboard, practice hub) | **Done** — Suspense + async loaders under `app/student/dashboard/` and `app/student/practice/` |
| Curriculum topic counts (`unstable_cache`) | **Done** — [`src/lib/cache/curriculum-topic-counts.ts`](src/lib/cache/curriculum-topic-counts.ts); revalidate via `revalidateCurriculumTopicCaches()` from trusted server code only |
| `optimizePackageImports`, image `remotePatterns`, Sentry defaults | **Done** — [`next.config.ts`](../next.config.ts), `sentry.*.config.ts` |
| Region / pooler / `EXPLAIN` | **Ongoing** — verify per environment (§10) |
| perf-check route budget | **Done** — optional `PERF_ROUTE_BUDGET_MS` in [`scripts/perf-check.mjs`](../scripts/perf-check.mjs) |

---

## 1. Consolidate duplicate `profiles` and auth-adjacent reads

### Why

Every extra round trip to Supabase adds latency (network + RLS + query planning). Today, a single student navigation can:

- Call `getServerUser()` (uses `supabase.auth.getUser()` — already deduped with React `cache` in `src/lib/auth/get-server-user.ts`).
- Call `getProfile(supabase)` → `profiles` with `id, role, is_verified`.
- Call `getStudentLayoutContext` → `profiles` again for `full_name, school_name, avatar_url, grade, section, student_link_code`.
- On pages like `app/student/dashboard/page.tsx` and `app/student/practice/page.tsx`, run **another** `profiles` select for fields such as `grade, stream, elective_subject_id` (or similar).

That is **2–3 overlapping `profiles` queries** per request for the same user. Under load, this also increases database work and blurs the benefit of any edge caching.

### How to implement

1. **Define one server-only loader** (e.g. `getStudentProfileForSession` or `getCachedStudentProfileRow`) in a module under `src/lib/auth/` that:
   - Uses `getServerUser()`; if no user, returns `null`.
   - Fetches **one** `profiles` row with **all** columns required by:
     - `StudentLayout` (`app/student/layout.tsx`)
     - Common student pages (dashboard, practice, reports) — or the union of fields those routes need.
   - Wrap the async function in **`cache()`** from `react` (same pattern as `getServerUser`) so layout + page + nested server components in the same request **share one DB read**.

2. **Refactor `getProfile` and `getStudentLayoutContext`** to either:
   - Accept an optional preloaded row and skip the query when present, or
   - Be replaced by the single combined loader that returns `{ profile, layoutFields }` in one type.

3. **Update** `app/student/layout.tsx` to use the combined loader once; pass derived props into `StudentShell` as today.

4. **Update** each student `page.tsx` that currently re-selects `profiles` to use the same cached data:
   - Either by calling the same `cache()`-wrapped function (will dedupe) or by receiving fields only available in a **child segment** (if you split routes).
   - Remove redundant `getProfile` + second `from("profiles")` when the first query already includes `grade`, `stream`, `elective_subject_id`, `full_name`, etc.

5. **Test** with Supabase logging or temporary `console.time` in dev: you should see **one** `profiles` read per request for typical student pages.

**Files to touch (indicative):** `src/lib/auth/routing.ts`, `src/lib/auth/student-layout.ts`, `app/student/layout.tsx`, `app/student/dashboard/page.tsx`, `app/student/practice/page.tsx`, `app/student/reports/page.tsx` (if it duplicates checks), and any other student page that re-queries `profiles` for the same id.

---

## 2. Reduce `getEntitlements` to fewer database round trips

### Why

`getEntitlements` (see `src/lib/billing/entitlements.ts`) typically:

1. Selects from `subscriptions` by `profile_id`.
2. Selects from `usage_periods` for the active window.
3. May run a **fallback** second select on `usage_periods` if the active period row is missing.

That is **2–3 sequential async steps** (some paths await twice for usage). The student layout calls this on **every** student request, so it dominates TTFB for `/student/*`.

### How to implement

**Option A — Postgres function (RPC)**  
Create a SQL function, e.g. `get_entitlement_snapshot(p_profile_id uuid)`, that:

- Joins `subscriptions` with the correct `usage_periods` row in one statement (replicate the “active window + fallback to latest” logic in SQL, or use a `LATERAL` subquery / `ORDER BY period_end DESC LIMIT 1` with a clear rule matching current TypeScript).

- Returns a JSON or typed row matching `EntitlementSnapshot` fields (or a minimal shape you map in TypeScript).

- Expose it via `supabase.rpc("get_entitlement_snapshot", { p_profile_id: profileId })` from a single `await`.

**Why this works:** One network round trip, one plan on the database side, and RLS still applies if the function is `SECURITY INVOKER` and uses the same table policies.

**Option B — Single query with a view**  
Define a `VIEW` (or a read-only `SECURITY BARRIER` view if needed) that pre-joins subscription + “current” usage, then `select` once from the view. May still need two levels of “fallback” logic; RPC is often simpler for branching rules.

**Option C — Keep TypeScript, parallelize only where correct**  
If you cannot add SQL immediately, ensure the two `usage_periods` paths are not both awaited unnecessarily (e.g. use one query with `OR` / `order` + `limit` in PostgREST if the API allows). This is a smaller win than A/B.

**Migration / safety:** Add tests or manual checks for: no subscription row (synthetic free tier), `past_due`, `staff_override`, and missing `usage_periods` — parity with existing `deriveReason` behavior.

---

## 3. `sync_student_performance_tracker` off the hot path

### Why

Previously, `loadStudentPerformanceBundle` (`src/lib/student/student-performance-load.ts`) called `sync_student_performance_tracker` synchronously when the curriculum had topics but the tracker was empty, adding a full round-trip before render.

### Status

**Implemented:** The bundle returns `trackerNeedsHydration` instead of blocking on the RPC. The client runs `syncPerformanceTrackerFromSession` in `src/lib/student/sync-performance-tracker-action.ts` once (session-bound server action, no user id from the client), then `router.refresh()`. Settings flows that still call the RPC directly after profile updates are unchanged.

### How to implement (historical / extensions)

1. **Defer sync:** Return partial state and trigger sync via a **server action** from the client (current pattern), or a **background job** with a shared secret if you outgrow client-triggered refresh.

2. **Eager backfill:** Optionally run sync on onboarding completion (one-time path).

3. **Keep the RPC** for dev/admin “repair” if needed.

**Measure:** Compare dashboard TTFB before/after on first visit with empty tracker.

---

## 4. Caching: `unstable_cache` and tags for safe reference data

### Why

Many routes use `export const dynamic = "force-dynamic"`, which is correct for user-specific data but **prevents** static page caching. You can still cache **deterministic, slowly changing** data across requests: subject lists for a grade, plan metadata shaping, public config, etc. You already have `getCachedPlanCatalog` in `src/lib/cache/deterministic-lookups.ts`. Topic counts by grade + subject set use `getCachedTopicCountsBySubjectForGrade` in `src/lib/cache/curriculum-topic-counts.ts` (Drizzle + `DATABASE_URL`, tag `curriculum-topics`; revalidate with `revalidateCurriculumTopicCaches()` from trusted server code only).

### How to implement

1. Identify reads that are **the same for many users** or **change only on deploy / admin** (e.g. topic counts by grade, catalog transforms).

2. Wrap them in `unstable_cache(async () => ..., keyParts, { revalidate: N, tags: ['tag-name'] })`.

3. From **server actions** or **webhooks** (you already use `revalidatePath` in billing), add `revalidateTag('tag-name', 'max')` when that data actually changes (Next 16 requires a cache life profile as the second argument).

4. Do **not** put user-private rows in a shared global cache key without scoping: either cache per stable id (e.g. `['subjects', grade]`) or only public reference tables.

**Files:** add helpers next to `src/lib/cache/deterministic-lookups.ts` and call them from server loaders.

---

## 5. `cache()` (React) for per-request deduplication beyond `getServerUser`

### Why

`getServerUser` is already wrapped in `cache()` so `getUser()` runs once per request. Any **new** shared loader (combined profile, entitlement if you keep it in TS, etc.) should use the same pattern so **parallel** server components do not each trigger duplicate work.

### How to implement

```ts
import { cache } from "react";

export const getStudentSession = cache(async () => {
  // getServerUser + createClient + one profiles select + getEntitlements ...
});
```

Use **one** function per “concern” (profile vs entitlements) or one composed function — avoid N cached functions that each re-fetch the same row.

**Reference:** `src/lib/auth/get-server-user.ts`.

---

## 6. Streaming and Suspense: real parallelism for RSC

### Status

**Partially done:** Student dashboard and practice hub use async server children (`StudentDashboardAsync`, `StudentPracticeAsync`) inside `<Suspense>` with skeleton fallbacks so heavy loaders do not block the parent shell. Apply the same pattern to other heavy routes as needed.

### Why

Wrapping a client component in `<Suspense>` with a fallback **does not** speed up the server if the **parent** server component still `await`s all data before anything streams. To improve **perceived** speed, **independent** data fetches must move into **separate async server components** (or separate segments) so React can send HTML in chunks.

### How to implement

1. Split a page into **layout** (shell + fast auth check) and **child** `async` components, each calling Supabase for its slice.
2. Wrap slower children in `<Suspense fallback={...} />` **around** the async child, not only around a static client import.
3. For routes that are entirely user-specific, this does not reduce total DB time, but it can reduce **time-to-first-byte of meaningful shell** and **LCP** for above-the-fold content.

**Read:** Next.js documentation on “Streaming and Suspense” for App Router (Composition patterns).

---

## 7. Client bundle: `next/dynamic`, split large client files

### Why

Large client components (e.g. long practice and doubt chat files) increase **parse, compile, and hydration** time on the main thread. The repo already uses `next/dynamic` for:

- `StudentDashboardAnalytics` in `src/components/student/student-dashboard-view.tsx`
- `PracticeRichAnswerEditor` in `src/components/student/practice/practice-test-session.tsx`

**Why we need more of this:** Anything that pulls in `recharts`, heavy TipTap, or PDF libraries should not load until the user navigates to that view or opens a dialog.

### How to implement

1. `dynamic(() => import("..."), { ssr: false, loading: () => <Skeleton/> })` for **browser-only** or heavy interactive chunks (use sparingly; prefer default SSR for SEO when needed).
2. Extract **state hooks** (`useStudentPracticeState`) and **dumb** presentational components to shrink the top-level file and make lazy boundaries obvious.
3. For **modals and sheets** that are not open on first paint, lazy-load the modal **content** component when `open` becomes true (pattern: state-gated `dynamic` or conditional import).

**Targets:** any file over ~800 lines in `src/components/student/` that is `"use client"`; prioritize those importing `recharts`, `@tiptap/*`, or `@react-pdf/renderer`.

---

## 8. `experimental.optimizePackageImports` in `next.config.ts`

### Status

**Done** for `lucide-react` and `recharts` in `next.config.ts`. Revisit the list if bundle analysis shows more wins.

### Why

Libraries like `lucide-react` export many named icons. Without optimization, the bundler may pull more of the package than a route needs. Next.js can **rewrite** imports to deeper paths and improve tree-shaking in dev and production.

### How to implement

In `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      // "@base-ui/react", // if metrics show benefit
    ],
  },
  // ...existing headers, etc.
};
```

**Verify:** Run `pnpm build` and compare client bundle size for a heavy route (or use `@next/bundle-analyzer` if you add it). If a package does not support this pattern, remove it from the list and fall back to manual barrel avoidance (import from specific file paths when possible).

---

## 9. Framer Motion and `prefers-reduced-motion`

### Why

Layout animations and large `motion` trees can delay **first paint** and use CPU on low-end devices. You already use `useReducedMotion` in some components; **consistent** application reduces jank and work.

### How to implement

- Wrap entrance animations: if `reduced` or `reduced === true` (per `framer-motion` / `useReducedMotion()`), render static children or set `initial`/`animate` to no-op.
- Avoid animating `height: auto` on large lists (expensive); prefer opacity/transform.

**Reference:** `src/lib` framer-motion skill and existing dashboard patterns.

---

## 10. Network: region, pooler, indexes

### Why

- **Region:** If the Vercel (or other) region is far from the Supabase project, every Supabase call pays **RTT** twice (Next server → Supabase).
- **Pooler:** Direct `postgres` connections from many serverless invocations can exhaust or churn connections; the Supabase **connection pooler** (transaction mode) is the standard fix for high concurrency.
- **Indexes:** Queries filter by `student_id`, `profile_id`, `subscription_id`, and time columns. Missing indexes make each query slower under data growth.

### How to implement

1. **Deploy** the Next app in a region that matches the Supabase project (dashboard shows region; align host region).
2. **DATABASE_URL** for Drizzle: use the **pooled** connection string from Supabase docs when using serverless or many short-lived Node processes; use **session/direct** for migrations when required.
3. **Indexes:** In Drizzle migrations or Supabase SQL, add indexes for foreign keys and frequent filters. Follow `docs/EduAI_PDR_v3_0.md` and existing migration patterns. Use `EXPLAIN (ANALYZE, BUFFERS)` in staging for slow queries.

### Status

Schema already defines helpful indexes (e.g. `idx_topics_subject_grade`, `idx_usage_periods_subscription` in `src/db/schema/`). **Per deploy:** confirm host region matches Supabase, `DATABASE_URL` uses the pooler for runtime, and run `EXPLAIN` on slow paths as data grows.

**Skills reference:** `postgres-drizzle` and `supabase-postgres-best-practices` in `.agents/skills/`.

---

## 11. `next.config` and static assets

### Why

`next.config.ts` currently only sets security **headers**—which is good—but **image** optimization needs configuration when loading remote avatars with `next/image` (e.g. Supabase storage hostnames). Misconfiguration forces `<img>` or unoptimized fetches, hurting LCP and bandwidth.

### How to implement

1. Add `images.remotePatterns` (Next 14+) for each Supabase storage URL host you use in `Image` or `Avatar` with remote `src`.
2. Prefer `next/image` for large raster assets; keep `priority` only for the real LCP image.

**Why we need this:** Predictable, resized, cached images reduce **bytes** and **CLS**.

---

## 12. Sentry and performance sampling

### Status

**Tuned:** Server, edge, and client configs use lower default `tracesSampleRate` in production builds; server sets `profilesSampleRate` to `0` unless `SENTRY_PROFILES_SAMPLE_RATE` is set.

### Why

Sentry is initialized via `instrumentation.ts` and `sentry.*.config.ts`. Tracing and profiling, if always on at 100%, can add overhead and **noise**.

### Why we need tuning:** You still want error capture; you do not want APM to slow user requests in production.

### How to implement

- Set `tracesSampleRate` (and `profilesSampleRate` if used) to a **low** value in production (e.g. `0.1` or lower), higher only in staging.
- Use `beforeSend` to strip PII, not to drop performance on purpose unless required.

---

## 13. Recurring checks: `scripts/perf-check.mjs`

### Why

The repo includes `pnpm perf:check` which can run a production `next build` and optional `DATABASE_URL` and `PERF_BASE_URL` HTTP probes. **Recurring** build + route checks catch regressions when dependencies or data loaders change.

### How to implement

- In CI, run with `PERF_SKIP_BUILD=1` if the pipeline already built, and set `PERF_BASE_URL` to a preview deployment to measure `/` and `/login` timings.
- Set `PERF_ROUTE_BUDGET_MS` (e.g. `1500`) to fail the script when any probed route exceeds that wall time (useful on preview URLs).
- Extend the script (optional) to add authenticated paths using a test cookie or dedicated perf user — do not commit secrets; use CI env vars.

---

## Priority summary

| Priority | Item | Main benefit |
|----------|------|----------------|
| P0 | Single cached `profiles` (and related) read per request | Lower TTFB, less DB load |
| P0 | Fewer `getEntitlements` round trips (RPC or view) | Lower TTFB on every `/student/*` layout |
| P1 | `unstable_cache` for reference data; expand `cache()` usage | Less repeated work, better scalability |
| P1 | More `next/dynamic` for charts/editor/modals; `optimizePackageImports` | Smaller JS, faster interactive |
| P2 | Move performance tracker sync off critical path | Faster first dashboard visit |
| P2 | Region, pooler, indexes | Latency and scale at higher traffic |
| P2 | Sentry sampling, images `remotePatterns`, perf-check in CI | Safer rollouts, fewer surprises |

---

## How to use this document

- Treat each section as a **separate** PR or work item when possible (easier review and measurement).
- After P0 items, re-measure TTFB for `/student/dashboard` and a full practice flow (Lighthouse or server timing logs).
- Update this file when an item is **done** (optional short “Status” subsection per item) or keep that status in your issue tracker instead.

*Last updated: 2026-04-28*
