# Auth Flows — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/(auth)/**`, `app/auth/**`, `src/lib/auth/**`, `src/components/login-form.tsx`, `src/components/auth/sign-out-button.tsx`
**Overall: 75 / 100 → target 100 (gap = 25)**

> Auth flows for student / parent / teacher (Supabase auth). Admin's custom bcrypt+TOTP path is detailed in [admin-portal.md](admin-portal.md).

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 72 | 100 | 28 |
| Auth / AuthZ | 78 | 100 | 22 |
| Validation | 88 | 100 | 12 |
| Structure | 84 | 100 | 16 |
| Performance | 80 | 100 | 20 |
| A11y | 80 | 100 | 20 |
| SEO / Meta | 35 | 100 | 65 |
| Errors + Loading | 90 | 100 | 10 |
| Observability | 70 | 100 | 30 |
| Tests | 70 | 100 | 30 |
| **Overall** | **75** | **100** | **25** |

## Path to 100 (ordered checklist)

1. [x] Kill email enumeration on forgot-password (+8 Security) — fixed in [app/(auth)/forgot-password/actions.ts](../../app/(auth)/forgot-password/actions.ts); operational failures (config, Supabase, network) are logged but never surfaced, so response shape no longer distinguishes "email exists" from "service errored". Validation errors (bad format) remain distinct since they don't leak account existence.
2. [x] Require re-auth or fresh-token on `/auth/update-password` (+8 Security) — recovery flow now routes through `/auth/callback`, which opens an httpOnly, sameSite=strict `edu_recovery_window` cookie ([src/lib/auth/recovery-window.ts](../../src/lib/auth/recovery-window.ts), set in [app/auth/callback/route.ts](../../app/auth/callback/route.ts)). The update action ([app/auth/update-password/actions.ts](../../app/auth/update-password/actions.ts)) refuses unless that cookie is present and its userId matches the session, then forces `signOut({ scope: 'global' })` after success. Stale tabs render an "expired" page instead of the form.
3. [x] Make logout do server-side `signOut({ scope: 'global' })` and broadcast across tabs (+5 Security, +5 Auth/AuthZ) — three duplicated signOut implementations consolidated into one helper [src/lib/auth/sign-out.ts](../../src/lib/auth/sign-out.ts) (`signOutEverywhere()` — global revoke + `BroadcastChannel` notify + redirect to `/login`). A passive listener [src/components/auth/auth-signed-out-listener.tsx](../../src/components/auth/auth-signed-out-listener.tsx) mounted in student/parent/teacher layouts catches `SIGNED_OUT` events from any tab (via both `onAuthStateChange` and the BroadcastChannel) and redirects the receiver to `/login`. Buttons updated: [src/components/auth/sign-out-button.tsx](../../src/components/auth/sign-out-button.tsx), [src/components/student/student-nav-user.tsx](../../src/components/student/student-nav-user.tsx), [src/components/parent/parent-portal-sign-out.tsx](../../src/components/parent/parent-portal-sign-out.tsx).
4. [x] Replace student-only audit-action import in update-password with a role-agnostic action (+5 Auth/AuthZ) — canonical implementation moved to [src/lib/auth/account-security-actions.ts](../../src/lib/auth/account-security-actions.ts); the existing path under `app/student/settings/` now re-exports as a back-compat shim so the student in-app change-password form and its Vitest mock keep working unchanged. The recovery action imports directly from the canonical location.
5. [x] Move post-login role routing to a server action (+5 Auth/AuthZ) — new [app/(auth)/login/actions.ts](../../app/(auth)/login/actions.ts) runs `signInWithPassword` + profile read + `postAuthPathFromProfile` server-side and `redirect()`s. [src/components/login-form.tsx](../../src/components/login-form.tsx) converted to `useActionState` + `useFormStatus`; the client no longer owns role decisions or routing. E2E tests ([tests/e2e/auth.setup.ts](../../tests/e2e/auth.setup.ts), [tests/e2e/smoke.spec.ts](../../tests/e2e/smoke.spec.ts)) updated since the Supabase Auth call is no longer observable from the browser — they now wait on the redirect off `/login` as the user-visible signal.
6. [x] Extract duplicated signup helpers to `src/lib/auth/signup-client.ts` (+10 Structure) — new [src/lib/auth/signup-client.ts](../../src/lib/auth/signup-client.ts) exports `resolveEmailRedirectTo`, `buildPendingRegistrationMeta(role, payload)`, `passwordPairSchema`, and `validatePasswordPair`. All three signup forms ([student-form.tsx](../../app/(auth)/signup/student/student-form.tsx), [parent/page.tsx](../../app/(auth)/signup/parent/page.tsx), [teacher/page.tsx](../../app/(auth)/signup/teacher/page.tsx)) consume the helpers — local copies and inline meta envelopes removed; password mismatch / minimum-length checks unified under one Zod schema.
7. [x] Add per-page `metadata` for all 8 `(auth)` pages (+50 SEO) — group-wide `robots: { index: false, follow: false }` set in [(auth)/layout.tsx](../../app/(auth)/layout.tsx); per-page titles + descriptions on all 8 pages. Three client pages (forgot-password, signup/parent, signup/teacher) split into server-shell + client-form so they can export metadata. Bonus: [app/auth/update-password/page.tsx](../../app/auth/update-password/page.tsx) (outside the group) also got metadata with explicit `noindex`. Browser tabs now read e.g. "Student sign up · 24Vertex" instead of the inherited root title.
8. [x] Add `app/(auth)/not-found.tsx` (+10 SEO, +10 Errors+Loading) — new [app/(auth)/not-found.tsx](../../app/(auth)/not-found.tsx) renders a portal-aware 404 inside the existing auth shell (matches the look of `error.tsx`), with `Back to log in` + `Create an account` CTAs. Browser tab reads "Page not found · 24Vertex" and the (auth) layout's `noindex` applies.
9. [x] Add Playwright specs for signup (student/parent/teacher), forgot-password, update-password (+30 Tests) — new [tests/e2e/auth-pages.spec.ts](../../tests/e2e/auth-pages.spec.ts) covers (a) per-page titles for all 7 routes including not-found, (b) signup client-validation gates for all three roles (empty submit / step transition / password mismatch), (c) forgot-password enumeration-safe success copy, (d) update-password expired-link UI when no recovery cookie is present. Spec wired into the `unauth` Playwright project ([playwright.config.ts](../../playwright.config.ts)). Real account-creation paths still rely on the auth-setup project's storage-state.
10. [x] Add Sentry breadcrumbs + audit-log entries for student/teacher signup completion and login (+15 Observability) — new [src/lib/auth/audit.ts](../../src/lib/auth/audit.ts) writes `audit_logs` rows via Drizzle (mirrors `writeOrganizationAccessAudit`); [src/lib/auth/audit-actions.ts](../../src/lib/auth/audit-actions.ts) defines `AUTH_ACTIONS` constants + a `classifyLoginFailure` enum (`invalid_credentials`/`unverified_email`/`rate_limited`/`other`). Wired into login (success + failure with reason), update-password completion, and all three signup completion actions ([student](../../app/(auth)/signup/student/actions.ts), [parent](../../app/(auth)/signup/parent/actions.ts), [teacher](../../app/(auth)/signup/teacher/actions.ts)) with role + source in `changes`. Each branch adds a `Sentry.addBreadcrumb` so failures surface in a complete trail. Forgot-password gets a breadcrumb only — no audit row, to preserve enumeration safety (the recovery-completed event downstream provides the authoritative audit tied to a real user id).
11. [x] Add axe a11y assertion in Playwright on login + signup pages (+20 A11y) — [tests/e2e/a11y-axe.spec.ts](../../tests/e2e/a11y-axe.spec.ts) sweep extended from 5 routes to 11. New coverage: `/login/educator`, `/forgot-password` (also fixed an existing wrong URL `/auth/forgot-password` that was silently hitting the root 404), `/auth/update-password` (expired-link UI), `/signup/role-picker`, `/signup/student`, `/signup/parent`, `/signup/teacher`. Each route is independently asserted to have zero critical/serious WCAG 2.1 AA violations.
12. [x] Drop redundant client-side validation; centralize via the same Zod schemas used by server actions (+6 Validation) — every object schema in [src/lib/validations/auth.ts](../../src/lib/validations/auth.ts) now ends in `.strict()` so unknown keys are rejected at the boundary (closes D11). The student form's local `step0Schema` no longer re-declares password rules: it shrinks to a 2-field `step0AccountSchema` (fullName + email) and the password mismatch + length check is delegated to the shared `validatePasswordPair` from [signup-client.ts](../../src/lib/auth/signup-client.ts). All three signup forms, the change-password form, the recovery flow, and the login form now share a single source of truth for password gating.

---

## Per-Dimension Deductions and Fixes

### Security — 72 / 100

**D1. Email enumeration via forgot-password (−10)**
- Where: [app/(auth)/forgot-password/actions.ts:25-34](../../app/(auth)/forgot-password/actions.ts)
- Server action returns the raw Supabase error string on failure but a success shape on success. Even though the UI message ([page.tsx:46](../../app/(auth)/forgot-password/page.tsx)) is generic, the underlying server action shape leaks the boolean. Combined with `signInWithPassword` errors from the public client, an attacker can enumerate registered emails.
- **Fix:** Always return `{ success: true }` from the action; log operational errors to Sentry only. Mirror `signInWithPassword` rate-limited generic-error messaging in `src/components/login-form.tsx`.

**D2. `/auth/update-password` does not re-authenticate or verify token freshness (−10)**
- Where: [app/auth/update-password/page.tsx:39-49](../../app/auth/update-password/page.tsx)
- Calls `supabase.auth.updateUser({ password })` on whatever session the recovery link established. If the user leaves the tab open, any subsequent visitor can set a new password.
- **Fix:** Require current password OR verify a fresh recovery token via `verifyOtp({ type: 'recovery', token })` before allowing `updateUser`. After success, call `supabase.auth.signOut({ scope: 'global' })` and redirect with a one-time toast.

**D3. CSP `'unsafe-inline'` script-src applies to auth pages (−4, cross-cutting)**
- Where: [src/lib/security/csp.ts:54](../../src/lib/security/csp.ts)
- Auth pages render with the same CSP. Legacy browsers ignore `'strict-dynamic'` and fall back to `'unsafe-inline'`.
- **Fix:** Remove `'unsafe-inline'` once legacy support is no longer required; rely on `'strict-dynamic'` + per-request nonce.

**D4. Three sign-out buttons; logout is cookie-clear only (−4, cross-cutting)**
- Where: [src/components/auth/sign-out-button.tsx:10-13](../../src/components/auth/sign-out-button.tsx), [src/components/student/student-nav-user.tsx:51](../../src/components/student/student-nav-user.tsx), [src/components/parent/parent-portal-sign-out.tsx:14](../../src/components/parent/parent-portal-sign-out.tsx)
- `supabase.auth.signOut()` defaults to `{ scope: 'local' }` — refresh token survives on Supabase side. Cross-tab logout absent.
- **Fix:** Consolidate to one component. Pass `{ scope: 'global' }`. Add `supabase.auth.onAuthStateChange` listener at root layout (or `BroadcastChannel('auth')`) to redirect other tabs to `/login`.

### Auth / AuthZ — 78 / 100

**D5. Role routing decided in the browser via `profiles` SELECT (−5)**
- Where: [src/components/login-form.tsx:74-106](../../src/components/login-form.tsx)
- After `signInWithPassword`, the client SELECTs `profiles` and routes by role. On read failure, the user lands on `/` with no explanation. RLS makes this safe but UX is brittle.
- **Fix:** Convert the post-login routing to a server action that reads `getCachedAppProfileRow` and `redirect()`s server-side. Layouts can keep their role gate as defense-in-depth.

**D6. Each portal layout re-implements auth check (−5, cross-cutting)**
- Where: [app/teacher/(protected)/layout.tsx:5-15](../../app/teacher/(protected)/layout.tsx), [app/student/layout.tsx:21-32](../../app/student/layout.tsx), [app/parent/layout.tsx:12-31](../../app/parent/layout.tsx). The helper [src/lib/auth/require-verified-teacher.ts:53](../../src/lib/auth/require-verified-teacher.ts) exists but is not used.
- Drift between layouts (e.g., the `is_suspended` check is differently handled).
- **Fix:** Add `requireUser({ role, requireVerified, allowSuspended })` and replace the duplicated calls in all four layouts.

**D7. `update-password` imports a student-only audit action (−5)**
- Where: [app/auth/update-password/page.tsx:6,46](../../app/auth/update-password/page.tsx) imports `recordPasswordChangedAction` from `../../student/settings/account-security-actions`.
- For parents/teachers, the audit row is wrong or no-op.
- **Fix:** Move audit logging into a role-agnostic helper that resolves `getServerUser` and writes to the appropriate table.

**D8. `account-incomplete` page leaks an internal function name (−2)**
- Where: [app/(auth)/account-incomplete/page.tsx:10-16](../../app/(auth)/account-incomplete/page.tsx)
- User-facing copy mentions `getCachedAppProfileRow` and "check the dev server log."
- **Fix:** Keep diagnostic copy in Sentry only; show a non-technical message.

**D9. No cross-tab logout broadcast (−5; same root cause as D4)**
- See D4. Once consolidated and `scope: 'global'` is set, listen for `onAuthStateChange('SIGNED_OUT')` in root layout and `router.replace('/login')`.

### Validation — 88 / 100

**D10. Some auth payloads use ad-hoc string checks instead of the schema in [src/lib/validations/auth.ts](../../src/lib/validations/auth.ts) (−6)**
- The "passwords mismatch" + "≥ 8 chars" check is duplicated in [app/(auth)/signup/student/student-form.tsx](../../app/(auth)/signup/student/student-form.tsx), [app/(auth)/signup/parent/page.tsx](../../app/(auth)/signup/parent/page.tsx), [app/(auth)/signup/teacher/page.tsx](../../app/(auth)/signup/teacher/page.tsx), separately from the Zod schema used in the action.
- **Fix:** Export a `validatePasswordPair` schema and reuse on both client and server. Use `zodResolver` with `react-hook-form` if you want client-side errors; otherwise let the action be the single source.

**D11. Schemas not marked `.strict()` (−6)**
- Unknown keys silently pass. Low-risk in auth flows but a hardening miss.
- **Fix:** `z.object({ ... }).strict()` on all auth-action schemas in [src/lib/validations/auth.ts](../../src/lib/validations/auth.ts).

### Structure — 84 / 100

**D12. `resolveEmailRedirectTo()` copy-pasted across three signup forms (−10)**
- Where: signup student/parent/teacher files (see D10 list).
- Same for `VERTEX24_PENDING_REGISTRATION_META_KEY` JSON encoding (legacy: `EDUAI_PENDING_REGISTRATION_META_KEY`).
- **Fix:** New file `src/lib/auth/signup-client.ts` exporting `resolveEmailRedirectTo`, `buildPendingRegistrationMeta`, `validatePasswordPair`. Import from all three signup forms.

**D13. `src/lib/validations/` contains a single file (−3, cross-cutting)**
- Inconsistent with the per-domain schema convention elsewhere (`src/lib/billing/schemas`, etc.).
- **Fix:** Either move `validations/auth.ts` into `src/lib/auth/schemas.ts` and delete the folder, or split into `validations/login.ts` + `validations/signup.ts` + `validations/forgot-password.ts`.

**D14. Inconsistent server-action filenames across signup paths (−3, cross-cutting)**
- Each signup uses `actions.ts` (good) but other portals use `*-actions.ts` patterns. Standardize on the `actions/` folder pattern used by `app/student/practice/actions/`.

### Performance — 80 / 100

**D15. CSP nonce on every render forces dynamic rendering (−5, cross-cutting)**
- Root `dynamic = 'force-dynamic'` ([app/layout.tsx:68](../../app/layout.tsx)) means auth pages can't be statically rendered.
- **Fix:** Add a layout for `app/(auth)` that uses a static-friendly CSP (no per-request nonce) and remove `force-dynamic` for this subtree.

**D16. Sign-out button is shipped to every authenticated layout (−5)**
- After consolidating per D4, the button can be a single client island re-used everywhere.

**D17. Three separate signup pages re-import the same Supabase client and zod (−5)**
- Resolved by D12.

**D18. No Suspense streaming on auth pages (−5)**
- Login form blocks on hydration. Wrap the form in `<Suspense fallback={skeleton}>` so the static layout shell streams first.

### A11y — 80 / 100

**D19. No axe-core assertions on auth pages (−10)**
- Tests/e2e/a11y-axe.spec.ts exists but only covers a subset.
- **Fix:** Add login, signup (all three), forgot-password, update-password to the a11y axe sweep.

**D20. Forms lack visible focus rings on some shadcn variants (−5)**
- Spot-check shadcn Button focus ring vs. design tokens.

**D21. Error messages not announced via `aria-live` (−5)**
- Server-action error strings render inline but are not associated with the input via `aria-describedby` everywhere.
- **Fix:** Standardize a `<FormError id={...}>` component with `role="alert"`.

### SEO / Meta — 35 / 100

**D22. 0 of 8 `(auth)` pages export `metadata` (−50)**
- All 8 inherit the root title "24Vertex — Adaptive practice for grades 6 to 12."
- **Fix:** Add per-page `metadata` to login, signup (student/parent/teacher), role-picker, forgot-password, account-incomplete.

**D23. No `not-found.tsx` for the `(auth)` group (−10)**
- 404s in this group fall back to root.
- **Fix:** Add `app/(auth)/not-found.tsx` with a branded "page not found" that links back to `/login`.

**D24. No JSON-LD on login page (−5, cross-cutting)**
- Add `Organization` schema once on a shared layout.

### Errors + Loading — 90 / 100

**D25. No `not-found.tsx` for `(auth)` group (−10)**
- Same fix as D23.

### Observability — 70 / 100

**D26. Student/teacher signup completion lacks audit-log entries (−15)**
- Parent linking has rich audit log discipline (see [parent-portal.md](parent-portal.md)). Student/teacher signup writes a profile but no audit row distinct from the profile insert.
- **Fix:** Write to `audit_log` on signup success (action: `auth.signup.completed`, payload: `{ role, source: 'email' | 'oauth' }`).

**D27. Auth actions lack Sentry breadcrumbs (−10)**
- Hard to diagnose silent failures. Wrap each action with `Sentry.startSpan('auth.<name>')` and `Sentry.addBreadcrumb` on each branch.

**D28. No structured metric for failed login by reason (−5)**
- **Fix:** Emit a counter (e.g., to Sentry tags or a metrics endpoint) for `login.failed` with `reason ∈ { invalid_creds, locked, unverified_email, network }`.

### Tests — 70 / 100

**D29. No Playwright spec for student/parent/teacher signup (−10)**
- **Fix:** Add `tests/e2e/signup-student.spec.ts`, `signup-parent.spec.ts`, `signup-teacher.spec.ts`. Cover the email→callback→completion path using Supabase's local email capture.

**D30. No Playwright spec for forgot-password / update-password (−10)**
- **Fix:** Add `tests/e2e/forgot-password.spec.ts` end-to-end (with email capture stubs).

**D31. No Vitest tests for `signup/*/actions.ts` (−10)**
- **Fix:** Mock Supabase client; assert action returns correct success/error shape, RLS-safe inserts.

---

## Cross-Portal Dependencies

These deductions cannot be fully closed inside this portal alone:

- **D3** (CSP `'unsafe-inline'`) → fix in [src/lib/security/csp.ts](../../src/lib/security/csp.ts) (cross-cutting).
- **D6** (layout-level auth check duplication) → ship `requireUser` helper used by all four portals.
- **D13, D14, D24** (file-layout / SEO conventions) → ship repo-wide conventions.
- **D15** (root `force-dynamic`) → fix in [app/layout.tsx](../../app/layout.tsx).

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| Per-page metadata for 8 pages | S (1 hr) | +50 SEO |
| Forgot-password + update-password hardening | S–M (4 hr) | +18 Security |
| Logout consolidation + global revoke + cross-tab | M (4 hr) | +9 Security/Auth |
| Extract signup helpers | S (1 hr) | +10 Structure |
| Add not-found.tsx | S (15 min) | +10 SEO, +10 Errors |
| Audit log + breadcrumbs in actions | M (3 hr) | +25 Observability |
| Playwright signup + forgot-password specs | M (6 hr) | +20 Tests |
| Vitest action tests | S (3 hr) | +10 Tests |
| axe sweep on auth pages | S (2 hr) | +10 A11y |
| Static layout for `(auth)` (split from root) | M (3 hr) | +5 Performance |
| **Total** | **~26 hr** | **→ 100** |
