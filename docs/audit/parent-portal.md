# Parent Portal — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/parent/**`, `app/api/parent/**`, `src/lib/parent/**`, `src/lib/auth/link-parent-rpc-errors.ts`
**Overall: 78 / 100 → target 100 (gap = 22)**

> Cleanest portal in the codebase. Best audit-logging discipline; structured linking error handling. Biggest score drains are SEO (0–10 % metadata coverage) and the parent-linking edge case that auto-fills a blank student `parent_email`.

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 80 | 100 | 20 |
| Auth / AuthZ | 84 | 100 | 16 |
| Validation | 88 | 100 | 12 |
| Structure | 89 | 100 | 11 |
| Performance | 80 | 100 | 20 |
| A11y | 80 | 100 | 20 |
| SEO / Meta | 30 | 100 | 70 |
| Errors + Loading | 90 | 100 | 10 |
| Observability | 88 | 100 | 12 |
| Tests | 75 | 100 | 25 |
| **Overall** | **78** | **100** | **22** |

## Path to 100 (ordered checklist)

1. [ ] Require student confirmation before parent linking when student `parent_email` is blank (+10 Security)
2. [ ] Add Origin/CSRF gate to `/api/parent/**` mutating routes (+5 Security)
3. [ ] Drop active-student cookie max-age from 400 days → 30 days (+3 Security)
4. [ ] Replace ad-hoc layout profile check with `requireUser({ role: 'parent' })` (+8 Auth/AuthZ)
5. [ ] Add metadata for the 9 remaining parent pages (+50 SEO)
6. [ ] Add `app/parent/not-found.tsx` (+10 SEO + 10 Errors)
7. [ ] Split [parent-account-settings-client.tsx](../../app/parent/(portal)/settings/parent-account-settings-client.tsx) by section (+5 Structure)
8. [ ] Lazy-load Recharts in parent dashboard analytics (+8 Performance)
9. [ ] Parallelize parent dashboard fetches (+5 Performance)
10. [ ] Add `unstable_cache` for parent dashboard aggregations (after root layout split) (+5 Performance)
11. [ ] Add ARIA descriptions to parent performance charts (+10 A11y)
12. [ ] Add axe sweep on parent pages (+10 A11y)
13. [ ] Add Playwright specs for child-link + select-student + subscription (+20 Tests)
14. [ ] Add Vitest for parent action files (+10 Tests)
15. [ ] Add `.strict()` to parent route Zod schemas (+8 Validation)

---

## Per-Dimension Deductions and Fixes

### Security — 80 / 100

**D1. Parent linking auto-fills student `parent_email` when blank (−10, P1)**
- Where: [supabase/migrations/20260429143000_eduai_parent_linking.sql:243-253](../../supabase/migrations/20260429143000_eduai_parent_linking.sql)
- If the student has no `parent_email` set, *any* verified parent who knows the 6-char link code (~6.7 M combinations) becomes the legitimate guardian. The code may have been shared casually. Only support can sever the relationship.
- **Fix:** Block the auto-fill path. If `parent_email` is blank, require the student to confirm the link in-app (push notification or pending invitation row) before activating. Increase code length to 8 chars (≈ 24 bit) and add per-student attempt cap + cooldown.

**D2. `/api/parent/**` mutating routes have no Origin/CSRF gate (−5)**
- Where: [proxy.ts:28](../../proxy.ts) — only `/api/admin/*` and `/api/billing/*` gated.
- **Fix:** Extend `originAllowed` to `/api/parent/*` on write verbs.

**D3. Parent active-student cookie max-age = 400 days (−3)**
- Where: [app/parent/select-student/actions.ts:57-63](../../app/parent/select-student/actions.ts), [app/parent/open-report/route.ts:36-43](../../app/parent/open-report/route.ts)
- `httpOnly: true` — good. Auth re-checked server-side via `assertParentActiveLink` — good. But 400 days is excessive.
- **Fix:** Drop to `maxAge: 30 * 24 * 60 * 60` (30 days). Rotate on each select.

**D4. No rate limit on parent notification reads / dashboard refresh (−2)**
- Same pattern as student notifications. Add `applyRateLimit({ key: 'parent-notif:${userId}', max: 60, window: '1m' })`.

### Auth / AuthZ — 84 / 100

**D5. `app/parent/layout.tsx:12-31` re-implements profile + suspension check (−8)**
- Drift risk vs student/teacher.
- **Fix:** `requireUser({ role: 'parent', allowSuspended: false })` once the helper lands.

**D6. `select-student` doesn't enforce single-active-link policy at the cookie level (−4)**
- If a parent's link to a student is revoked, the cookie still selects that student until `assertParentActiveLink` rejects on the next page load — fine in practice, but the cookie should be invalidated server-side too.
- **Fix:** On link revoke (`unlinkParentFromStudent`), also clear cookies for that parent across all active sessions (write a small `parent_session_invalidations` row that the layout consults).

**D7. `open-report/route.ts` redirects with student/test UUIDs interpolated (−2, low risk)**
- Where: [app/parent/open-report/route.ts:45](../../app/parent/open-report/route.ts) — both inputs are UUID-validated before interpolation; final path is a fixed prefix. Marked safe but the validation should be tightened to reject empty / malformed values explicitly.
- **Fix:** Confirm Zod `z.string().uuid()` on both query params.

**D8. CSP `'unsafe-inline'` applies to parent pages (−2, cross-cutting)**

### Validation — 88 / 100

**D9. Parent route Zod schemas lack `.strict()` (−8)**
- **Fix:** Codemod across `app/api/parent/**`.

**D10. `linkParentToStudent` action schema accepts UPPER-case codes without normalization (−4)**
- **Fix:** Normalize to upper-case at the schema layer (`.transform(s => s.toUpperCase())`) so cache keys and DB lookups stay consistent.

### Structure — 89 / 100

**D11. `parent-account-settings-client.tsx` mixes profile + notifications + linked-children in one client component (−5)**
- Where: [app/parent/(portal)/settings/parent-account-settings-client.tsx](../../app/parent/(portal)/settings/parent-account-settings-client.tsx)
- **Fix:** Split into `sections/{profile,notifications,linked-children}-section.tsx`.

**D12. `open-report` route is colocated with the portal but lives outside `(portal)/` (−3)**
- Where: [app/parent/open-report/route.ts](../../app/parent/open-report/route.ts) is at `app/parent/open-report/` next to `(portal)/`, `link-child/`, `select-student/`.
- It's a server-side redirect for parent UX, but the placement suggests it's not "portal" content. Consider moving inside `(portal)/` or creating a sibling group like `(actions)/`.

**D13. `template.tsx` exists for parent only (−3)**
- Where: [app/parent/template.tsx](../../app/parent/template.tsx)
- Templates force re-rendering on every navigation — make sure this is intentional. If it's just for animation, prefer `<motion.div>` in the layout.

### Performance — 80 / 100

**D14. Parent dashboard analytics likely use Recharts statically (−8)**
- Verify by grepping `recharts` in `src/components/parent/` and wrap with `next/dynamic({ ssr: false })`.

**D15. Dashboard fetches not parallelized (−5)**
- Confirm `Promise.all` is used for independent per-child queries; if not, parallelize.

**D16. Dashboard re-renders on every nav due to root `force-dynamic` (−5)**
- Same root cause as teacher/student. After layout split, wrap in `unstable_cache({ revalidate: 60 })`.

**D17. `template.tsx` re-renders subtree on each route change (−2; see D13)**

### A11y — 80 / 100

**D18. Performance charts lack ARIA descriptions (−10)**
- Same pattern as teacher D17. Add `<VisuallyHidden>` summaries per chart.

**D19. No axe sweep on parent pages (−10)**
- **Fix:** Add `tests/e2e/parent-a11y.spec.ts` covering dashboard, performance, reports, link-child, select-student, settings.

### SEO / Meta — 30 / 100

**D20. 9 of 10 parent pages lack `metadata` (−50)**
- Only 1 has custom metadata.
- **Fix:** Add `metadata` to dashboard, doubt-chat, assignments, notifications, performance, reports, settings, subscription, select-student, link-child.

**D21. No `not-found.tsx` for `app/parent` (−10)**
- 404 inside parent portal loses parent shell.
- **Fix:** Add `app/parent/not-found.tsx`.

**D22. No JSON-LD (−5, cross-cutting)**

**D23. `link-child` page metadata important for shared-link UX (−5)**
- If a student shares the link-code page URL with their parent via WhatsApp, the OG preview matters. Counted under D20.

### Errors + Loading — 90 / 100

**D24. No `not-found.tsx` for parent portal (−10)**
- Same as D21.

### Observability — 88 / 100

**D25. Parent dashboard fetches not Sentry-traced (−5)**
- **Fix:** Wrap dashboard data layer with `Sentry.startSpan('parent.dashboard')`.

**D26. `select-student` and `open-report` lack audit-log entries (−4)**
- Linking writes an audit row (good); selection does not.
- **Fix:** Write `audit_log` entries for `parent.student_selected` and `parent.report_opened` so support can trace parent activity.

**D27. No structured metric for link-success vs link-failure ratio (−3)**
- **Fix:** Counter on `parent.link.success` / `parent.link.failure` with reason tag.

### Tests — 75 / 100

**D28. No e2e for link-child happy + error paths (−10)**
- Where: [tests/e2e/parent-portal.spec.ts](../../tests/e2e/parent-portal.spec.ts) exists. Verify it covers linking; if not, extend it.
- **Fix:** Cover invalid code, code-not-found, code-already-claimed, success.

**D29. No e2e for select-student switching (−5)**
- **Fix:** Multi-child seed; assert cookie flip changes the dashboard.

**D30. No e2e for subscription page (−5)**
- **Fix:** `tests/e2e/parent-subscription.spec.ts` with Razorpay test mode.

**D31. Parent action files lack Vitest unit tests (−5)**
- **Fix:** Add `tests/parent/actions/` with one spec per action.

---

## Cross-Portal Dependencies

- **D2** (`/api/parent/*` CSRF gate) → fix in [proxy.ts](../../proxy.ts).
- **D5** (`requireUser` helper) → see [auth-portal.md](auth-portal.md).
- **D8** (CSP) → [src/lib/security/csp.ts](../../src/lib/security/csp.ts).
- **D16** (root `force-dynamic`) → [app/layout.tsx](../../app/layout.tsx).
- **D22** (JSON-LD) → public/marketing portal.

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| Block parent-linking auto-fill on blank student email | M (4 hr — needs RPC change + UX) | +10 Security |
| `/api/parent/*` Origin gate | XS (30 min) | +5 Security |
| Drop cookie max-age | XS (15 min) | +3 Security |
| Rate limit notifications | S (1 hr) | +2 Security |
| Use `requireUser` in layout | XS (15 min) | +8 Auth/AuthZ |
| Single-active-link invalidation on revoke | S (3 hr) | +4 Auth/AuthZ |
| Tighten open-report UUID validation | XS (30 min) | +2 Auth/AuthZ |
| `.strict()` schemas + link-code normalization | S (2 hr) | +12 Validation |
| Split parent-account-settings-client | S (3 hr) | +5 Structure |
| Move `open-report` placement (cosmetic) | XS (15 min) | +3 Structure |
| Lazy-load Recharts | S (1 hr) | +8 Performance |
| Parallelize dashboard fetches | S (2 hr) | +5 Performance |
| `unstable_cache` dashboard (post root split) | S (2 hr) | +5 Performance |
| ARIA descriptions on charts | S (3 hr) | +10 A11y |
| axe sweep | S (2 hr) | +10 A11y |
| Metadata for 10 pages | S (1 hr) | +50 SEO |
| `not-found.tsx` | XS (15 min) | +10 SEO + 10 Errors |
| Playwright link-child edge cases | M (4 hr) | +10 Tests |
| Playwright select-student + subscription | M (4 hr) | +10 Tests |
| Vitest action tests | M (4 hr) | +5 Tests |
| Sentry spans + select/open audit | S (2 hr) | +12 Observability |
| **Total** | **~40 hr** | **→ 100** |
