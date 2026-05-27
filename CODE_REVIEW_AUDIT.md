# 24Vertex — Full Code Review Audit

**Snapshot taken:** 2026-05-17
**Commit reviewed:** `5e5c58f` (release: v3.4.6 — teacher portal performance and access controls)
**Branch:** `claude/confident-euclid-5e4b24` (≡ `origin/main`)
**Scope:** ~1,526 tracked files. Next.js 16 (App Router) / React 19 / TypeScript / Tailwind v4 / Supabase / Drizzle / Razorpay / Resend / Sentry / Vercel.

> **How to use this doc.** Findings are organized P0 → P3 with checkboxes — tick them as they ship. Per-feature scores are a snapshot; re-run the same audits after major changes and update the table. Quick Wins is the ordered list to attack first.

---

## TL;DR

**Overall health: 82 / 100** — top-quartile codebase for its size. Type discipline, observability, server-only fencing, webhook security, and rate-limit infrastructure are genuinely strong. Structural debt is concentrated (a handful of oversized files in the practice/visuals subtree), not pervasive.

**Top 5 things to fix this week:**

1. Drop the plaintext `ADMIN_PASSWORD` fallback in production — [src/lib/admin/auth.ts:89](src/lib/admin/auth.ts).
2. Block CTE-with-DML in the admin SQL console "read-only" mode — [src/lib/admin/sql/read-only.ts:34](src/lib/admin/sql/read-only.ts).
3. Extend the CSRF/Origin gate to `/api/{student,parent,teacher,doubt}/*` — [proxy.ts:28](proxy.ts).
4. Make `forgot-password` return one shape regardless of error to kill enumeration — [app/(auth)/forgot-password/actions.ts:29](app/(auth)/forgot-password/actions.ts).
5. Invalidate admin session cache on logout — [src/lib/admin/api-auth.ts:38](src/lib/admin/api-auth.ts).

---

## Master Score Card (0 – 100)

| Feature Area | Security | Auth/AuthZ | Validation | Structure | Performance | A11y | SEO/Meta | Errors+Loading | Observability | Tests | **Overall** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Middleware (`proxy.ts`) | 88 | 88 | 95 | 92 | 88 | n/a | n/a | 90 | 80 | 80 | **88** |
| Auth flows `app/(auth)/**` | 72 | 78 | 88 | 84 | 80 | 80 | 35 | 90 | 70 | 70 | **75** |
| Admin portal `app/admin/**` | 82 | 84 | 90 | 88 | 75 | 70 | 95* | 75 | 90 | 60 | **81** |
| Teacher portal `app/teacher/**` | 80 | 75 | 88 | 87 | 78 | 80 | 30 | 90 | 80 | 35 | **72** |
| Student portal `app/student/**` | 75 | 78 | 85 | 82 | 70 | 78 | 35 | 90 | 85 | 70 | **75** |
| Parent portal `app/parent/**` | 80 | 84 | 88 | 89 | 80 | 80 | 30 | 90 | 88 | 75 | **78** |
| Public / marketing / legal | 88 | n/a | n/a | 89 | 75 | 80 | 60 | 65 | 85 | 30 | **72** |
| API surface `app/api/**` | 78 | 82 | 80 | 88 | 80 | n/a | n/a | 75 | 80 | 60 | **78** |
| Webhooks (`api/webhooks`, `api/billing/webhook`) | 93 | n/a | 90 | 88 | n/a | n/a | n/a | 92 | 90 | 50 | **86** |
| Database / Supabase | 84 | n/a | n/a | 88 | 80 | n/a | n/a | 90 | n/a | 75 | **84** |
| Admin SQL console | 80 | 92 | 90 | 88 | n/a | n/a | n/a | 95 | 95 | 60 | **86** |
| Shared lib `src/lib/**` | 90 | n/a | 88 | 83 | n/a | n/a | n/a | 88 | 90 | 85 | **86** |
| Shared components `src/components/**` | 82 | n/a | n/a | 83 | 78 | 78 | n/a | 85 | n/a | 70 | **79** |
| Tooling / CI / config | 88 | n/a | n/a | 90 | 85 | n/a | n/a | n/a | n/a | 88 | **88** |

\* Admin metadata is intentionally `noindex,nofollow` via [next.config.ts:109](next.config.ts) — the high SEO score reflects "correct posture", not search visibility.

---

## Findings Checklist

### P0 — block next release

- [ ] **(1) Plaintext `ADMIN_PASSWORD` fallback works in prod.** [src/lib/admin/auth.ts:89](src/lib/admin/auth.ts). Add `if (process.env.NODE_ENV === 'production') return false` before the plain-password branch.
- [ ] **(2) Admin "read-only" SQL console accepts `WITH ... DELETE ... RETURNING ...`.** [src/lib/admin/sql/read-only.ts:34](src/lib/admin/sql/read-only.ts). The lexical check passes any statement starting with `with`. Fix: wrap the connection in `SET TRANSACTION READ ONLY`, or use a dedicated DB role with no INSERT/UPDATE/DELETE grants for read-mode.

### P1 — fix this week

- [ ] **(3) Forgot-password leaks error text → email enumeration.** [app/(auth)/forgot-password/actions.ts:29](app/(auth)/forgot-password/actions.ts). Always return `{ success: true }`; route operational errors to Sentry.
- [ ] **(4) `/api/{student,parent,teacher,doubt}/*` mutating routes have no Origin/CSRF gate.** [proxy.ts:28](proxy.ts). SameSite=Lax leaks the cookie on top-level POST navigations. Extend `originAllowed` to those prefixes.
- [ ] **(5) Admin TOTP secret stored as plaintext env var.** [src/lib/admin/totp.ts:5](src/lib/admin/totp.ts). Add rotation tracking; alert on change; minimum: confirm Vercel encrypted env, document rotation runbook.
- [ ] **(6) Admin JWT HS256 with single shared secret; no `kid` rotation.** [src/lib/admin/auth.ts:107](src/lib/admin/auth.ts) + [src/lib/admin/jwt-edge.ts:14](src/lib/admin/jwt-edge.ts). Edge guard skips DB version check — a leaked secret gives admin until env rotated everywhere. Move to `EdDSA`/`ES256` with public-key edge verify, or add `kid` + admin_runtime_kv rotation.
- [ ] **(7) `/auth/update-password` does not re-authenticate / verify fresh token.** [app/auth/update-password/page.tsx:39](app/auth/update-password/page.tsx). Require current password or fresh recovery token; force sign-out + redirect after update.
- [ ] **(8) Drizzle is a hand-mirror; no `supabase gen types` script.** [drizzle.config.ts:6](drizzle.config.ts), [src/db/migrations/meta/_journal.json](src/db/migrations/meta/_journal.json). Add `pnpm db:gen-types` and CI-check Drizzle schema against live Postgres.
- [ ] **(9) Service-role client used in `unstable_cache` for a permissive-RLS table.** [src/lib/cache/curriculum-topic-counts.ts:14](src/lib/cache/curriculum-topic-counts.ts). No security gain; switch to request-scoped server client or Drizzle.
- [ ] **(10) Parent linking auto-fills student `parent_email` when blank.** [supabase/migrations/20260429143000_*.sql:243](supabase/migrations). Any verified parent who guesses the 6-char code becomes legitimate guardian. Require student confirmation, or require student-set `parent_email` before linking.
- [ ] **(11) CSP has `'unsafe-inline'` script-src; no Trusted-Types.** [src/lib/security/csp.ts:54](src/lib/security/csp.ts). Drop `'unsafe-inline'` once legacy-browser support is no longer required.
- [ ] **(12) Admin session cache 10s, not invalidated on logout in HA deploy.** [src/lib/admin/api-auth.ts:38](src/lib/admin/api-auth.ts). Call `invalidateAdminSessionCache(payload.jti)` from `app/api/admin/auth/logout/route.ts:25`.
- [ ] **(13) No `app/sitemap.ts` and no `app/robots.ts`.** SEO surface unmanaged; admin paths rely on header-only noindex.
- [ ] **(14) Root `app/layout.tsx:68` sets `dynamic = 'force-dynamic'`.** [app/layout.tsx:68](app/layout.tsx). Kills static rendering for `/` and `/legal/*`. Split layouts for surfaces that don't need a per-request nonce.

### P2 — fix this month

- [ ] **(15) Resend webhook has no `svix-id` dedup.** [app/api/webhooks/resend/route.ts:32](app/api/webhooks/resend/route.ts). Out-of-order retries clobber `status`/`providerPayload`. Add a small `webhook_events` table with unique `svix_id`.
- [ ] **(16) Resend webhook accepts `?token=` query-param fallback.** [app/api/webhooks/resend/route.ts:57](app/api/webhooks/resend/route.ts). Tokens land in proxy logs. Drop the query path; require Bearer or svix.
- [ ] **(17) 0 of ~153 `CREATE INDEX` calls use `CONCURRENTLY`.** Latest example: [supabase/migrations/20260618143000_teacher_portal_performance_indexes.sql:4](supabase/migrations). For post-launch indexes on hot tables, use `CREATE INDEX CONCURRENTLY` (cannot run inside a transaction — make it a standalone migration).
- [ ] **(18) COOP / COEP / CORP headers missing.** [next.config.ts:88](next.config.ts). Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`.
- [ ] **(19) `Permissions-Policy` missing `payment`, `interest-cohort`, `fullscreen`.** [next.config.ts:99](next.config.ts). Add `payment=(self "https://checkout.razorpay.com"), interest-cohort=(), fullscreen=(self)`.
- [ ] **(20) CSP `img-src https:` is over-broad.** [src/lib/security/csp.ts:54](src/lib/security/csp.ts). Allow only Supabase + Unsplash + `self/data/blob`.
- [ ] **(21) Admin IP allowlist uses exact-string match (no CIDR, no IPv6 normalize).** [src/lib/admin/ip-allowlist.ts:8](src/lib/admin/ip-allowlist.ts). Add CIDR parsing; document precedence.
- [ ] **(22) Admin SQL console has no per-admin rate limit despite 20 000-char body cap.** [app/api/admin/system/sql/run/route.ts:18](app/api/admin/system/sql/run/route.ts). Parallel expensive queries below plan-cost gate can DoS the DB.
- [ ] **(23) Verbose admin-login error text leaks deployment topology.** [src/lib/admin/login-core.ts:148](src/lib/admin/login-core.ts). Keep operator hints in Sentry; return generic "Sign-in failed".
- [ ] **(24) Three duplicated signOut buttons; logout is cookie-clear only.** [src/components/auth/sign-out-button.tsx:10](src/components/auth/sign-out-button.tsx), plus student/parent variants. Consolidate; pass `scope: 'global'`; add `onAuthStateChange` listener for cross-tab logout.
- [x] **(25) Plotly statically imported in renderer.** [src/components/student/practice/visuals/renderers/statistics-chart-box.tsx:8](src/components/student/practice/visuals/renderers/statistics-chart-box.tsx). Mitigated by `next/dynamic` upstream, but verify chunk doesn't leak into Practice first-load. **Verified 2026-05-27 via `pnpm build && pnpm bundle:budget`:** Plotly lives in exactly one Turbopack chunk at 1322.5 KB gzipped (78 KB headroom under the 1400 KB budget enforced by `scripts/bundle-budget.mjs`). The chunk is loaded lazily only when the `statistics_chart` renderer hits its box-plot sub-kind, gated by `next/dynamic({ ssr: false })` from `statistics-chart.tsx:72`. `plotly.js-dist-min` is also listed in `serverExternalPackages` in `next.config.ts:73` so it cannot end up in any server chunk. Re-audit: `pnpm build && pnpm bundle:budget` (CI gate).
- [ ] **(26) Recharts statically imported in 6 client files including `student-dashboard-analytics`.** [src/components/student/student-dashboard-analytics.tsx:14](src/components/student/student-dashboard-analytics.tsx). Wrap in `next/dynamic({ ssr: false })`.
- [ ] **(27) `app/admin/(authenticated)/loading.tsx` missing.** Only group without a skeleton — admin lists are slow routes.
- [ ] **(28) No e2e tests for teacher portal.** `tests/e2e/teacher-*.spec.ts` absent. Add `educator-auth.setup.ts` + a `teacher-portal.spec.ts` covering dashboard, assignments, student-performance.

### P3 — backlog

- [ ] **(29)** Parent active-student cookie max-age 400 days — drop to 30 [app/parent/select-student/actions.ts:62](app/parent/select-student/actions.ts).
- [ ] **(30)** `/auth/update-password` calls student-only audit action regardless of role [app/auth/update-password/page.tsx:46](app/auth/update-password/page.tsx).
- [ ] **(31)** Two duplicate migration filenames: `*_student_link_code.sql` and `*_fix_profiles_select_policy_recursion_again.sql`.
- [ ] **(32)** Inconsistent server-action filenames (`actions.ts` vs `session-actions.ts` vs `actions/` folder). Pick `actions/` folder convention.
- [ ] **(33)** Prune one-off scripts in `scripts/` (`mcp-topic-*`, `topic-sync-*`, `apply-admin-phase2-migrations.mjs`, `admin-security-phase6.mjs`, `three-breakpoint-codemod.mjs`).
- [ ] **(34)** Add JSON-LD `Organization` + `WebSite` schema on `app/page.tsx`.
- [ ] **(35)** Add `not-found.tsx` per portal group — admin/student/teacher/parent currently fall back to root 404.
- [ ] **(36)** API routes have 0 `export const revalidate` — public read-heavy endpoints miss free edge cache.

---

## Top Structural Issues

| # | File | Lines | Effort | Suggested action |
|---|---|---:|---|---|
| 1 | [src/lib/practice/visuals/exemplars.ts](src/lib/practice/visuals/exemplars.ts) | 4 589 | M | Shard per subject (`exemplars/math.ts`, `exemplars/physics.ts`, …) |
| 2 | [src/lib/practice/practice-generation-pipeline.ts](src/lib/practice/practice-generation-pipeline.ts) | 2 038 (one fn is 1 374) | L | Split into pipeline stages under `src/lib/practice/pipeline/` |
| 3 | [src/lib/student/practice-grading-pdf-visual.tsx](src/lib/student/practice-grading-pdf-visual.tsx) | 1 703 | M | Per-visual-kind files |
| 4 | [src/lib/practice/visuals/templates/index.ts](src/lib/practice/visuals/templates/index.ts) | 1 687 | M | Split per subject |
| 5 | [src/components/student/student-performance-view.tsx](src/components/student/student-performance-view.tsx) | 1 380 | M | Split tabs/cards into siblings |
| 6 | [src/lib/practice/ai-grade-practice-test.tsx](src/lib/practice/ai-grade-practice-test.tsx) | 1 143 | M | Separate UI from grading logic |
| 7 | [src/components/student/practice/visuals/renderers/physics-diagram.tsx](src/components/student/practice/visuals/renderers/physics-diagram.tsx) | 1 070 | borderline | Data-driven; OK to leave |
| 8 | [src/lib/student/practice-grading-pdf-document.tsx](src/lib/student/practice-grading-pdf-document.tsx) | 964 | M | Per-section files |
| 9 | [src/lib/practice/visuals/schemas.ts](src/lib/practice/visuals/schemas.ts) | 947 | S | Split per visual kind |
| 10 | [src/components/student/practice/practice-test-wizard.tsx](src/components/student/practice/practice-test-wizard.tsx) | 935 | M | Finish in-progress split |
| 11 | [src/components/student/student-reports-view.tsx](src/components/student/student-reports-view.tsx) | 915 | M | Split filters / cards |
| 12 | [src/lib/practice/visuals/fallback-visual-idea-aware.ts](src/lib/practice/visuals/fallback-visual-idea-aware.ts) | 869 | borderline | |
| 13 | [src/lib/practice/generation-schema.ts](src/lib/practice/generation-schema.ts) | 839 | borderline | |
| 14 | [src/components/student/practice/practice-test-session.tsx](src/components/student/practice/practice-test-session.tsx) | 798 | M | Finish in-progress split |
| 15 | [app/student/settings/student-profile-settings-form.tsx](app/student/settings/student-profile-settings-form.tsx) | 779 | M | Extract sections |
| 16 | [src/lib/practice/visuals/run-validator-pass.ts](src/lib/practice/visuals/run-validator-pass.ts) | 764 | borderline | |
| 17 | [src/components/ui/sidebar.tsx](src/components/ui/sidebar.tsx) | 744 | n/a | Vendored shadcn primitive |
| 18 | [src/lib/billing/razorpay-webhook-processor.ts](src/lib/billing/razorpay-webhook-processor.ts) | 740 | borderline | Could split per event |
| 19 | [src/lib/practice/generation-prompt-registry.ts](src/lib/practice/generation-prompt-registry.ts) | 707 | M | Split system-prompt / exemplar-renderer / subject-hints |
| 20 | [app/admin/(authenticated)/users/[userId]/page.tsx](app/admin/(authenticated)/users/[userId]/page.tsx) | 701 | M | Extract per-tab files |

**Duplication to extract:**

- [ ] `resolveEmailRedirectTo()` is copy-pasted across `app/(auth)/signup/{student/student-form,teacher/page,parent/page}.tsx`. Extract to `src/lib/auth/signup-client.ts` (plus `buildPendingRegistrationMeta`, `validatePasswordPair`).
- [ ] `getVerifiedTeacherSession` exists at [src/lib/auth/require-verified-teacher.ts:53](src/lib/auth/require-verified-teacher.ts) but [app/teacher/(protected)/layout.tsx:5](app/teacher/(protected)/layout.tsx) re-implements the check. Same drift between `app/student/layout.tsx:21` and `app/parent/layout.tsx:12`. Build `requireUser({ role })` and use it in all four layouts.

---

## Coverage Snapshots

### `error.tsx` / `loading.tsx` / `not-found.tsx` per route group

| Route group | error.tsx | loading.tsx | not-found.tsx |
|---|---|---|---|
| `app/` (root) | yes | **no** | yes |
| `app/(auth)` | yes | yes | no |
| `app/admin` | yes | **no** | no |
| `app/student` | yes | yes | no |
| `app/teacher` | yes | yes | no |
| `app/parent` | yes | yes | no |
| `app/legal` | no | no | no |

### Metadata coverage (custom `metadata` / `generateMetadata` per page)

| Group | Coverage | Status |
|---|---|---|
| `app/(auth)` | 0 / 8 (0%) | gap |
| `app/admin` | 53 / 65 (82%) | strong |
| `app/teacher` | 0 / 9 (0%) | gap |
| `app/student` | 3 / 13 (23%) | gap |
| `app/parent` | 1 / 10 (10%) | gap |
| `app/legal` | 4 / 4 (100%) | strong |

### Type-safety hygiene (whole repo)

| Marker | Count | Notes |
|---|---:|---|
| `@ts-ignore` | 0 | |
| `@ts-expect-error` | 0 | |
| `: any` (annotated) | 2 | `src/lib/practice/practice-generation-pipeline.ts:1`, `src/lib/practice/visuals/run-validator-pass.ts:1` |
| `as any` | 0 | (production code) |
| `as unknown as` | 49 across 28 files | Worst: [src/lib/admin/integrity/check-runners.ts](src/lib/admin/integrity/check-runners.ts) ×11 |
| `eslint-disable` files | 10 | All intentional, in UI primitives |
| `TODO` / `FIXME` | 2 | `src/lib/validations/auth.ts`, `src/lib/billing/proration.ts` |

### Tests inventory

- **12 Playwright e2e specs** — admin panel, parent portal, notifications, post-login, practice (generate/full/visuals), security headers, a11y (axe injected directly, not via `@axe-core/playwright`), smoke, visual snapshots.
- **74 Vitest unit specs** under `src/**/__tests__/`, `src/**/*.test.{ts,tsx}`, and `tests/{lib,admin,api,actions,components}/`.
- **Notable gaps:** zero teacher-portal e2e specs; `app/api/webhooks/resend/route.ts` has no test; most `app/api/admin/**` route handlers (137 files) lack per-route tests.

---

## Security Headers — Configured State

Configured at [proxy.ts](proxy.ts) + [next.config.ts:88](next.config.ts) + [src/lib/security/csp.ts:40](src/lib/security/csp.ts).

| Header | Value | Verdict |
|---|---|---|
| CSP `script-src` | `'self' 'strict-dynamic' nonce-... 'unsafe-inline' https://checkout.razorpay.com` (+ `'unsafe-eval'` in dev) | warn — `'unsafe-inline'` widens XSS blast radius in legacy browsers |
| CSP `style-src` | `'self' 'unsafe-inline'` | OK |
| CSP `img-src` | `'self' data: blob: https: <supabase>` | warn — `https:` is over-broad |
| CSP `frame-ancestors` | `'self'` | OK |
| HSTS (prod) | `max-age=63072000; includeSubDomains; preload` | OK |
| X-Frame-Options | `SAMEORIGIN` | OK |
| X-Content-Type-Options | `nosniff` | OK |
| Referrer-Policy | `strict-origin-when-cross-origin` | OK |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | warn — missing `payment`, `interest-cohort`, `fullscreen` |
| COOP / COEP / CORP | missing | warn — add `COOP same-origin`, `CORP same-origin` |
| X-Robots-Tag (admin) | `noindex, nofollow` | OK |

---

## Sentry — Configured State

| Layer | tracesSampleRate (prod) | Replays | beforeSend | sendDefaultPii |
|---|---|---|---|---|
| client | 0.02 (env-overridable) | session 0, on-error 0.1 | yes — `scrubSentryEvent` | false |
| server | 0.02 | n/a | yes + `beforeBreadcrumb` email redaction | false |
| edge | 0.02 | n/a | yes | false |

- Centralized scrubber: [src/lib/sentry/before-send.ts](src/lib/sentry/before-send.ts).
- Emails / JWTs / hex tokens redacted; user-id and IP hashed via FNV-1a; `request.data`, `query_string`, `cookies` stripped.
- `web-vitals/attribution` registered for CLS/FCP/INP/LCP/TTFB; routed via `Sentry.captureMessage` with low-cardinality route tag derived from pathname (UUIDs/IDs collapsed).

---

## Quick Wins (ordered by ROI)

1. [ ] Disable plaintext `ADMIN_PASSWORD` in prod — [src/lib/admin/auth.ts:89](src/lib/admin/auth.ts).
2. [ ] `SET TRANSACTION READ ONLY` on admin SQL "read-only" connection — [src/lib/admin/sql/read-only.ts:34](src/lib/admin/sql/read-only.ts).
3. [ ] `forgot-password` always returns `{ success: true }` — [app/(auth)/forgot-password/actions.ts:29](app/(auth)/forgot-password/actions.ts).
4. [ ] Extend `originAllowed` to `/api/(student|parent|teacher|doubt)/*` in [proxy.ts:28](proxy.ts).
5. [ ] Call `invalidateAdminSessionCache(jti)` from admin logout route — [app/api/admin/auth/logout/route.ts:25](app/api/admin/auth/logout/route.ts).
6. [ ] Add `app/sitemap.ts` + `app/robots.ts`.
7. [ ] Add `app/admin/(authenticated)/loading.tsx` skeleton.
8. [ ] Add per-page `metadata` for `(auth)`, `teacher`, `parent` pages.
9. [ ] Replace student-only `recordPasswordChangedAction` import in [app/auth/update-password/page.tsx:6](app/auth/update-password/page.tsx) with a role-agnostic action; require current-password / fresh-token verification before update.
10. [ ] Consolidate sign-out buttons; pass `scope: 'global'`; add `onAuthStateChange` listener.
11. [ ] Add `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-origin` to [next.config.ts:88](next.config.ts).
12. [ ] Tighten CSP `img-src` from `https:` → explicit Supabase + Unsplash allowlist; drop `'unsafe-inline'` from `script-src` once legacy-browser support not required.
13. [ ] Add `svix-id` dedup table for Resend webhook; remove `?token=` query-param fallback.
14. [ ] Add `pnpm db:gen-types` script invoking `supabase gen types typescript`; CI-check against Drizzle schema.
15. [ ] Lazy-load Recharts in `student-dashboard-analytics` via `next/dynamic({ ssr: false })`.

---

## What's Done Exceptionally Well (keep doing this)

1. **Type discipline.** 0 `@ts-ignore`, 0 `@ts-expect-error`, 2 `: any`, 0 `as any` across ~665 TS files; `eslint --max-warnings=0` enforced.
2. **Server-only fence is real.** 143 files import `"server-only"`; custom ESLint `no-restricted-imports` blocks `@/lib/supabase/admin` outside an allowlist; CI script ([scripts/ci-verify-no-service-role-in-next-static.mjs](scripts/ci-verify-no-service-role-in-next-static.mjs)) scans `.next/static` for service-role key leakage post-build.
3. **Razorpay webhook security is exemplary.** Timing-safe HMAC with rotation list ([src/lib/billing/razorpay.ts:390](src/lib/billing/razorpay.ts)), raw-body verification, deterministic SHA-256 dedup key, idempotent `billing_events` upsert via `ON CONFLICT (razorpay_event_id) DO NOTHING`, sampled Sentry on signature failures.
4. **Admin login defense-in-depth.** IP allowlist + rate limit + bcrypt (cost-12 floor in prod) + timing-safe compare + optional TOTP + JWT-version panic-revoke + per-session DB row + audit log on every outcome.
5. **Migration ledger reconciliation enforced.** Dev/prod parity is real, not aspirational, via [scripts/check-migration-drift.mjs:38](scripts/check-migration-drift.mjs) + [scripts/reconcile-supabase-migration-ledger.mjs](scripts/reconcile-supabase-migration-ledger.mjs).
6. **Sentry PII scrubbing is centralized and layered.** Emails/JWTs/hex tokens redacted; user-id and IP hashed; breadcrumb-deep.
7. **React `cache` for auth helpers.** `getServerUser` + `getCachedAppProfileRow` dedupe per request, avoiding the documented SSR refresh-token race.
8. **Rate-limit infrastructure.** LRU deny-cache + circuit breaker + fail-closed sustained-flap in prod ([src/lib/ratelimit/consume.ts](src/lib/ratelimit/consume.ts)).
9. **Bundle budgets enforced in CI.** Per-route gzipped first-load + per-visual-lib chunk budgets, with Turbopack/Next 16 fallback ([scripts/bundle-budget.mjs](scripts/bundle-budget.mjs)).
10. **Error-boundary discipline.** Shared `ErrorScreen` component used by every route group; Sentry-tagged uniformly.
11. **Responsive overhaul shipped.** Tailwind v4 dead-variant cleanup, safe-area insets, mobile-first, "xl untouched" invariant ([RESPONSIVE_AUDIT.md](RESPONSIVE_AUDIT.md), [RESPONSIVE_CHANGES.md](RESPONSIVE_CHANGES.md)).

---

## Per-Portal Verdict

- **Admin (81).** Solid governance, real defense-in-depth, but the SQL console's read-only mode has a real CTE-escape and there's a plaintext password fallback path. After those land this is a 90+.
- **Parent (78).** Cleanest portal — best audit logging, structured linking errors, good cookie hygiene. Knock-down: missing metadata, 400-day cookie TTL.
- **Student (75).** Largest feature surface; structural debt concentrated here. Type-safe but several 800 – 1 700-line client components. Practice generation pipeline is the single biggest refactor target in the repo.
- **Teacher (72).** Structurally clean and small, but **zero e2e tests** drags the score; missing metadata; `(protected)/layout.tsx` re-implements verification instead of using the existing helper.
- **Auth (75).** Forgot-password enumeration + `update-password` missing re-auth are the two real risks. Flows themselves are otherwise well-structured.
- **Public/marketing (72).** Killed by `force-dynamic` on the root layout (no SSG possible) + missing sitemap/robots/JSON-LD. Code quality is high.

---

## Methodology (so future re-audits stay consistent)

Five parallel deep-audit agents, each scoped to a different surface and producing per-feature scored findings. Dimensions scored 0 – 100 per area; "Overall" is a weighted judgment, not an arithmetic mean.

1. **Security audit** — non-auth surface: rate limiting, webhooks, validation, CSP/headers, secrets, XSS, server-action CSRF, file uploads, SSRF/open-redirect, PII hygiene.
2. **Auth + middleware** — student/parent/teacher/admin login + signup, forgot-password, OAuth callback, session management, role gating, `proxy.ts`, account-incomplete gates.
3. **Code structure** — architecture, type safety, separation of concerns, reuse, file size, dead code, naming, error handling, docs, testability.
4. **Modern web hygiene** — performance, caching, a11y, SEO, PWA/metadata, errors, loading, observability, responsive.
5. **Supabase / DB layer** — migrations, RLS, indexes, schema design, Drizzle alignment, server-side data access, admin SQL console, sync scripts, webhook → DB writes.

To re-run the audit after major changes: launch the same five agents in parallel with the same briefs, then consolidate into this document and bump the snapshot date + commit SHA at the top.

---

## Change Log

| Date | Commit | Overall | Notes |
|---|---|---:|---|
| 2026-05-17 | `5e5c58f` | 82 | Initial full-repo audit. |
