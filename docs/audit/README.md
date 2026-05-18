# EduAI Audit — Index

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Branch:** `main`
**Aggregate health: 82 / 100**

This folder breaks down the master [CODE_REVIEW_AUDIT.md](../../CODE_REVIEW_AUDIT.md) into per-portal artifacts. Each file lists **every** deduction with file:line evidence and the concrete fix to reach 100.

## Portals

| Portal | Current | Gap | Effort to 100 | Artifact |
|---|---:|---:|---:|---|
| Middleware (`proxy.ts`) | 88 | 12 | ~6 hr | included in security findings of [auth-portal.md](auth-portal.md) and [admin-portal.md](admin-portal.md) |
| Auth flows | 75 | 25 | ~26 hr | [auth-portal.md](auth-portal.md) |
| Admin portal | 81 | 19 | ~50 hr | [admin-portal.md](admin-portal.md) |
| Teacher portal | 72 | 28 | ~45 hr | [teacher-portal.md](teacher-portal.md) |
| Student portal | 75 | 25 | ~105 hr | [student-portal.md](student-portal.md) |
| Parent portal | 78 | 22 | ~40 hr | [parent-portal.md](parent-portal.md) |
| Public / marketing / legal | 72 | 28 | ~30 hr | [public-marketing.md](public-marketing.md) |
| **Total** | — | — | **~302 hr (~7.5 weeks for one engineer; ~3 weeks parallelized 3-up)** | |

> Cross-portal infrastructure issues (CSRF gate, CSP hardening, `requireUser` helper, root layout split, sitemap/robots) are listed in multiple portal artifacts because they lift more than one portal's score. **Do them once.**

## How to use these artifacts

1. **Pick a portal** based on business priority (which portal's score matters most this quarter?).
2. **Open its artifact** and walk the "Path to 100" checklist top-down — items are ordered by ROI (biggest score lift per hour first).
3. **Check off items as they ship** — the `[ ]` checkboxes track progress.
4. **For cross-portal items**, check the "Cross-Portal Dependencies" section so you don't re-fix the same thing for each portal.
5. **After major changes**, re-run the same five audit agents (briefs are documented in [CODE_REVIEW_AUDIT.md](../../CODE_REVIEW_AUDIT.md) under "Methodology") and bump the snapshot date.

## High-leverage cross-portal fixes (do these first)

These items appear in 3+ portal artifacts. Fixing them once moves the needle on every score:

| Fix | Where | Lifts |
|---|---|---|
| Extend `originAllowed` to `/api/{student,parent,teacher,doubt}/*` | [proxy.ts:28](../../proxy.ts) | Student +10, Parent +5, Teacher +10 Security |
| Build `requireUser({ role })` helper; replace duplicated layout checks | new `src/lib/auth/require-user.ts` | Student +7, Parent +8, Teacher +10 Auth/AuthZ |
| Drop root `dynamic = 'force-dynamic'`; split static `(public)` layout | [app/layout.tsx:68](../../app/layout.tsx) | Public +20 Performance, lifts every portal indirectly |
| Drop CSP `'unsafe-inline'` script-src | [src/lib/security/csp.ts:54](../../src/lib/security/csp.ts) | Every portal +3 Security |
| Add COOP/CORP headers | [next.config.ts:88](../../next.config.ts) | Public +3, others +2 each |
| `app/sitemap.ts` + `app/robots.ts` | new | Public +20 SEO, removes "MISSING" from master scorecard |
| Per-portal `not-found.tsx` (4 files) | new | Each portal +10 Errors+Loading and +10 SEO |
| `loading.tsx` for admin | new | Admin +15 Errors+Loading |

## Scoring rubric (so re-audits stay consistent)

Each dimension is scored 0–100 with this implicit rubric:

- **100** — best-in-class for the framework/era; nothing material to improve.
- **90–99** — strong; only nit-level improvements remain.
- **80–89** — solid; one or two clear deductions to address.
- **70–79** — acceptable; several deductions stack up.
- **60–69** — concerning; structural or governance gap.
- **< 60** — material risk or missing-feature gap.

"Overall" is **not** an arithmetic mean — it's a weighted judgment that gives extra weight to Security and Auth/AuthZ for sensitive surfaces, and to Performance + Tests for high-traffic surfaces.

## What lives where

- `CODE_REVIEW_AUDIT.md` (repo root) — master scorecard + cross-cutting findings + Quick Wins + What's Done Well.
- `docs/audit/auth-portal.md` — Supabase auth flows (login/signup/forgot/update password).
- `docs/audit/admin-portal.md` — custom bcrypt+TOTP admin auth + admin pages + SQL console sub-audit.
- `docs/audit/teacher-portal.md` — teacher dashboard + assignments + verification flow.
- `docs/audit/student-portal.md` — practice + doubt-chat + reports + settings.
- `docs/audit/parent-portal.md` — link-child + select-student + parent dashboard.
- `docs/audit/public-marketing.md` — landing + legal + OG + sitemap/robots/JSON-LD.

## Change log

| Date | Commit | Aggregate | Notes |
|---|---|---:|---|
| 2026-05-17 | `5e5c58f` | 82 | Initial per-portal artifacts split out of CODE_REVIEW_AUDIT.md |
