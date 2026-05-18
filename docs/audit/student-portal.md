# Student Portal — Audit Detail

**Snapshot:** 2026-05-17 | **Commit:** `5e5c58f` | **Scope:** `app/student/**`, `app/api/student/**`, `src/lib/student/**`, `src/lib/practice/**`, `src/components/student/**`
**Overall: 75 / 100 → target 100 (gap = 25)**

> Largest feature surface in the app. Type-safe and observably solid, but bears the bulk of structural debt (practice generation pipeline + visuals subtree) and has CSRF gaps on `/api/student/*` mutating routes.

## Score Breakdown

| Dimension | Current | Target | Gap |
|---|---:|---:|---:|
| Security | 75 | 100 | 25 |
| Auth / AuthZ | 78 | 100 | 22 |
| Validation | 85 | 100 | 15 |
| Structure | 82 | 100 | 18 |
| Performance | 70 | 100 | 30 |
| A11y | 78 | 100 | 22 |
| SEO / Meta | 35 | 100 | 65 |
| Errors + Loading | 90 | 100 | 10 |
| Observability | 85 | 100 | 15 |
| Tests | 70 | 100 | 30 |
| **Overall** | **75** | **100** | **25** |

## Path to 100 (ordered checklist)

1. [ ] Add Origin/CSRF gate to `/api/student/**` mutating routes (+10 Security)
2. [ ] Add rate limits to notification reads + `flag-question` + practice action endpoints (+8 Security)
3. [ ] Replace ad-hoc `layout.tsx` profile check with `requireUser({ role: 'student' })` (+5 Auth/AuthZ)
4. [ ] Move post-login role routing server-side (+5 Auth/AuthZ)
5. [ ] Add `metadata` for the 10 remaining student pages (+50 SEO)
6. [ ] Add `app/student/not-found.tsx` (+10 SEO + 10 Errors)
7. [ ] Shard [exemplars.ts](../../src/lib/practice/visuals/exemplars.ts) (4 589 lines) per subject (+5 Structure)
8. [ ] Split [practice-generation-pipeline.ts](../../src/lib/practice/practice-generation-pipeline.ts) (2 038 lines) into stage modules (+5 Structure)
9. [ ] Split the top 6 oversized client components (+8 Structure + 10 Performance)
10. [ ] Lazy-load Recharts in `student-dashboard-analytics` via `next/dynamic({ ssr: false })` (+8 Performance)
11. [ ] Verify Plotly chunk is genuinely lazy and not in Practice first-load (+5 Performance)
12. [ ] Add ARIA descriptions + keyboard nav to practice visuals (+12 A11y)
13. [ ] Add axe sweep on student pages (+10 A11y)
14. [ ] Add Vitest tests for new practice actions (+15 Tests)
15. [ ] Add Playwright specs for doubt-chat + notifications + reports (+15 Tests)
16. [ ] Add `.strict()` on student route Zod schemas (+10 Validation)
17. [ ] Add Sentry breadcrumbs to all practice actions (+10 Observability)

---

## Per-Dimension Deductions and Fixes

### Security — 75 / 100

**D1. `/api/student/**` mutating routes have no Origin/CSRF gate (−10)**
- Where: [proxy.ts:28](../../proxy.ts) — only `/api/admin/*` and `/api/billing/*` gated. Student routes (notifications, practice, doubt-chat, settings) trust the Supabase cookie.
- **Fix:** Extend `originAllowed` to `/api/student/*` for write verbs.

**D2. No rate limit on student notification reads or `flag-question` (−5)**
- Where: [app/api/student/notifications/route.ts](../../app/api/student/notifications/route.ts), `read-all`, `unread-count`, `[id]/route.ts`. Also [app/api/student/practice/flag-question/route.ts](../../app/api/student/practice/flag-question/route.ts).
- DB-heavy GETs unlimited; flag inserts unlimited (storage bloat risk).
- **Fix:** `applyRateLimit({ key: 'student-notif:${userId}', max: 60, window: '1m' })`. Flag-question: 30/hr/user.

**D3. Student practice session-meta / tab-blur / batch-upsert routes need limits (−4)**
- Where: `app/api/student/practice/{session-meta,tab-blur,batch-upsert-answers,abandon-submit}/route.ts`
- Some are self-limiting via session model; spot-check and add limits where missing.

**D4. CSP `'unsafe-inline'` applies to student pages (−3, cross-cutting)**

**D5. Doubt-chat attachments accept multiple MIME types; verify size+type enforcement (−3)**
- Where: [src/lib/doubt/attachments/](../../src/lib/doubt/attachments)
- Confirm Content-Type allowlist, size cap, antivirus or signed-URL pattern.
- **Fix:** Document/enforce a strict MIME allowlist; size cap 10 MB; reject if file extension and detected MIME disagree.

### Auth / AuthZ — 78 / 100

**D6. `app/student/layout.tsx:21-32` re-implements profile + role check (−7)**
- Drift risk vs parent/teacher.
- **Fix:** Use `requireUser({ role: 'student' })` helper (proposed in [auth-portal.md](auth-portal.md)).

**D7. Post-login routing is client-side via `profiles` SELECT (−5)**
- Same root cause as auth portal D5. After server-side post-auth routing lands, this disappears.

**D8. Student settings actions (account, notifications, profile) lack tenant boundary review (−5)**
- Where: `app/student/settings/{actions,account-security-actions,notification-preferences-actions}.ts`
- Confirm each action only mutates rows belonging to the authenticated user (no `user_id` from request body).
- **Fix:** Spot-check each action; replace any request-supplied `user_id` with `(await getServerUser()).id`.

**D9. Practice session ownership not double-checked on each mutation (−5)**
- Where: [app/student/practice/session-actions.ts](../../app/student/practice/session-actions.ts) and `app/api/student/practice/**`
- Some action paths trust the `testId` in payload without re-verifying ownership.
- **Fix:** Wrap `db.tests.findFirst({ where: and(eq(id, testId), eq(userId, sessionUserId)) })` and reject otherwise.

### Validation — 85 / 100

**D10. Student route Zod schemas lack `.strict()` (−10)**
- **Fix:** Codemod across `app/api/student/**`.

**D11. Notification preference shape parsed twice with subtly different schemas (−5)**
- Where: [app/student/settings/notification-preferences-types.ts](../../app/student/settings/notification-preferences-types.ts) and the action file.
- **Fix:** Single schema in `types.ts`; action imports and parses.

### Structure — 82 / 100

**D12. `src/lib/practice/visuals/exemplars.ts` is 4 589 lines (−5)**
- One giant `BASE_VISUAL_EXEMPLARS` array.
- **Fix:** Shard per subject: `exemplars/math.ts`, `exemplars/physics.ts`, etc. Re-export from `exemplars/index.ts`.

**D13. `practice-generation-pipeline.ts` is 2 038 lines, one function is 1 374 (−5)**
- Where: [src/lib/practice/practice-generation-pipeline.ts](../../src/lib/practice/practice-generation-pipeline.ts) — `runPracticeGenerationAfterResolve`
- Streaming, moderation, retry, repair, evidence-pack, telemetry all in one function.
- **Fix:** Extract stages to `src/lib/practice/pipeline/{stream-step,repair-step,evidence-step,moderation-step,telemetry-step}.ts`. Orchestrator becomes a thin loop over stages with shared context.

**D14. Six client components ≥ 800 lines (−5)**
- [practice-grading-pdf-visual.tsx](../../src/lib/student/practice-grading-pdf-visual.tsx) (1 703)
- [student-performance-view.tsx](../../src/components/student/student-performance-view.tsx) (1 380)
- [ai-grade-practice-test.tsx](../../src/lib/practice/ai-grade-practice-test.tsx) (1 143)
- [practice-test-wizard.tsx](../../src/components/student/practice/practice-test-wizard.tsx) (935)
- [student-reports-view.tsx](../../src/components/student/student-reports-view.tsx) (915)
- [practice-grading-pdf-document.tsx](../../src/lib/student/practice-grading-pdf-document.tsx) (964)
- **Fix:** Apply the same split pattern that worked for `practice-test-session/`: extract per-tab / per-section subcomponents to siblings.

**D15. Settings form is 779 lines (−3)**
- [app/student/settings/student-profile-settings-form.tsx](../../app/student/settings/student-profile-settings-form.tsx)
- **Fix:** Split into `sections/`.

### Performance — 70 / 100

**D16. Recharts statically imported in `student-dashboard-analytics.tsx` (−8)**
- Where: [src/components/student/student-dashboard-analytics.tsx:14](../../src/components/student/student-dashboard-analytics.tsx)
- Ships recharts in the student dashboard first-load chunk.
- **Fix:** `const StudentDashboardCharts = dynamic(() => import('./student-dashboard-charts'), { ssr: false, loading: () => <ChartSkeleton/> })`.

**D17. Plotly chunk size and load path (−5)**
- Where: [src/components/student/practice/visuals/renderers/statistics-chart-box.tsx:8](../../src/components/student/practice/visuals/renderers/statistics-chart-box.tsx) statically imports `plotly.js-dist-min`. Lazy-loaded by [statistics-chart.tsx:74](../../src/components/student/practice/visuals/renderers/statistics-chart.tsx) via `next/dynamic`.
- Budget cap is generous (1 400 KB). Verify the chunk is genuinely lazy and not pulled into Practice route first-load by another path.
- **Fix:** Run `pnpm analyze`; confirm `plotly` chunk only loads when a stats visual is rendered. If it leaks, isolate the import further.

**D18. Practice generation pipeline runs heavy on the server; no streaming UI feedback for some stages (−5)**
- Some stage transitions could stream progress via `Server-Sent Events` so the wizard can update incrementally.
- **Fix:** Move long stages behind SSE; reuse the existing AI SDK streaming pattern.

**D19. Student dashboard re-fetches on every nav (no `unstable_cache`) (−5)**
- Same root as teacher D16 — blocked by root `force-dynamic`.

**D20. Large client components cost CPU on hydration (−7)**
- Same root as Structure D14. Splitting unlocks tree-shaking and parallel hydration.

### A11y — 78 / 100

**D21. Practice visuals lack ARIA descriptions (−7)**
- Where: `src/components/student/practice/visuals/renderers/` — geometry, charts, physics, chemistry diagrams.
- Sighted students get a diagram; screen-reader users get nothing.
- **Fix:** Each renderer must accept an `ariaDescription` prop (or derive from the visual spec) and render a `<VisuallyHidden>` summary. Use it as `aria-label` on the wrapping `<figure>`.

**D22. Wizard step transitions don't announce focus to assistive tech (−5)**
- Where: [practice-test-wizard.tsx](../../src/components/student/practice/practice-test-wizard.tsx)
- **Fix:** On step change, move focus to the heading; emit an `aria-live="polite"` announcement of step name.

**D23. No axe sweep on student pages (−10)**
- **Fix:** Add `tests/e2e/student-a11y.spec.ts` covering dashboard, practice (mid-test), doubt-chat, reports, settings.

### SEO / Meta — 35 / 100

**D24. 10 of 13 student pages lack `metadata` (−50)**
- Only 3 have custom metadata.
- **Fix:** Add `metadata` to dashboard, practice (list + detail + grading), doubt-chat, performance, reports (list + detail), assignments, notifications, settings, ai.

**D25. No `not-found.tsx` for `app/student` (−10)**
- **Fix:** Add a portal-aware 404 page.

**D26. No structured data / JSON-LD anywhere (−5, cross-cutting)**

### Errors + Loading — 90 / 100

**D27. No `not-found.tsx` for student portal (−10)**
- Same as D25.

### Observability — 85 / 100

**D28. Practice action paths lack consistent Sentry breadcrumbs (−10)**
- Where: `app/student/practice/actions/*.ts` — generation/finalize/abandon
- **Fix:** Wrap each with `Sentry.startSpan` and add breadcrumb per branch.

**D29. Doubt-chat AI calls don't emit structured metrics (−5)**
- Token usage, latency, model id not consistently tagged.
- **Fix:** Use the AI SDK's `experimental_telemetry` and forward to Sentry with route tag.

### Tests — 70 / 100

**D30. Recent practice actions / wizard interactions lack Vitest coverage (−10)**
- Where: `app/student/practice/actions/` — verify each has a test file.

**D31. Doubt-chat happy/error path not in Playwright (−5)**
- **Fix:** `tests/e2e/student-doubt-chat.spec.ts` posting a message, asserting AI stream renders, asserting attachment upload works.

**D32. Notifications mark-read / unread-count not covered by Playwright (−5)**
- **Fix:** `tests/e2e/student-notifications.spec.ts`.

**D33. Reports PDF download not tested (−5)**
- Where: [app/api/student/reports/[testId]/pdf/route.tsx](../../app/api/student/reports/[testId]/pdf/route.tsx)
- **Fix:** Vitest test that boots the React-PDF render and snapshots a known input.

**D34. Settings/account-security flows untested in e2e (−5)**

---

## Cross-Portal Dependencies

- **D1** (CSRF gate) → fix in [proxy.ts](../../proxy.ts) once for all portals.
- **D4** (CSP) → [src/lib/security/csp.ts](../../src/lib/security/csp.ts).
- **D6/D7** (`requireUser` helper + server-side routing) → see [auth-portal.md](auth-portal.md).
- **D19** (root `force-dynamic`) → [app/layout.tsx](../../app/layout.tsx).
- **D26** (JSON-LD) → public/marketing portal.

## Estimated Effort to 100

| Bucket | Effort | Score lift |
|---|---|---:|
| `/api/student/*` Origin gate | XS (30 min) | +10 Security |
| Rate limits on notifications + flag + practice | S (2 hr) | +9 Security |
| Doubt attachment MIME hardening | S (2 hr) | +3 Security |
| Use `requireUser` in layout | XS (15 min) | +7 Auth/AuthZ |
| Server-side post-login routing | S (2 hr) | +5 Auth/AuthZ |
| Tenant boundary audit on settings actions | S (3 hr) | +5 Auth/AuthZ |
| Practice session ownership double-check | S (2 hr) | +5 Auth/AuthZ |
| `.strict()` schemas | S (2 hr) | +10 Validation |
| Notification schema dedup | XS (30 min) | +5 Validation |
| Shard exemplars.ts | M (4 hr) | +5 Structure |
| Split practice-generation-pipeline.ts | L (12 hr) | +5 Structure |
| Split 6 oversized components | L (20 hr) | +8 Structure |
| Split settings form | S (3 hr) | +3 Structure |
| Lazy-load Recharts on dashboard | S (1 hr) | +8 Performance |
| Verify Plotly chunk isolation | S (2 hr) | +5 Performance |
| Stream practice pipeline stages | M (6 hr) | +5 Performance |
| `unstable_cache` dashboard (post root split) | S (2 hr) | +5 Performance |
| Hydration cost reduction (from splits above) | included | +7 Performance |
| ARIA descriptions on visuals | M (8 hr) | +7 A11y |
| Wizard focus management | S (2 hr) | +5 A11y |
| axe sweep | M (4 hr) | +10 A11y |
| Metadata for 10 pages | S (1 hr) | +50 SEO |
| `not-found.tsx` | XS (15 min) | +10 SEO + 10 Errors |
| Vitest for new practice actions | M (4 hr) | +10 Tests |
| Playwright doubt-chat + notifications + reports | M (8 hr) | +15 Tests |
| Settings/security e2e | S (3 hr) | +5 Tests |
| Sentry breadcrumbs across actions | M (3 hr) | +10 Observability |
| AI telemetry forwarding | S (2 hr) | +5 Observability |
| **Total** | **~105 hr** | **→ 100** |

> The largest single line item is splitting the 6 oversized client components (20 hr). It's the highest-leverage item for both Structure and Performance — do it once, score lifts in both dimensions.
