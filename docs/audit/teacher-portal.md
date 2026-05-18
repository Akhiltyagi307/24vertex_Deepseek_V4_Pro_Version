# Teacher Portal — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/teacher/**`, `app/api/teacher/**`, `src/lib/teachers/**`, `src/lib/auth/require-verified-teacher.ts`
**Overall: 72 / 100 → target 100 (gap = 28)**

> Smallest portal by file count but lowest test coverage (zero e2e specs). Structurally clean. Biggest score drains are tests and SEO; biggest risks are pending-approval flow and missing CSRF gate.

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 80 | 100 | 20 |
| Auth / AuthZ | 75 | 100 | 25 |
| Validation | 88 | 100 | 12 |
| Structure | 87 | 100 | 13 |
| Performance | 78 | 100 | 22 |
| A11y | 80 | 100 | 20 |
| SEO / Meta | 30 | 100 | 70 |
| Errors + Loading | 90 | 100 | 10 |
| Observability | 80 | 100 | 20 |
| Tests | 35 | 100 | 65 |
| **Overall** | **72** | **100** | **28** |

## Path to 100 (ordered checklist)

1. [ ] Add Origin/CSRF gate to `/api/teacher/**` mutating routes (+10 Security)
2. [ ] Replace ad-hoc layout check with `getVerifiedTeacherSession` everywhere (+10 Auth/AuthZ)
3. [ ] Add the `is_suspended` check + redirect to a suspension page (+5 Auth/AuthZ)
4. [ ] Add audit log around teacher pending → verified transition (+5 Auth/AuthZ + Observability)
5. [ ] Add `metadata` for all 9 teacher pages (+50 SEO)
6. [ ] Add `app/teacher/not-found.tsx` (+10 SEO + 10 Errors)
7. [ ] Split [teacher-account-settings-form.tsx](../../app/teacher/(protected)/settings/teacher-account-settings-form.tsx) (594 lines) into sections (+8 Structure)
8. [ ] Build Playwright `teacher-portal.spec.ts` (auth.setup → dashboard → assignments → student detail) (+30 Tests)
9. [ ] Build Vitest tests for teacher action files (+25 Tests)
10. [ ] Add axe sweep on teacher pages (+15 A11y)
11. [ ] Add Sentry breadcrumbs around teacher actions (+10 Observability)
12. [ ] Add `.strict()` to teacher route Zod schemas (+8 Validation)
13. [ ] Confirm `loading.tsx` skeletons match the heaviest pages (+10 Performance)

---

## Per-Dimension Deductions and Fixes

### Security — 80 / 100

**D1. `/api/teacher/**` mutating routes have no Origin/CSRF gate (−10)**
- Where: [proxy.ts:28-71](../../proxy.ts) gates only `/api/admin/*` and `/api/billing/*`. Teacher routes rely on Supabase auth cookie + `SameSite=Lax`.
- With `SameSite=Lax`, top-level cross-site POSTs still send the cookie. A malicious site can fire CSRF against teacher endpoints (e.g., create/delete assignment).
- **Fix:** Extend [proxy.ts](../../proxy.ts) so `originAllowed` ([src/lib/security/origin-guard.ts:16](../../src/lib/security/origin-guard.ts)) gates `/api/teacher/*` on `POST|PUT|PATCH|DELETE`.

**D2. Teacher actions return raw error strings on failure (−5)**
- Most teacher server actions surface Supabase / domain errors as plain text. Some include enough internal context to fingerprint stack.
- **Fix:** Map errors via a `classifyTeacherActionError` helper that returns `{ userMessage, sentryContext }`. Render `userMessage` only.

**D3. No rate limit on teacher dashboard data action (−3)**
- The dashboard pulls multiple aggregations on every request; no limit on refresh frequency.
- **Fix:** Apply `applyRateLimit({ key: `teacher-dash:${userId}`, max: 60, window: '1m' })`.

**D4. CSP `'unsafe-inline'` script-src applies to teacher pages (−2, cross-cutting)**

### Auth / AuthZ — 75 / 100

**D5. `(protected)/layout.tsx` re-implements auth check instead of using the existing helper (−10)**
- Where: [app/teacher/(protected)/layout.tsx:5-15](../../app/teacher/(protected)/layout.tsx) hand-rolls the check; [src/lib/auth/require-verified-teacher.ts:53-73](../../src/lib/auth/require-verified-teacher.ts) exists for exactly this.
- Drift risk: the `is_suspended` branch handled in the parent portal is *not* handled here.
- **Fix:** Replace the hand-rolled check with `const teacher = await getVerifiedTeacherSession();`. If `requireUser({ role: 'teacher' })` (proposed for auth portal) lands, switch to it.

**D6. Teacher pending-approval transition lightly audited (−5)**
- Where: [src/lib/admin/teacher-approval.ts:13-19](../../src/lib/admin/teacher-approval.ts) — `admin_set_teacher_verified` writes the row, but downstream audit / notification fan-out is partial.
- **Fix:** On approval, write to `audit_log` (`action: 'teacher.verified'`, actor admin id, target user id, before/after `is_verified`). Also enqueue an outbound email job (Resend) confirming verification.

**D7. No defense against rapid pending→re-signup spamming (−5)**
- A rejected teacher can re-sign up with the same email after a short cooldown.
- **Fix:** Add a `teacher_approval_history` table; reject new signups within 24 hours of a rejection unless override flag set by admin.

**D8. Teacher-org roster mutations may not check tenant boundary (−5)**
- Where: [app/teacher/(protected)/settings/org-roster-actions.ts](../../app/teacher/(protected)/settings/org-roster-actions.ts) — verify each action filters by the teacher's org_id, not by the request-supplied org_id.
- **Fix:** Resolve the teacher's org_id from the session and assert any mutation's target row matches.

### Validation — 88 / 100

**D9. Teacher route Zod schemas lack `.strict()` (−8)**
- **Fix:** `z.object({...}).strict()` on every teacher action and route handler.

**D10. Some teacher actions accept loosely-typed `Record<string, unknown>` payloads (−4)**
- Audit each action under `app/teacher/(protected)/**` and replace with concrete schemas.

### Structure — 87 / 100

**D11. `teacher-account-settings-form.tsx` is 594 lines (−8)**
- Where: [app/teacher/(protected)/settings/teacher-account-settings-form.tsx](../../app/teacher/(protected)/settings/teacher-account-settings-form.tsx)
- Multiple sections (profile, notifications, security, org roster) all in one client component.
- **Fix:** Split into `sections/profile-section.tsx`, `notifications-section.tsx`, `security-section.tsx`, `org-roster-section.tsx`. Form root becomes a tabs container.

**D12. Action filenames are inconsistent across teacher subroutes (−3)**
- `session-actions.ts`, `teacher-dashboard-actions.ts`, `student-band-filters-actions.ts`, `org-roster-actions.ts`, `account-actions.ts`.
- **Fix:** Standardize on `actions/` folder (per repo convention proposal).

**D13. `teacher-dashboard-data.ts` may duplicate logic in admin analytics (−2)**
- Cross-check with `src/lib/admin/analytics/` and extract shared aggregators to `src/lib/analytics/`.

### Performance — 78 / 100

**D14. Heavy dashboard fetches not parallelized (−8)**
- Where: [app/teacher/(protected)/dashboard/teacher-dashboard-data.ts](../../app/teacher/(protected)/dashboard/teacher-dashboard-data.ts)
- Inspect whether the multiple performance/at-risk/class queries run in parallel or serially.
- **Fix:** Use `Promise.all` for independent queries; profile cold-load with `perf:check`.

**D15. Recharts statically imported in teacher dashboard (−7)**
- Confirm by grepping `recharts` in `src/components/teacher/`; wrap heavy chart components with `next/dynamic({ ssr: false })`.

**D16. Dashboard re-renders on every nav due to `force-dynamic` cascade (−7)**
- Root layout's `force-dynamic` prevents partial caching even when individual queries could be `unstable_cache`d for short windows.
- **Fix:** After splitting root layout for static surfaces, wrap dashboard aggregations in `unstable_cache({ revalidate: 60, tags: ['teacher-dashboard'] })` and bust on relevant write actions.

### A11y — 80 / 100

**D17. Performance band strip / charts lack ARIA descriptions (−10)**
- Where: [app/teacher/(protected)/dashboard/teacher-dashboard-performance-band-strip.tsx](../../app/teacher/(protected)/dashboard/teacher-dashboard-performance-band-strip.tsx)
- Decorative SVG/chart elements with no `aria-label` describing the data.
- **Fix:** Add a `<VisuallyHidden>` summary ("3 students in red band, 5 in amber, 12 in green") sibling to each chart.

**D18. No axe sweep on teacher pages (−10)**
- **Fix:** Add `tests/e2e/teacher-a11y.spec.ts` running axe across dashboard, assignments, student-performance, settings.

### SEO / Meta — 30 / 100

**D19. 0 of 9 teacher pages export `metadata` (−50)**
- All inherit root title.
- **Fix:** Add per-page `metadata` to dashboard, assignments, settings, student-performance, topic-performance, students, pending, error, loading.

**D20. No `not-found.tsx` for `app/teacher` (−10)**
- 404s inside teacher portal lose the chrome.
- **Fix:** Add `app/teacher/not-found.tsx` with portal-aware shell.

**D21. No JSON-LD on teacher landing (−5, cross-cutting)**

**D22. `app/teacher/pending` page metadata missing (−5)**
- Counted under D19.

### Errors + Loading — 90 / 100

**D23. No `not-found.tsx` for teacher portal (−10)**
- Same as D20.

### Observability — 80 / 100

**D24. Teacher actions emit Supabase errors but no Sentry breadcrumbs (−10)**
- Hard to reconstruct failure paths.
- **Fix:** Wrap each teacher action with `Sentry.withScope` + breadcrumbs per branch (validation, RPC, success).

**D25. No metric on teacher dashboard load time / cache hit ratio (−5)**
- **Fix:** Tag `web-vitals` with `route=teacher/dashboard` and surface a Sentry dashboard panel.

**D26. Approval transition not audited (−5, same root as D6)**

### Tests — 35 / 100

**D27. ZERO Playwright e2e specs for teacher portal (−40)**
- No `tests/e2e/teacher-*.spec.ts` file exists. This is the single biggest test gap in the codebase.
- **Fix:**
  1. Add `tests/e2e/educator-auth.setup.ts` mirroring `auth.setup.ts` but for teacher creds.
  2. Add `tests/e2e/teacher-portal.spec.ts` covering: pending → verified, dashboard load, assignments create/edit/delete, student-performance drilldown.
  3. Add `tests/e2e/teacher-a11y.spec.ts` (see D18).

**D28. No Vitest tests for teacher action files (−15)**
- **Fix:** Add `tests/teacher/actions/` with one spec per `*-actions.ts` file; mock Supabase client and assert correct RLS-scoped inserts.

**D29. No tests for the verification transition or pending-approval logic (−10)**
- **Fix:** Add `src/lib/admin/teacher-approval.test.ts` (admin perspective) and `src/lib/teachers/__tests__/pending.test.ts` (teacher perspective).

---

## Cross-Portal Dependencies

- **D1** (`/api/teacher/*` CSRF gate) → fix in [proxy.ts](../../proxy.ts) (shared with student/parent).
- **D5** (`requireUser` helper) → see [auth-portal.md](auth-portal.md).
- **D16** (root `force-dynamic`) → fix in [app/layout.tsx](../../app/layout.tsx).
- **D4** (CSP) → fix in [src/lib/security/csp.ts](../../src/lib/security/csp.ts).

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| `/api/teacher/*` Origin gate | XS (30 min) | +10 Security |
| Use `getVerifiedTeacherSession` in layout | XS (15 min) | +10 Auth/AuthZ |
| Pending → verified audit + email | S (2 hr) | +5 Auth + 5 Observability |
| Re-signup cooldown | S (3 hr) | +5 Auth/AuthZ |
| Tenant boundary review on org-roster actions | S (2 hr) | +5 Auth/AuthZ |
| Metadata for 9 pages | S (1 hr) | +50 SEO |
| `not-found.tsx` | XS (15 min) | +10 SEO + 10 Errors |
| Split settings form | M (3 hr) | +8 Structure |
| Parallelize dashboard fetches | S (2 hr) | +8 Performance |
| Lazy-load Recharts in teacher dashboard | S (2 hr) | +7 Performance |
| Teacher dashboard `unstable_cache` (after layout split) | S (2 hr) | +7 Performance |
| ARIA descriptions on charts | S (2 hr) | +10 A11y |
| axe sweep | S (2 hr) | +10 A11y |
| Playwright `teacher-portal.spec.ts` | M (8 hr) | +30 Tests |
| Vitest action tests | M (6 hr) | +25 Tests |
| Approval transition tests | S (2 hr) | +10 Tests |
| Sentry breadcrumbs around actions | S (3 hr) | +10 Observability |
| `.strict()` on schemas | S (2 hr) | +8 Validation |
| Loading skeletons matching heaviest pages | S (2 hr) | +10 Performance |
| **Total** | **~45 hr** | **→ 100** |
