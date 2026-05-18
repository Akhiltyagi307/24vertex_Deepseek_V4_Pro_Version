# Admin Portal — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/admin/**`, `app/api/admin/**`, `src/lib/admin/**`
**Overall: 81 / 100 → target 100 (gap = 19)**

> Custom auth stack: bcryptjs + jose JWT + otplib TOTP, IP allowlist, panic-revoke. The Admin SQL Console has its own artifact at the end of this file because its surface area is unique.

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 82 | 100 | 18 |
| Auth / AuthZ | 84 | 100 | 16 |
| Validation | 90 | 100 | 10 |
| Structure | 88 | 100 | 12 |
| Performance | 75 | 100 | 25 |
| A11y | 70 | 100 | 30 |
| SEO / Meta | 95 | 100 | 5 |
| Errors + Loading | 75 | 100 | 25 |
| Observability | 90 | 100 | 10 |
| Tests | 60 | 100 | 40 |
| **Overall** | **81** | **100** | **19** |

## Path to 100 (ordered checklist)

1. [ ] Disable plaintext `ADMIN_PASSWORD` branch in production (+5 Security)
2. [ ] Block CTE-with-DML in read-only SQL via `SET TRANSACTION READ ONLY` (+5 Security)
3. [ ] Add per-admin rate limit on `/api/admin/system/sql/run` and `/api/admin/panic` (+4 Security)
4. [ ] Add CIDR + IPv6 support to admin IP allowlist (+2 Security)
5. [ ] Strip verbose login-error text from the wire (+2 Security)
6. [ ] Add `kid` rotation to admin JWTs or switch to ES256 + public-key edge verify (+5 Auth/AuthZ)
7. [ ] Invalidate admin session cache on logout in every Node process (+5 Auth/AuthZ)
8. [ ] Move TOTP secret to encrypted Vercel env + add rotation tracking (+3 Auth/AuthZ + Security)
9. [ ] Add `app/admin/(authenticated)/loading.tsx` (+15 Errors+Loading)
10. [ ] Add `app/admin/not-found.tsx` (+10 Errors+Loading)
11. [ ] Split [users/[userId]/page.tsx](../../app/admin/(authenticated)/users/[userId]/page.tsx) (701 lines) into per-tab files (+5 Structure)
12. [ ] Add metadata for the remaining ~12 admin pages (+5 SEO)
13. [ ] Add Vitest tests for the 137 admin route handlers (top 30 first) (+25 Tests)
14. [ ] Add Playwright admin-specific specs (curriculum import, billing reconciliation, panic) (+15 Tests)
15. [ ] Add axe sweep on top admin pages (dashboard, users list, plans, integrity) (+20 A11y)
16. [ ] Lazy-load Monaco editor / heavy admin charts via `next/dynamic({ ssr: false })` (+10 Performance)
17. [ ] Add `.strict()` on every admin route Zod schema (+5 Validation)
18. [ ] Add structured admin-action metric counters (+5 Observability)

---

## Per-Dimension Deductions and Fixes

### Security — 82 / 100

**D1. Plaintext `ADMIN_PASSWORD` fallback works in prod (−5, P0)**
- Where: [src/lib/admin/auth.ts:89-92](../../src/lib/admin/auth.ts), enabled by [src/lib/admin/login-core.ts:148](../../src/lib/admin/login-core.ts)
- An operator who copies the sample `.env` keeping `ADMIN_PASSWORD=foo` ships plaintext admin creds.
- **Fix:** Before the plain-password branch, add: `if (process.env.NODE_ENV === 'production') return false;`. Also add a startup check in `instrumentation.ts` that throws if `ADMIN_PASSWORD` is set in production.

**D2. Admin SQL console read-only accepts CTE-with-DML (−5, P0)**
- Where: [src/lib/admin/sql/read-only.ts:34-51](../../src/lib/admin/sql/read-only.ts), used by [app/api/admin/system/sql/run/route.ts:90,136](../../app/api/admin/system/sql/run/route.ts)
- Lexical check passes any statement starting with `with` — including `WITH x AS (DELETE … RETURNING …) SELECT …`.
- **Fix:** Open a dedicated connection per request and execute `SET TRANSACTION READ ONLY` before the user statement; or use a dedicated DB role for read-mode that has only SELECT on `public` schema.

**D3. TOTP secret stored as plaintext env var (−3, P1)**
- Where: [src/lib/admin/totp.ts:5-17](../../src/lib/admin/totp.ts)
- Fed straight into `otplib.verifySync`. No rotation tracking.
- **Fix:** Confirm Vercel encrypted-env storage. Add a "TOTP secret hash" row in `admin_runtime_kv` so rotation can be detected and audited.

**D4. Admin JWT HS256 with single shared secret; no `kid` rotation (−2)**
- Where: [src/lib/admin/auth.ts:107-118](../../src/lib/admin/auth.ts), [src/lib/admin/jwt-edge.ts:14-30](../../src/lib/admin/jwt-edge.ts)
- Edge guard skips DB version check (intentional for blast-radius), so a leaked secret gives admin until env rotated globally.
- **Fix:** Either (a) switch to `EdDSA`/`ES256` with public-key verify at the edge, or (b) include `kid` in the JWT header and read current `kid` from `admin_runtime_kv` so panic also rotates keys.

**D5. No per-admin rate limit on `/api/admin/system/sql/run` (−2)**
- Where: [app/api/admin/system/sql/run/route.ts:18-22](../../app/api/admin/system/sql/run/route.ts) caps body at 20 000 chars but does not rate-limit parallel executions.
- **Fix:** Apply `applyRateLimit({ key: `admin-sql:${adminId}`, max: 30, window: '1m' })`. Also queue concurrently per admin (max 2 in-flight) to bound DB pressure.

**D6. No rate limit on `/api/admin/panic` (−2)**
- Token-based, but a high-entropy secret can still be brute-forced if the token is short. A per-IP 5/10min ceiling is cheap insurance.

**D7. Admin IP allowlist uses exact-string match (no CIDR, no IPv6 normalize) (−2)**
- Where: [src/lib/admin/ip-allowlist.ts:8-30](../../src/lib/admin/ip-allowlist.ts)
- Operators behind NAT/proxy pools cannot use CIDR.
- **Fix:** Use `ip-cidr` or a small custom parser to support `203.0.113.0/24`, IPv6 normalization, and document precedence.

**D8. Verbose admin-login error text leaks deployment topology (−2)**
- Where: [src/lib/admin/login-core.ts:131-150,170-189,222-224](../../src/lib/admin/login-core.ts)
- Returns "Use Supabase's transaction pooler (host …pooler.supabase.com, port 6543)…" and similar over the wire.
- **Fix:** Return a generic "Sign-in failed" to the wire; surface the operator hint via `Sentry.captureException` so it appears in the dashboard but not the network response.

**D9. CSP `'unsafe-inline'` on script-src applies to admin pages (cross-cutting; counted under shared CSP item)**

### Auth / AuthZ — 84 / 100

**D10. Admin session cache 10s, not invalidated on logout in HA deploy (−5)**
- Where: [src/lib/admin/api-auth.ts:38-94](../../src/lib/admin/api-auth.ts), revoke at [src/lib/admin/login-core.ts:271](../../src/lib/admin/login-core.ts)
- `invalidateAdminSessionCache(jti)` is never called by the logout route, so a logged-out admin token still validates on other Node processes for up to 10 seconds.
- **Fix:** In [app/api/admin/auth/logout/route.ts:25](../../app/api/admin/auth/logout/route.ts), call `invalidateAdminSessionCache(payload.jti)` *and* bump `jwt_version` (panic-revoke style) on every logout so other nodes refuse the token even before TTL elapses.

**D11. No step-up reauth for highly sensitive actions (−5)**
- The SQL console writable mode requires a fresh TOTP code (good), but other sensitive admin actions (e.g., revoking a teacher's verification, mass deletes via integrity tools, panic) reuse the session.
- **Fix:** Define a "sensitive action" list and require a 60-second-fresh TOTP via a `requireRecentTotp()` guard in those route handlers.

**D12. JWT `kid` / key rotation missing (−5, same root as D4)**

**D13. TOTP storage layer missing rotation audit (−2, same root as D3)**

### Validation — 90 / 100

**D14. Many admin route schemas omit `.strict()` (−5)**
- Unknown keys silently pass.
- **Fix:** Repo-wide codemod: `z.object({ ... }).strict()` for every admin route handler. Add an ESLint rule via `no-restricted-syntax` matching `z.object` without `.strict()` (advisory).

**D15. Some admin actions accept multipart/form-data and urlencoded bodies (−5)**
- Where: [app/api/admin/auth/login/route.ts:31](../../app/api/admin/auth/login/route.ts)
- Useful for legacy fallback but expands attack surface. Confirm `.strict()` schemas reject unknown fields.
- **Fix:** Either drop the fallback or pin a strict schema and document the supported content-types.

### Structure — 88 / 100

**D16. `app/admin/(authenticated)/users/[userId]/page.tsx` is 701 lines (−5)**
- 8 tabs rendered inline.
- **Fix:** Move each tab into `app/admin/(authenticated)/users/[userId]/_tabs/{profile,sessions,subscriptions,audit,…}-tab.tsx`. Page becomes a tab dispatcher.

**D17. `app/admin/(authenticated)/curriculum/context-chunks/` and similar pages reuse local helper patterns (−3)**
- Each page-level data-fetching function is bespoke instead of using a shared `withAdminLoader({ schema })` helper.
- **Fix:** Add `src/lib/admin/loaders/` with shared loaders for paginated lists.

**D18. Inline server-action filenames inconsistent (−2)**
- Some pages mix `actions.ts` with sibling files (`*-actions.ts`).
- **Fix:** Standardize on `actions/` folder.

**D19. `src/lib/admin/integrity/check-runners.ts` has 11× `as unknown as` casts (−2)**
- Drizzle row → domain casts done by hand.
- **Fix:** Add a typed mapper layer `src/lib/admin/integrity/mappers.ts` so the casts disappear behind a single type-safe surface.

### Performance — 75 / 100

**D20. Heavy admin client deps shipped statically (−10)**
- Monaco editor (`@monaco-editor/react`) is used on prompt edit + SQL console pages.
- **Fix:** Wrap Monaco with `next/dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => <Skeleton/> })` everywhere it's used.

**D21. Recharts statically imported in admin analytics dashboards (−5)**
- Where: [src/components/admin/...](../../src/components/admin) — multiple admin analytics views.
- **Fix:** Wrap chart components with `next/dynamic({ ssr: false })`.

**D22. No `loading.tsx` for `app/admin/(authenticated)` (−5)**
- Slow lists (assessments, billing reconciliation, integrity) cause blank navigation.
- **Fix:** Add `app/admin/(authenticated)/loading.tsx` with a generic table skeleton + nav-aware sidebar shell.

**D23. Many admin pages fetch sequentially (−5)**
- Spot-check the heaviest pages (user detail, billing reconciliation, integrity tools) and parallelize with `Promise.all` where the fetches are independent.

### A11y — 70 / 100

**D24. Admin tables lack accessible labels on row actions (−10)**
- Icon-only "edit" / "delete" buttons in admin lists likely missing `aria-label`.
- **Fix:** Audit `src/components/admin/**` for icon buttons without `aria-label` and add them.

**D25. SQL console and integrity dashboards use complex grids with no keyboard nav (−10)**
- **Fix:** Add roving-tabindex pattern for the SQL console results grid; ensure focus management on dialogs (Radix Dialog provides this — verify it's wired).

**D26. No axe sweep on admin pages (−10)**
- **Fix:** Add a Playwright admin a11y spec that iterates the main admin URLs and runs axe.

### SEO / Meta — 95 / 100

**D27. ~12 of 65 admin pages lack `metadata` (−5)**
- Admin is correctly `noindex,nofollow` via response header ([next.config.ts:109](../../next.config.ts)), so SEO score is high. The remaining gap is page titles in browser tabs.
- **Fix:** Add `export const metadata = { title: 'Subscriptions · EduAI Admin' }` (etc.) to every admin page.

### Errors + Loading — 75 / 100

**D28. No `loading.tsx` for admin (−15)**
- Same as D22.

**D29. No `not-found.tsx` for admin (−10)**
- Bad URL inside admin falls back to root 404, losing admin chrome and the nav.
- **Fix:** Add `app/admin/not-found.tsx` that preserves the admin shell and offers "back to admin dashboard".

### Observability — 90 / 100

**D30. No structured admin-action metric counters (−5)**
- Audit log captures events; but for dashboards/SLO you want counters by action type.
- **Fix:** Emit Sentry metrics or POST to an internal metrics endpoint with `{ action, ok, latency_ms }` per admin write.

**D31. SQL console writes have audit log but no diff snapshot for impacted rows (−5)**
- Where: [app/api/admin/system/sql/run/route.ts:100-109](../../app/api/admin/system/sql/run/route.ts)
- Statement hash is logged; impacted rows / before-after diff is not.
- **Fix:** For DML on allowlisted tables, capture `OLD`/`NEW` row JSON (via `RETURNING` or a `SELECT … FOR UPDATE` pre-pass) into the audit row.

### Tests — 60 / 100

**D32. 137 admin route handlers; most untested per-route (−25)**
- `tests/admin/` covers shared logic; routes themselves rarely.
- **Fix:** Add `tests/admin/routes/` with at least one Vitest spec per route group: billing, curriculum, system, users, communications, compliance. Use a Supabase test client + admin JWT mint helper.

**D33. No Playwright spec for curriculum import end-to-end (−5)**
- **Fix:** Add `tests/e2e/admin-curriculum-import.spec.ts` that uploads a sample CSV via the admin UI.

**D34. No Playwright spec for panic-revoke flow (−5)**
- **Fix:** Add `tests/e2e/admin-panic.spec.ts` that issues a token, then panic-revokes, then asserts the token is rejected.

**D35. No Vitest tests for `src/lib/admin/sql/read-only.ts` CTE/DML escape (−5)**
- This is the highest-risk parsing code in the codebase.
- **Fix:** Add table-driven tests in `src/lib/admin/sql/__tests__/read-only.test.ts` with at least 30 statement variants (CTE-with-DML, multi-statement, comment-injected DML, copy-from, set role, etc.).

---

## Admin SQL Console — Sub-Audit

The console is good. The deductions are sharp:

| # | Issue | File | Fix |
|---|---|---|---|
| SQL-1 | CTE-with-DML escapes read-only | [src/lib/admin/sql/read-only.ts:34](../../src/lib/admin/sql/read-only.ts) | `SET TRANSACTION READ ONLY` per request, or dedicated DB role |
| SQL-2 | No per-admin rate limit | [app/api/admin/system/sql/run/route.ts](../../app/api/admin/system/sql/run/route.ts) | rate-limit + max 2 in-flight per admin |
| SQL-3 | No diff snapshot for DML | same | capture OLD/NEW rows in audit |
| SQL-4 | Plan-cost gate is per-statement, not per-session | [src/lib/admin/sql/explain.ts:14](../../src/lib/admin/sql/explain.ts) | add per-admin total cost budget per minute |

What's done well: writable mode requires TOTP refresh + DB allowlist + per-verb gate; statement hash logged; audit row written before execution.

---

## Cross-Portal Dependencies

- **CSP `'unsafe-inline'`** → fix in [src/lib/security/csp.ts](../../src/lib/security/csp.ts)
- **COOP/COEP/CORP missing** → fix in [next.config.ts](../../next.config.ts)
- **`forgot-password` enumeration** → fix in auth portal but lifts admin score indirectly (admins reset via the same flow)
- **No `requireUser` helper** → see [auth-portal.md](auth-portal.md)

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| Plaintext password prod guard | XS (15 min) | +5 Security |
| Read-only SQL hardening | S (3 hr) | +5 Security |
| Per-admin rate limits | S (2 hr) | +4 Security |
| IP allowlist CIDR | S (2 hr) | +2 Security |
| Strip verbose login errors | XS (30 min) | +2 Security |
| JWT `kid` rotation | M (4 hr) | +5 Auth/AuthZ |
| Session cache invalidate on logout | XS (30 min) | +5 Auth/AuthZ |
| TOTP rotation tracking | S (2 hr) | +3 |
| `loading.tsx` + `not-found.tsx` | XS (1 hr) | +25 Errors+Loading |
| Split `users/[userId]/page.tsx` | M (3 hr) | +5 Structure |
| Admin metadata for remaining 12 pages | S (1 hr) | +5 SEO |
| Lazy-load Monaco + Recharts | S (2 hr) | +10 Performance |
| Vitest tests for top 30 admin routes | L (12 hr) | +20 Tests |
| Playwright admin specs (curriculum, panic) | M (4 hr) | +10 Tests |
| Read-only SQL parser test suite | M (3 hr) | +5 Tests |
| axe a11y sweep + fixes | M (4 hr) | +20 A11y |
| `.strict()` on schemas + content-type pinning | S (2 hr) | +10 Validation |
| Action metrics + audit row diffs | M (3 hr) | +10 Observability |
| **Total** | **~50 hr** | **→ 100** |
