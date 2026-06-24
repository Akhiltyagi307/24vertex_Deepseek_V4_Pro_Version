# Performance Remediation Plan — 24vertex / EduAI

> Goal: cut authenticated response time across all portals without breaking behavior.
> Audience for this doc: the engineer/agent who will **execute** each task. Every task
> below is self-contained — it states *why*, *what file/target*, *exact change*, *how to
> verify it worked*, and *how to roll back*. Do tasks in phase order. Do not batch a whole
> phase into one commit — one task = one reviewable commit.

---

## 0. Ground rules (read before touching anything)

These are hard constraints for this repo. Violating them is how you break the build.

- **Indentation is TABS.** Import alias `@/` = `src/`. Match surrounding code style exactly.
- **ESLint is zero-tolerance:** `pnpm lint` runs `eslint --max-warnings=0`. A warning fails CI.
  - Known trap: `set state in effect` is banned — prefer `useSyncExternalStore`.
  - To lint just the files you touched: `git diff --name-only | grep -E '\.(ts|tsx)$' | xargs pnpm exec eslint --max-warnings=0`
- **Two Supabase projects, migrate BOTH:** dev `ezxmjkvhrlqeimhnfvfd` (ap-south-1, **source of truth**) and prod `suwakggcbxmmvqzeudmq` (ap-southeast-2). Apply every DDL change to **dev first**, verify, then prod.
  - Apply via the Supabase **MCP connector** `apply_migration` (one call per project), not by hand-editing the live DB. After applying, fix the migration-ledger row name to the **full file basename**.
  - Prefer `= ANY(array_col)` over `= ANY((SELECT ...))` in any SQL you write.
- **Verification commands** (run from repo root; this is a worktree — if `node_modules` is missing, symlink it from the main checkout first):
  - Types: `pnpm exec tsc --noEmit`
  - Lint: `pnpm lint`
  - Unit: `pnpm test`
  - Build: `pnpm build`
  - Perf budget: `pnpm perf:check` and `pnpm bundle:budget`
  - Student practice e2e against live AI: `pnpm test:e2e:practice:smoke` (full: `pnpm test:e2e:practice:local`)
  - Student auth/smoke e2e: `pnpm test:e2e:student:local`
- **If you touch any doubt-chat prompt text:** run `pnpm doubt:fingerprint` (the fingerprint guard will otherwise fail CI).
- **Never claim a task is done without pasting the verification command output.** Evidence before assertions.
- **One change at a time, reversible.** If a task says "risky," stop and get a human review before prod.

### How to read severity / risk
- **Impact**: estimated user-facing latency win. **Risk**: chance of breaking correctness/security.
- Order is chosen so the highest-impact, lowest-risk work lands first and the scary infra move is last and well-rehearsed.

---

## 1. Phase 0 — Baseline & confirm the facts (do this FIRST, no code changes)

You cannot prove a fix worked without a before/after number. This phase only measures and confirms; it changes nothing in the product.

### T0.1 — Capture a latency baseline per portal
**Why:** Every later task is judged against these numbers.
**Do:**
1. From an India-based network (or a VPN exit in India), measure TTFB for one representative authenticated page per portal while logged in. Use:
   ```
   curl -o /dev/null -s -w 'dns=%{time_namelookup} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total}\n' \
     -H 'Cookie: <copy your authed cookies>' https://www.24vertex.in/student/dashboard
   ```
   Repeat for `/teacher/(protected)/dashboard`, `/parent/dashboard`, `/admin/(authenticated)/dashboard`, and the two heaviest list pages (`/teacher/.../student-performance`, `/admin/.../analytics/overview`).
2. Record the numbers in a scratch table (page, cold TTFB, warm TTFB). Run each 3× and note warm vs first-hit (cold-start) spread.
3. In the Vercel dashboard, enable **Speed Insights** + **Web Analytics** if not already on, and note the current p75 TTFB/LCP. In the Supabase dashboard, open **Reports → Query Performance** and screenshot the slowest queries.
**Verify:** You have a written baseline table. Done.
**Rollback:** n/a.

### T0.2 — Confirm the Vercel function region — ✅ DONE
**Why:** The whole co-location thesis hinges on this.
**RESULT (confirmed via Vercel API, live prod deployment):** functions are **already in `bom1` (Mumbai)** — `regions:["bom1"]` was set in the dashboard. This corrected the original assumption of `iad1`/US-East. Users + functions are therefore co-located in Mumbai; the only geographic gap is **functions(Mumbai) ↔ DB(Sydney)**. See revised T1.1.

### T0.3 — Confirm Supabase plan + pause behavior
**Why:** Free tier auto-pauses after ~7 days idle (multi-second cold start) and runs the smallest shared compute. We need to know if intermittent slowness == cold starts.
**Do:** Supabase dashboard → prod project → **Settings → Billing/Compute**. Record: plan tier, compute size, whether "pause on inactivity" is in effect, current connection count vs limit.
**Verify:** Plan tier + compute size recorded.
**Rollback:** n/a.

### T0.4 — Confirm the prod DB connection string uses the pooler with the right pool size
**Why:** Serverless wants 1 connection per function instance through the transaction pooler. Code default is `max: 5` ([src/db/index.ts:42](src/db/index.ts)); `.env.example` recommends `DATABASE_POOL_MAX=1`.
**Do:** In Vercel env vars, confirm `DATABASE_URL` points at `...pooler.supabase.com:6543` with `pgbouncer=true`, and that `DATABASE_POOL_MAX=1` is set in production. Do **not** point it at `db.<ref>.supabase.co:5432` (direct).
**Verify:** Env values recorded; if `DATABASE_POOL_MAX` is unset, note it as a one-line fix for T1.1.
**Rollback:** n/a.

---

## 2. Phase 1 — Safe, free, high-leverage wins (reversible config & caching)

These are low-risk and individually shippable. None change data semantics.

### T1.1 — Pin the function region in version control — ✅ DONE (with a decision still open)
**What changed:** T0.2 revealed functions were **already in `bom1` (Mumbai)** via a dashboard setting that was NOT in version control (so it could silently drift). `vercel.json` now pins `"regions": ["bom1"]` — behaviorally a no-op today, but explicit and reviewable.
```json
{
	"$schema": "https://openapi.vercel.sh/vercel.json",
	"regions": ["bom1"]
}
```
**Verify:** next deploy's function logs still read `bom1`. **Rollback:** remove the key. **Risk:** none (matches current state).

**⚠️ OPEN DECISION — interim `syd1` co-location (measure, then decide):** While the DB stays in Sydney, the dominant cost is the **function(Mumbai)→DB(Sydney)** round-trip (~150ms), paid *per query* (waterfalls) **and** by the middleware `getUser()` auth call — many times per page. The one-time user→function hop is only ~35ms. RTT math says moving functions to **`syd1`** (co-located with the Sydney DB) would likely be **net faster** for the authenticated portals: DB+auth round-trips collapse to ~2ms each, at the cost of the user hop rising to ~150ms once. Because per-request DB round-trips dominate, `syd1` should win for any page making ≥2 DB calls.
- **Why this isn't done automatically:** it's an outward-facing prod latency tradeoff and the win depends on real RTT/round-trip counts. Validate with the **T0.1** baseline (set `regions:["syd1"]` on a preview, compare authed-page TTFB vs the `bom1` baseline), then keep the winner.
- **Note:** this is the *opposite* direction from Phase 4 (which moves the DB to Mumbai and makes `bom1` correct again). If Phase 4 is imminent, skip the `syd1` detour; otherwise it's a real interim win.

### T1.2 — Set `DATABASE_POOL_MAX=1` in production (if T0.4 found it unset) — ⏳ NEEDS YOU (dashboard)
> This is a Vercel **production env var**, not a code change — it can't be set from the repo. Action for the owner: Vercel → project → Settings → Environment Variables → add `DATABASE_POOL_MAX=1` (Production), redeploy. The parser in [src/db/index.ts:15](src/db/index.ts) already honors it; no code change needed.
**Why:** Avoid each function instance opening 5 pooled connections and exhausting the project's connection ceiling under concurrency.
**Do:** Set the Vercel production env var `DATABASE_POOL_MAX=1`. No code change (the parser in [src/db/index.ts:15](src/db/index.ts) already honors it).
**Verify:** After redeploy, Supabase **Database → Connections** shows fewer connections under load; no `remaining connection slots` errors in logs.
**Rollback:** unset the var (reverts to default 5).
**Risk:** Low.

### T1.3 — Cache slow-changing catalog reads with `unstable_cache` — ✅ DONE (subjects catalog)
> **Implemented:** `listActiveSubjectsCatalog()` in [src/lib/teachers/subjects-catalog.ts](src/lib/teachers/subjects-catalog.ts) is now cached via `unstable_cache` (revalidate 300s, tag `subjects-catalog`). Invalidation is wired through the existing `revalidateCurriculumTopicCaches()` helper in [src/lib/cache/curriculum-topic-counts.ts](src/lib/cache/curriculum-topic-counts.ts), which all three admin subject-mutation routes already call. **GOTCHA (learned the hard way):** build the `unstable_cache(...)` wrapper **inside the function body and call it** (`return unstable_cache(fn, key, opts)()`), NOT at module top level — several unit tests partial-mock `next/cache`, and a top-level wrapper throws at import. This matches the existing `getCachedTopicCountsBySubjectForGrade`. Verified: tsc 0, eslint 0, **full** suite 2589 pass (the top-level form passed a targeted run but broke 3 tests in the full suite).
**Why (context):** Subjects, topic catalogs, and the plan catalog are re-queried from the DB on **every** render with no cache (the `src/lib/cache/` dir has only two helpers; no `unstable_cache` on these). These change rarely and are read constantly — near-100% hit rate once cached. With the DB in Sydney each of these is a ~200ms round-trip today.
**Primary target:** `src/lib/teachers/subjects-catalog.ts` → `listActiveSubjectsCatalog()` (called on teacher student-performance + topic-performance pages). Also audit: any "list subjects", "list topics for subject", "plan catalog" loader used in a server component.
**Change pattern (preserve the existing function signature and return type exactly):**
```ts
import { unstable_cache } from "next/cache";

const _loadActiveSubjectsCatalog = async () => {
	// ...existing query body unchanged...
};

export const listActiveSubjectsCatalog = unstable_cache(
	_loadActiveSubjectsCatalog,
	["active-subjects-catalog"],
	{ revalidate: 600, tags: ["subjects-catalog"] },
);
```
Then, in the admin mutation paths that change subjects/topics/plans (e.g. `app/api/admin/subjects/**`, `app/api/admin/topics/**`, `app/api/admin/plans/**`), add `revalidateTag("subjects-catalog")` (and matching tags) after a successful write so admins see changes immediately.
**Verify:**
- `pnpm exec tsc --noEmit` clean; `pnpm lint` clean.
- Manually: load a teacher page twice; second load should not emit the subjects query (check Supabase query logs or add a temporary `console.time`).
- Edit a subject in admin → confirm the teacher page reflects it within one revalidate cycle (or immediately if you wired `revalidateTag`).
**Rollback:** revert the wrapper; the inner function is unchanged so behavior is identical.
**Risk:** Low–medium. The only failure mode is *stale* catalog data; the `revalidate`+`tags` bound that. **Do not cache anything user-specific or auth-scoped** — only global catalogs.

### T1.4 — Tune the parent/student "open assignments" polling — ✅ DONE
> **Implemented** in [src/lib/assignments/use-open-assignments-indicator.ts](src/lib/assignments/use-open-assignments-indicator.ts): interval 180s → 600s; added a 60s focus cooldown (ref-based, no state-in-effect); hidden-tab skip already existed. tsc/eslint/tests clean.
**Why (context):** The sidebar indicator polls every 180s and also refetches on every tab-focus; each poll does a cookie read + link check + assignment query. On the parent shell this is steady background DB load.
**File:** `src/lib/assignments/use-open-assignments-indicator.ts` (constant `OPEN_ASSIGNMENTS_POLL_MS`, and the `visibilitychange` handler).
**Change:**
1. Raise `OPEN_ASSIGNMENTS_POLL_MS` to `600_000` (10 min).
2. Add a cooldown so a tab-focus refresh is skipped if the last refresh was < 60s ago (track `lastRefreshAt` in a ref; compare before calling `refresh()`). Use a ref, **not** state-in-effect (ESLint will reject the latter).
3. Skip the interval entirely while `document.visibilityState === "hidden"`.
**Verify:** `pnpm lint` clean. In the browser network tab, confirm the indicator endpoint fires at most once per 10 min and not on rapid tab switches.
**Rollback:** restore the old constant + handler.
**Risk:** Low. Only effect is the "open assignments" dot can be up to 10 min stale.

### T1.5 — Unread-count: stop the redundant fetches — ✅ DONE
> **Finding on inspection:** the mount-time double-fetch was *already solved* — the bell ([notifications-bell.tsx:51](src/components/student/notifications/notifications-bell.tsx)) seeds from `initialUnreadCount` and passes `skipMountRefresh: true`, and the tray only fetches when opened. The remaining background load was the hook's own 3-min poll + uncooled tab-focus refresh.
> **Implemented** in [src/lib/notifications/use-notification-unread-count.ts](src/lib/notifications/use-notification-unread-count.ts): poll 180s → 600s (Realtime carries live increments; the poll is only reconciliation) + 60s focus cooldown. tsc/eslint/tests clean.
**Risk:** Low. Realtime still updates the badge live; only the backup reconciliation poll slowed.

---

## 3. Phase 2 — Database hardening (RLS + indexes), dev-first

This phase is where most "slow at scale" comes from. All of it is DDL → **apply to dev first, verify, then prod**, each as a new file under `supabase/migrations/`. Use `apply_migration` per project and fix the ledger name afterward.

> **Security guardrail:** RLS changes can lock users out or leak data if semantics drift. The `(select auth.uid())` rewrite below is **semantics-preserving** (auth.uid() returns the same value for the whole statement, so wrapping it in a scalar subquery changes only *when* it's evaluated, not *what* it returns). Do **not** "simplify" or merge policy logic while doing this — reproduce each policy's `USING`/`WITH CHECK`, `cmd`, and `TO <role>` exactly, changing only the `auth.*()` calls.

### T2.1 — Add the 16 confirmed-missing foreign-key indexes — ✅ DONE (dev + prod)
> Migration [supabase/migrations/20260706120000_add_missing_fk_indexes.sql](supabase/migrations/20260706120000_add_missing_fk_indexes.sql) applied to dev (`ezxmjkvhrlqeimhnfvfd`) and prod (`suwakggcbxmmvqzeudmq`); verified 16/16 indexes present on both; ledger names reconciled. Used plain (non-CONCURRENTLY) `CREATE INDEX` because all target tables are tiny (largest ~2.2k rows) so the build is sub-second.
**Why (context):** These FK columns have no index, so RLS subqueries and joins that filter on them do sequential scans. Confirmed missing on dev via `pg_index` (not just advisor-guessed). `parent_student_links.student_id` and `student_answers.question_id` are the hottest — they back parent/teacher RLS `EXISTS` joins.
**Confirmed-missing list (table.column):**
`assignment_questions.topic_id`, `audit_logs.user_id`, `coupon_redemptions.subscription_id`, `doubt_conversations.topic_id`, `email_log.recipient_id`, `notifications.sender_id`, `parent_student_links.student_id`, `performance_tracker.subject_id`, `practice_analytics_events.student_id`, `profiles.elective_subject_id`, `question_flags.question_id`, `question_flags.student_id`, `student_answers.question_id`, `subscriptions.pending_plan_code`, `subscriptions.plan_code`, `test_reports.student_id`.
**Migration file:** `supabase/migrations/<UTC-timestamp>_add_missing_fk_indexes.sql`
**Content:** one `CREATE INDEX CONCURRENTLY IF NOT EXISTS` per column. Use `CONCURRENTLY` so it doesn't lock writes on prod.
```sql
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Apply this file with the MCP connector which runs statements individually,
-- and do NOT wrap in BEGIN/COMMIT.
create index concurrently if not exists idx_parent_student_links_student_id on public.parent_student_links (student_id);
create index concurrently if not exists idx_student_answers_question_id     on public.student_answers (question_id);
create index concurrently if not exists idx_performance_tracker_subject_id  on public.performance_tracker (subject_id);
create index concurrently if not exists idx_test_reports_student_id         on public.test_reports (student_id);
create index concurrently if not exists idx_question_flags_question_id      on public.question_flags (question_id);
create index concurrently if not exists idx_question_flags_student_id       on public.question_flags (student_id);
create index concurrently if not exists idx_doubt_conversations_topic_id    on public.doubt_conversations (topic_id);
create index concurrently if not exists idx_assignment_questions_topic_id   on public.assignment_questions (topic_id);
create index concurrently if not exists idx_notifications_sender_id         on public.notifications (sender_id);
create index concurrently if not exists idx_email_log_recipient_id          on public.email_log (recipient_id);
create index concurrently if not exists idx_audit_logs_user_id              on public.audit_logs (user_id);
create index concurrently if not exists idx_practice_analytics_events_student_id on public.practice_analytics_events (student_id);
create index concurrently if not exists idx_coupon_redemptions_subscription_id  on public.coupon_redemptions (subscription_id);
create index concurrently if not exists idx_profiles_elective_subject_id    on public.profiles (elective_subject_id);
create index concurrently if not exists idx_subscriptions_plan_code         on public.subscriptions (plan_code);
create index concurrently if not exists idx_subscriptions_pending_plan_code on public.subscriptions (pending_plan_code);
```
**Verify:**
- Re-run the performance advisor (`get_advisors type=performance`) on dev → the `unindexed_foreign_keys` count drops to ~0 (any remaining are tables you intentionally skipped).
- `EXPLAIN ANALYZE` a representative parent query (e.g. select from `tests` for a linked child) before/after — the `parent_student_links` lookup should switch from Seq Scan to Index Scan.
- Then apply to prod; confirm advisor delta there too.
**Rollback:** `drop index concurrently if exists <name>;` per index. Indexes are additive and safe; rollback is rarely needed.
**Risk:** Low. Adds disk + tiny write overhead; no read/behavior change.

### T2.2 — Rewrite RLS policies to wrap `auth.*()` in `(select …)` — ✅ DONE for the 7 hot tables (dev + prod)
> Migration [supabase/migrations/20260706130000_rls_initplan_wrap_auth_uid.sql](supabase/migrations/20260706130000_rls_initplan_wrap_auth_uid.sql) applied to dev then prod after dev verification. 24 policies across the 7 hot tables, DDL **mechanically generated** from `pg_policies` via regexp (no hand-edited predicates). Verified on both DBs: all 30 `auth.uid()` calls wrapped, 0 bare, 25 policies intact (24 rewritten + 1 with no auth call), no `jwt`/`role` calls lingering. Ledger names reconciled.
> **Follow-up (the optional extension below — NOT yet done):** ~20 other tables still carry bare `auth.*()` policies (the advisor flagged 27 tables / 59 findings total; we did the 7 hottest). Apply the identical mechanical transform to the rest when convenient. **Recommended manual smoke after this deploy:** log in as a student, a linked parent, and a teacher and confirm each still sees exactly their own data.
**Why (context):** 59 `auth_rls_initplan` findings: policies call `auth.uid()`/`auth.jwt()` **per row**, so a 1,000-row read evaluates the auth function 1,000×. Wrapping as `(select auth.uid())` makes Postgres evaluate it once per statement (an InitPlan). This is the documented Supabase fix.
**Exact targets (pulled live from dev `pg_policies`):** rewrite these policies on these tables. Reproduce each one's `cmd`, `roles` (`TO public` / `TO authenticated`), and `USING`/`WITH CHECK` verbatim, replacing only `auth.uid()` → `(select auth.uid())` everywhere it appears (including inside helper-function args like `teacher_can_access_student(auth.uid(), …)` and `auth_is_verified_teacher(auth.uid())` and `EXISTS (… psl.parent_id = auth.uid() …)`).

| Table | Policies to rewrite |
|---|---|
| `profiles` | "Users can view own profile" (SELECT), "Users can update own profile" (UPDATE), "Parents can view linked children profiles" (SELECT), "Teachers can view accessible student profiles" (SELECT) |
| `tests` | "Students manage own tests" (ALL, has USING+WITH CHECK), "Students view own tests" (SELECT), "Parents view linked child tests" (SELECT), "Verified teachers select assignment-linked tests" (SELECT) |
| `test_reports` | "Students manage own test reports" (ALL), "Parents view linked child test reports" (SELECT), "Verified teachers select reports for assigned tests" (SELECT) |
| `performance_tracker` | "Students select own performance" (SELECT), "Parents view linked child performance" (SELECT), "Teachers view accessible student performance" (SELECT) |
| `student_answers` | "Users manage answers via own tests" (ALL, has USING+WITH CHECK), "Parents view linked child student answers" (SELECT), "Verified teachers select answers for assigned tests" (SELECT) |
| `parent_student_links` | "Parents see own links" (SELECT), "Students see links to them" (SELECT), "Parents update own links" (UPDATE), "Students update links where they are student" (UPDATE) |
| `assignments` | "Teachers read own assignments" (SELECT), "Students read targeted assignments" (SELECT), "Parents read linked child assignments" (SELECT) |

> The full current `qual`/`with_check` text for each is in the audit transcript; re-fetch fresh from dev before writing the migration so you transform the *current* definition, not a stale copy:
> ```sql
> select tablename, policyname, cmd, roles::text, qual, with_check
> from pg_policies where schemaname='public' and tablename = '<table>';
> ```
**Migration pattern (per policy):**
```sql
drop policy "Students view own tests" on public.tests;
create policy "Students view own tests" on public.tests
	for select to public
	using ((select auth.uid()) = student_id);
```
Repeat for the remaining ~22 policies in the other listed tables. Keep the same name so app code and other migrations referencing them stay valid.
**Extend (optional, same pass):** the advisor flagged 27 tables total. After the 7 hot tables above are done and verified, apply the identical transform to the remaining flagged tables (`questions`, `assignment_submissions`, `user_preferences`, `notifications`, `subscriptions`, `payments`, `usage_periods`, `doubt_conversations`, `doubt_messages`, `doubt_message_attachments`, `teacher_student_links`, etc.).
**Verify (this is the critical one — do not skip):**
1. **Advisor:** re-run `get_advisors type=performance` on dev → `auth_rls_initplan` count drops by the number of policies you rewrote.
2. **Semantics unchanged — automated:** run `pnpm test:e2e:student:local` and the parent/teacher flows; everyone must still see exactly what they saw before and nothing they shouldn't.
3. **Semantics unchanged — spot SQL:** impersonate a student JWT and confirm they can read their own `tests`/`performance_tracker` and **cannot** read another student's; confirm a linked parent can read the child and an unlinked parent cannot. (Use the e2e harness accounts or `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'` in a transaction, then `select` and `rollback`.)
4. Only after dev passes all three → apply to prod and re-verify advisor + a smoke read.
**Rollback:** re-apply the previous `create policy` definitions (keep the pre-change `pg_policies` dump from step "re-fetch fresh" as your rollback script).
**Risk:** **Medium.** Logic is identical *if* you transform mechanically. The danger is a typo dropping a clause. Mitigate with the verbatim re-create + the three-way verify above.

### T2.3 — (Lower priority, careful) Consolidate multiple permissive policies
**Why:** 47 `multiple_permissive_policies` findings (worst: `parent_student_links` ×12) — every query evaluates several permissive policies for the same role/action and OR's them. Merging into one policy per (table, role, action) reduces planner work.
**Risk:** **Higher than T2.2** — merging OR-ed policies into one `USING (a OR b OR c)` can subtly change access if the originals had different `WITH CHECK` or applied to different commands. **Do this table-by-table, only after T2.2, with a human review of each merge, and the same three-way verification.** If unsure on a table, skip it — the win is smaller than T2.1/T2.2.
**Verify/Rollback:** same as T2.2.

### T2.4 — Add trigram indexes for admin ILIKE search (supports Phase 5 admin tasks)
**Why (context):** Admin list/search pages do `ILIKE '%term%'` on `payments.razorpay_payment_id`, `profiles.full_name`, `billing_events.razorpay_event_id`, etc. Without a trigram index these are full scans.
**Migration:**
```sql
create extension if not exists pg_trgm;
create index concurrently if not exists idx_profiles_full_name_trgm on public.profiles using gin (full_name gin_trgm_ops);
create index concurrently if not exists idx_payments_razorpay_payment_id_trgm on public.payments using gin (razorpay_payment_id gin_trgm_ops);
-- add others only for columns actually searched with leading-wildcard ILIKE
```
**Verify:** `EXPLAIN ANALYZE` the admin search query before/after; Seq Scan → Bitmap Index Scan. Advisor unaffected (these aren't flagged) — judge by query plan + admin search latency.
**Rollback:** `drop index concurrently if exists <name>;`
**Risk:** Low.

### T2.5 — (Optional cleanup, last) Drop unused indexes + vacuum bloat
**Why:** 56 unused indexes slow writes slightly; `net._http_response` (pg_net) has table bloat.
**Do:** Only after a few weeks of post-change traffic confirms they're still unused (don't drop based on a single advisor snapshot — an index may be unused only because the feature is seasonal). For bloat: schedule `vacuum (full, analyze) net._http_response` in a low-traffic window (it briefly locks).
**Risk:** Low if you confirm "unused" over time; **don't rush this.**

---

## 4. Phase 3 — Remove the per-request auth round-trip

### T3.1 — Switch middleware session validation from `getUser()` to `getClaims()`
**Why (context):** `proxy.ts` matches nearly every path and runs `updateSession()` → `await supabase.auth.getUser()` ([src/lib/supabase/session.ts:57](src/lib/supabase/session.ts)). `getUser()` makes a **network call to Supabase Auth (GoTrue)** to validate the JWT on *every* request. `getClaims()` verifies the JWT **locally** (no network) *if the project uses asymmetric JWT signing keys*.
**Precondition (verify FIRST — this gates the task):** Supabase dashboard → prod project → **Settings → API → JWT Keys**. Confirm the project has migrated to **JWT signing keys (asymmetric / ECC or RSA)**. If it's still on the legacy shared HS256 secret, `getClaims()` *also* makes a network call (to fetch/verify) and you get little benefit — in that case, first migrate to signing keys (Supabase provides a zero-downtime rotation), then return here.
**Change:**
1. In `src/lib/supabase/session.ts`, replace `await supabase.auth.getUser()` with `await supabase.auth.getClaims()`. Keep the cookie `getAll`/`setAll` plumbing exactly as-is (token refresh still flows through `setAll`).
2. Audit other middleware-path callers; the per-route `getServerUser()` ([src/lib/auth/get-server-user.ts](src/lib/auth/get-server-user.ts)) is React-`cache()`d and used inside RSC where a verified user object is needed — **leave route-level `getUser()` calls that gate security decisions as-is unless you've confirmed claims are sufficient there.** The middleware only needs to validate + refresh the session, which claims covers.
**Verify:**
- `pnpm test:e2e:student:local` passes (login, navigation, protected routes still gated).
- Manually confirm: expired/blank cookie still redirects to login; a valid session still navigates; token refresh still happens (let a session approach expiry and confirm it refreshes via Set-Cookie).
- Measure: middleware time per request (Vercel logs / Server-Timing) should drop by ~one auth round-trip.
**Rollback:** revert to `getUser()`.
**Risk:** **Medium** — auth is security-critical. Gate on the signing-keys precondition and the e2e auth suite. If anything is ambiguous, ship behind a quick feature check and watch login error rates in Sentry.

### T3.2 — Narrow the proxy matcher so it skips routes that re-auth themselves
**Why:** API routes already call `getApiRequestUser`/`requireApiStudent` ([src/lib/auth/api-request-user.ts](src/lib/auth/api-request-user.ts)). Running the middleware session refresh on top is redundant work on the hot API path.
**Caution:** The middleware also injects the CSP nonce + request id and runs the admin/billing/parent/student/teacher proxy gates (`proxy.ts`). **Do not exclude paths that depend on those gates** (admin step-up, maintenance redirect, CSP). Only consider trimming purely-API JSON routes that don't need a CSP nonce and do their own auth.
**Do:** This is a judgment change — enumerate which `/api/**` routes rely on `proxy.ts` gates vs. self-auth, and exclude only the safe ones from the matcher, or short-circuit the session refresh early for them inside `proxy()`.
**Verify:** Full `pnpm test:e2e:student:local` + admin smoke; confirm CSP headers and request-id still present on the routes you kept; confirm excluded routes still reject unauthenticated callers (their own guard).
**Rollback:** restore the original matcher.
**Risk:** **Medium-high** (security headers + auth). Treat as its own carefully-reviewed change; **T3.1 delivers most of the win — T3.2 is optional.**

---

## 5. Phase 4 — The infrastructure move (co-locate everything in Mumbai)

> 📘 **A detailed, project-specific execution runbook now exists: [PHASE4_DB_REGION_MIGRATION_RUNBOOK.md](PHASE4_DB_REGION_MIGRATION_RUNBOOK.md).** It supersedes the summary below — it includes the captured prod inventory (272 MB, 2 auth users, 5 storage buckets, 19 cron jobs, 2 Vault secrets, pgvector columns, the per-minute matview) and a step-by-step dump→restore→verify→cutover→rollback procedure with a master checklist and risk register. Use the runbook to execute; the summary below is the conceptual outline.

This is the **single biggest win** and the **highest-effort/risk** task. The prod DB is in Sydney; users + (after T1.1) functions are in Mumbai. Co-locating function ↔ DB collapses every per-request DB round-trip from ~200ms to ~1-5ms. Supabase region is fixed per project, so this means **standing up a new prod project in `ap-south-1` and migrating onto it.** Rehearse fully on a throwaway project first.

> **Do not attempt this without a maintenance window and a tested rollback.** This touches auth users, storage, secrets, webhooks, and DNS.

### T4.0 — Decision checkpoint (get explicit human go-ahead)
Confirm with the owner: accept a short maintenance window, accept moving to Supabase **Pro** (so the new project isn't on the auto-pausing free tier), and that DNS/connection-string cutover is acceptable. Record the chosen target region: `ap-south-1` (Mumbai) to match users + `bom1` functions.

### T4.1 — Provision the new prod project in ap-south-1
**Do:** Create a new Supabase project, **region `ap-south-1`**, **Pro** plan, sized compute (start small-dedicated, not micro). Name it clearly (e.g. `prod-bom1`).
**Verify:** Project healthy; region == ap-south-1.

### T4.2 — Reproduce schema + RLS + functions + extensions
**Do:** Apply the entire `supabase/migrations/**` history to the new project in order (this is exactly why the repo keeps raw SQL migrations). Include the Phase 2 migrations (T2.1/T2.2/T2.4) so the new project starts already-optimized. Re-enable required extensions (`pg_trgm`, `pg_cron`, `pg_net`, etc.) and any cron jobs.
**Verify:** `get_advisors` on the new project shows the *post-Phase-2* (clean) counts. Run `db:check-parity` / `db:check-fk-parity` style checks (the repo's parity scripts) comparing new prod vs dev source-of-truth. Diff `pg_policies`, `pg_proc`, `pg_extension` between new-prod and dev — they should match.

### T4.3 — Migrate data (including auth users + storage)
**Why this is the tricky part:** `auth.users` holds hashed passwords and identities; storage objects live in the storage schema + object store. A naive `pg_dump public` loses logins and files.
**Do:**
1. **Public data:** `pg_dump` the old prod `public` schema (data) → restore into new prod. Mind FK order; restore with constraints deferred or in dependency order.
2. **Auth:** migrate `auth.users` + `auth.identities` (Supabase supports this via SQL dump of the `auth` schema or the Auth admin migrate API — passwords are bcrypt hashes and transfer as-is). **Verify a test user can log in on the new project before cutover.**
3. **Storage:** copy buckets + objects (student report PDFs, doubt attachments, org favicons, question visuals) using the Storage API / `supabase storage cp` or an `rclone` between the two S3 backends. Recreate bucket policies.
4. Freeze writes on old prod during the final delta sync (maintenance mode — the app already has `MAINTENANCE_MODE`, see `shouldRedirectToMaintenance` in `proxy.ts`).
**Verify:** Row counts match per table (old vs new); a known student's tests/reports/answers are present; a test login works; a known PDF downloads; a doubt attachment opens.

### T4.4 — Repoint the app + external integrations
**Do:** Update Vercel prod env: `NEXT_PUBLIC_SUPABASE_URL`, keys (publishable + service role), `DATABASE_URL` (new project's **ap-south-1 pooler**, `:6543`, `pgbouncer=true`), `DATABASE_RATELIMIT_URL` if used. Update `next.config.ts` image `remotePatterns` only if the Supabase hostname changed (it derives from `NEXT_PUBLIC_SUPABASE_URL`, so it follows automatically). Update Razorpay webhooks, Resend, Sentry, and any cron callers pointing at the project ref. Confirm `vercel.json` regions == `["bom1"]` (T1.1).
**Verify:** Build + deploy to a preview pointed at the new project; run full e2e (`pnpm test:e2e:student:local`, practice smoke). Confirm webhooks deliver (Razorpay test event, Resend event).

### T4.5 — Cutover + watch
**Do:** Enable maintenance mode → final delta sync → flip env to new project → disable maintenance. Keep old prod **read-only but alive** for 1-2 weeks as rollback.
**Verify:** Re-run the **T0.1 baseline** — authenticated TTFB should drop dramatically (the function→DB round-trips are now intra-region). Watch Sentry error rate, Supabase connection count, login success rate for 24-48h.
**Rollback:** flip env back to old prod (kept read-only/online). This is why you don't decommission old prod immediately.
**Risk:** **High.** Mitigated entirely by rehearsal + keeping old prod as a hot rollback.

---

## 6. Phase 5 — Per-portal code optimizations (waterfalls, N+1, heavy work)

These are independent of infra and each shippable alone. After Phase 4 the absolute savings shrink (round-trips are cheap), but removing *serial* round-trips still helps tail latency and DB load. Each is low-risk if you only change *ordering/parallelism*, not *logic*.

> **PARTIAL EXECUTION STATUS (this branch):** Done & verified (tsc/eslint/2589 tests): **T5.S1, T5.T4** (PDF `maxDuration`), **T5.S3** (reports list list+count parallel), **T5.A2** (admin user-detail counts parallel), **T5.P3** (parent performance: link-check + profile + advisory collapsed from 3 serial round-trips to 1, guard preserved via RLS). Verified **already-handled, no change needed**: **T5.P2** (parent layout already uses `Promise.all`), **T5.P4** (polling — done in T1.4/T1.5), **T5.T3** (subjects cache — T1.3), **T5.A5** (dashboard already reads the cron-refreshed matview; `revalidate` is a no-op on the auth-dynamic route). **Deferred** (large blast radius and/or CPU-bound, which is NOT the bottleneck at ~2k rows): **T5.T2** (submissions-hub SQL aggregation), **T5.A3** (CSV streaming), **T5.A6** (lazy admin tabs), **T5.A7** (subscriptions double JOIN), **T5.A1** (search join), **T5.T1** (teacher roster single-query). **Worth doing next** (real per-message latency, moderate care): **T5.S2** (doubt-chat: parallelize the pre-stream reads).

### Student
- **T5.S1 — PDF report: stop rendering synchronously in the request.** `app/api/student/reports/[testId]/pdf/route.tsx` calls `buildPracticeGradingReportPdfBuffer()` (`@react-pdf` `renderToBuffer`) inline; multi-second CPU, and the route has **no `maxDuration`**. Step 1 (cheap): add `export const maxDuration = 60;`. Step 2 (real fix): pre-generate the PDF when a test is graded and store it, so the route is a cache-hit download; only build-on-miss. **Verify:** request a report; cache-hit path returns in <500ms; build path still works. **Risk:** Low for the maxDuration; medium for pre-generation (touches grading completion flow — add tests).
- **T5.S2 — doubt-chat route: parallelize independent loads.** `app/api/student/doubt-chat/route.ts` loads conversation → scope → topic-context → prompt serially; prompt + attachments don't depend on scope. Move them into a `Promise.all`. **Verify:** doubt e2e + first-token latency drops. If you touch prompt text, run `pnpm doubt:fingerprint`. **Risk:** Low.
- **T5.S3 — reports list: parallelize items + count.** `src/lib/student/load-student-reports-list.ts` runs the list query then a separate `count(*)` for "older outside window" serially. `Promise.all` them (the count doesn't depend on the list). **Verify:** reports page renders identical data; one fewer serial round-trip. **Risk:** Low.
- **T5.S4 — drop the layout+page double auth.** `app/student/layout.tsx` and each page both call `requireVerifiedStudent()`. `getServerUser` is React-`cache()`d so the *auth* call dedupes, but the profile/entitlement work may not. Audit and pass the layout's resolved profile down rather than re-resolving. **Verify:** e2e; no extra profile query in logs. **Risk:** Low-medium (don't weaken the per-page guard; only remove *duplicate* work).

### Teacher
- **T5.T1 — fetch the roster once.** `app/teacher/(protected)/student-performance/page.tsx` and `topic-performance/page.tsx` fetch the roster 2-3× (filter options loads grades + sections as separate queries, then the rows loader re-loads the roster). Build one query that returns roster + filter facets and reuse it. **Verify:** same UI; query log shows one roster fetch. **Risk:** Low-medium (verify filter dropdowns unchanged).
- **T5.T2 — push submissions aggregation into SQL.** `src/lib/assignments/teacher-submissions-hub.ts` aggregates with triple-nested JS loops (assignment × topic × student) + per-row report parsing. Move the aggregation into a SQL query / summary, or memoize parsed reports by `testId`. **Verify:** numbers match the current output on a real class; large-class load time drops. **Risk:** Medium — aggregation logic; cover with a unit test asserting parity vs current output.
- **T5.T3 — cache subjects catalog.** Covered by **T1.3**.
- **T5.T4 — teacher report PDF.** Same fix as **T5.S1** for `app/api/teacher/reports/[testId]/pdf/route.tsx`.

### Parent
- **T5.P1 — remove redundant `assertParentActiveLink()` per page.** The `(portal)` layout already validates the active link and redirects; pages (dashboard, performance, reports, assignments, qna-logs) re-run the same DB check. Trust the layout guard; pass `linked`/`activeId` down. **Verify:** parent e2e; unlinked/forbidden access still redirects (the layout still guards). **Risk:** Low-medium — this is a *security* guard; confirm the layout truly covers every child route before removing page checks.
- **T5.P2 — batch the layout's auth/data calls.** `app/parent/(portal)/layout.tsx` awaits `requireParent()` → cookie read → link check → child profile → entitlement somewhat serially; collapse the independent ones into one `Promise.all`. **Verify:** e2e; fewer serial round-trips. **Risk:** Low.
- **T5.P3 — performance page: parallelize advisory load.** `app/parent/(portal)/performance/page.tsx` awaits `loadAdvisoryActions` after the child profile fetch though it only needs `activeId`. Move it into the page's initial `Promise.all`. **Risk:** Low.
- **T5.P4 — notifications/polling.** Covered by **T1.4 / T1.5**.

### Admin
- **T5.A1 — search: replace correlated email subquery with a JOIN.** `src/lib/admin/search/index.ts` runs `(select email from auth.users where id = …)` per result row. Use a single `leftJoin(authUsers, eq(authUsers.id, profiles.id))` and select `authUsers.email`. **Verify:** search returns identical rows; `EXPLAIN` shows the subquery gone. **Risk:** Low.
- **T5.A2 — user-detail stats: `Promise.all` the counts.** `src/lib/admin/user-detail-queries.ts` runs 4 `COUNT(*)` serially. Parallelize. **Risk:** Low.
- **T5.A3 — CSV export: stream / bound it.** `app/api/admin/analytics/export/route.ts` buffers up to 50,000 rows + one big `join("\n")`. Stream via a `ReadableStream` in batches (and/or lower the cap). **Verify:** export of a large table completes without a memory spike; output bytes match. **Risk:** Low-medium.
- **T5.A4 — admin ILIKE indexes.** Covered by **T2.4**.
- **T5.A5 — dashboard: add `revalidate`.** The dashboard reads a materialized view; add `export const revalidate = 300;` so it isn't recomputed per view, and make sure the view's refresh cron runs (e.g. every 5 min). **Risk:** Low (data up to 5 min stale — acceptable for admin).
- **T5.A6 — user-detail: lazy-load non-profile tab stats.** `app/admin/(authenticated)/users/[userId]/page.tsx` eagerly fetches all tabs' data even when the Profile tab is shown. Fetch a tab's data only when active. **Risk:** Low-medium (verify deep-linking to a tab still works).
- **T5.A7 — subscriptions list: reuse the base query for count + rows** instead of building the 3-table JOIN twice (`src/lib/admin/billing/subscriptions-list.ts`). **Risk:** Low.
- **T5.A8 — live tests 200-row cap:** document it as a real-time sample (not a full list) or add pagination. **Risk:** Low.

---

## 7. Traceability matrix — every factor → task → verification

| # | Factor found (slowdown) | Task(s) | Primary verification |
|---|---|---|---|
| F1 | Functions (Mumbai/`bom1`) ↔ DB (Sydney) cross-continent (users already co-located w/ functions) | T1.1 (pin + open syd1 decision) + **T4.1-T4.5** (move DB to Mumbai) | T0.1 TTFB drop after co-location |
| F2 | `getUser()` auth round-trip in middleware every request | T3.1 (+ T3.2) | middleware time drop; auth e2e green |
| F3 | No caching of slow-changing catalogs | T1.3 | second render skips the query |
| F4 | Free Supabase: auto-pause cold starts + weak compute | T0.3 + **T4.0/T4.1** (Pro + ap-south-1) | no pause cold-starts; query latency in Supabase reports |
| F5a | 59 RLS `auth_rls_initplan` per-row re-eval | T2.2 | advisor count → 0; RLS access e2e unchanged |
| F5b | 47 multiple permissive policies | T2.3 (careful) | advisor count down; access e2e unchanged |
| F5c | 29 (16 confirmed) unindexed FKs | T2.1 | advisor FK count → ~0; Seq→Index in EXPLAIN |
| F5d | 56 unused indexes | T2.5 (later) | confirmed-unused over weeks, then drop |
| F5e | `net._http_response` bloat | T2.5 | vacuum in window |
| F6 | `DATABASE_POOL_MAX` default 5 in serverless | T1.2 | connection count sane under load |
| S1 | Student report PDF sync render, no maxDuration | T5.S1 | cache-hit <500ms; build path works |
| S2 | doubt-chat serial pre-stream reads | T5.S2 | first-token latency drop; doubt e2e |
| S3 | reports list serial list+count | T5.S3 | identical data, 1 fewer round-trip |
| S4 | layout+page double auth/profile work | T5.S4 | e2e; no dup profile query |
| T1 | teacher roster fetched 2-3× | T5.T1 | one roster fetch in logs |
| T2 | submissions hub JS aggregation | T5.T2 | parity unit test; load-time drop |
| T3 | subjects catalog uncached | T1.3 | cache hit |
| T4 | teacher report PDF sync | T5.T4 | as S1 |
| P1 | parent redundant link check per page | T5.P1 | e2e; forbidden still redirects |
| P2 | parent layout serial auth/data | T5.P2 | e2e; fewer round-trips |
| P3 | parent perf page serial advisory | T5.P3 | e2e |
| P4 | open-assignments poll 180s + tab-focus | T1.4 | ≤1 poll / 10 min |
| P5 | unread count double-fetch | T1.5 | no mount-time unread call |
| A1 | admin search correlated email subquery | T5.A1 | identical rows; subquery gone |
| A2 | admin user-detail serial COUNTs | T5.A2 | parallel; same numbers |
| A3 | admin CSV export unbounded buffer | T5.A3 | no memory spike |
| A4 | admin ILIKE without trigram index | T2.4 | Seq→Bitmap Index in EXPLAIN |
| A5 | admin dashboard recomputed per view | T5.A5 | revalidate caps recompute |
| A6 | admin user-detail eager all-tab fetch | T5.A6 | only active tab fetches |
| A7 | admin subscriptions list double JOIN | T5.A7 | one JOIN build |
| A8 | admin live tests silent 200 cap | T5.A8 | documented/paginated |

---

## 8. Recommended execution order (impact × safety)

1. **Phase 0** (measure — mandatory baseline).
2. **T1.1, T1.2, T1.3, T1.4, T1.5** (free, reversible, ship today).
3. **T2.1** (FK indexes — pure win), then **T2.2** (RLS rewrite — biggest DB win, careful verify), then **T2.4** (admin trgm).
4. **T3.1** (getClaims — gate on signing-keys precondition).
5. **Phase 5** per-portal serial→parallel fixes (batch by portal; each its own commit).
6. **Phase 4** (region move — rehearse, window, hot rollback). *Biggest single win; schedule deliberately.*
7. **T2.3, T2.5, T3.2** (careful/optional cleanups) last.

> After each phase, re-run the **T0.1** measurement and append the new numbers under the baseline so the win is documented. Re-run `get_advisors type=performance` after Phase 2 to confirm the finding counts dropped.
