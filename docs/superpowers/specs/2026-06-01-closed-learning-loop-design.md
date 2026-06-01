# Closed Learning Loop — Design Spec

- **Date:** 2026-06-01
- **Status:** Draft for review
- **Author:** Akhil (with Claude)
- **Scope:** One coherent system, phased build (Phases 1–4 below)

---

## 1. Problem & context

The platform is strong at **assessment** (a multi-stage LLM practice-generation + grading pipeline) but the learning loop is **open**, not closed:

- **Identify** is passive — nothing flags a weak topic or acts on it.
- **Remediate** is manual — doubt-chat is grounded in the *topic*, not the student's *actual wrong answer*.
- **Re-assess** isn't scheduled — there is no spaced-repetition nudge; the student must return on their own.
- **Parent visibility** is a mirror of the student report, with no "what should my child do next" advice.

All the raw signals already exist in the DB. Closing the loop is mostly an **orchestration layer** over existing data and infrastructure, not new infrastructure. This is the highest-leverage product gap for measurable score gains — the outcome a school renews on.

## 2. Goals / non-goals

**Goals**
- Automatically detect per-topic weakness and **prescriptively** schedule short "review" retests on a spaced-repetition curve.
- Make doubt-chat **mistake-grounded** (anchored on the student's actual wrong answer).
- Give parents an **advisory** "next best actions" view; give teachers **read-only** visibility of auto-retests for their class.
- Measure before/after improvement per topic (the renewal evidence).
- Stay **migration-light** (changes applied to **both** Supabase projects) and **cost/quota-bounded**.

**Non-goals (v1)**
- Full research-grade memory model (FSRS) — heuristic now, clean upgrade path later.
- Teacher *override* of the scheduler — read-only visibility only in v1.
- Cross-device prefs / new consumer billing tiers.

## 3. Decisions locked in brainstorming

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | One spec, phased build | Avoid reinventing the recommendation "brain" three times. |
| D2 | **Prescriptive** auto-retests (system creates the retest) | Strongest outcome pull, vs a passive suggestion box. |
| D3 | **SM-2-lite "smart gap"** scheduling | Adapts the review interval per student; explainable to schools. |
| D4 | Retests **count against** the monthly test quota | Consistent with billing; one test = one test. |
| D5 | Auto-retest **sub-budget = 8 of the period's quota** (tunable) | Leaves the bulk of the ~30 for self-initiated practice. |
| D6 | **Max 1 auto-retest per student per day** | Pacing; never overwhelm. Drives a stagger step. |
| D7 | Teachers get a **read-only** view of class auto-retests | School value prop without v1 override complexity. |

## 4. Architecture overview

One engine sits between *"a test got graded"* and *"what happens next."* Six units, each with a single job (so each is independently testable):

1. **Scheduler rule** — *pure function*: `(priorSchedule, latestResult) → { interval, ease, nextReviewAt, consecutiveGood }`. No I/O. Exhaustively unit-tested.
2. **Schedule updater** — on grade, runs the rule per topic and persists (atomically, via the existing tracker RPC; see §6).
3. **Nightly selector** — finds due topics, applies caps (1/day, sub-budget, quota), **enqueues** review intents. Cheap; no generation here.
4. **Drain worker** — mirrors the existing every-5-min operator-jobs drain; performs the actual (synchronous, heavy) generation + materialization.
5. **Doubt mistake-context provider** — fetches the student's wrong answer + reference + feedback for a question and injects it into the doubt prompt.
6. **Advisory projection** — turns schedule + tracker into ranked "next actions," reframed per audience (student / parent / teacher).

```
graded test ──▶ (2) schedule updater ──▶ performance_tracker(+schedule cols)
                                              │
                  ┌───────────────────────────┼───────────────────────────┐
                  ▼                            ▼                           ▼
        (3) nightly selector          (6) advisory projection      teacher read-only view
                  │                    (student / parent)
                  ▼
        review intent queue
                  │
                  ▼
        (4) drain worker ──▶ practice_generate_test() ──▶ tests(test_type='review') ──▶ notification

doubt-chat ──▶ (5) mistake-context provider ──▶ existing doubt scope/prompt  (parallel reader)
```

## 5. Spaced-repetition rule (SM-2-lite) — the pure function

State per (student, topic): `interval_days`, `ease`, `consecutive_good`, `next_review_at`.

Config block (one place, tunable without code changes):
```
MASTERY_PASS_PCT      = 75      // score >= this counts as a "pass"
START_INTERVAL_DAYS   = 2
START_EASE            = 2.0
EASE_MIN, EASE_MAX    = 1.3, 2.6
EASE_STEP_UP/DOWN     = 0.10 / 0.20
GRADUATE_GOOD_STREAK  = 3       // mastered + this many good reviews → leave active scheduling
```

Transition on a graded result for a topic:
- **Enter** (first time graded below mastery, not yet scheduled): `interval = START_INTERVAL_DAYS`, `ease = START_EASE`, `consecutive_good = 0`.
- **Pass** (`score >= MASTERY_PASS_PCT`): `interval = round(interval * ease)`; `ease = min(EASE_MAX, ease + EASE_STEP_UP)`; `consecutive_good += 1`.
- **Fail**: `interval = 1`; `ease = max(EASE_MIN, ease - EASE_STEP_DOWN)`; `consecutive_good = 0`.
- **Graduate**: if mastery band is `mastered` **and** `consecutive_good >= GRADUATE_GOOD_STREAK` → clear `next_review_at` (drops out of active scheduling). Silently re-enters if a later test dips below mastery.
- `next_review_at = last_test_date + interval_days`.

**Stagger step (D6):** the *rule* spaces one topic; across multiple topics due the same day for one student, the **selector** (§7) releases only one and defers the rest by +1 day each, so no day ever carries two auto-retests.

> Mastery band reuse: `computeMasteryState()` in `src/lib/student/mastery-states.ts` already derives `not_started/familiar/proficient/mastered` from `status + testsTaken + averageScore`. Reuse it; do not duplicate thresholds.

## 6. Data model & on-grade integration

**Extend `performance_tracker`** (already `unique(student_id, topic_id)`, `src/db/schema/assessment.ts:21`) with:
- `next_review_at timestamptz null`
- `review_interval_days integer null`
- `review_ease numeric(3,2) null`
- `consecutive_good integer not null default 0`
- Partial index: `(next_review_at) where next_review_at is not null` — makes the selector a cheap lookup.

**`tests.test_type`** — add a new value `'review'` (column exists, `assessment.ts:59`, default `'self'`). **Verify** whether a CHECK constraint / enum restricts it; if so, widen it in the migration.

**On-grade hook:** grading writes results in `src/lib/practice/ai-grade-practice-test.tsx` — `test_reports` upsert (~`:689`), `student_answers` via `writeStudentAnswerRows()` (~`:665`), and the tracker via RPC `practice_update_trackers_bulk()` (~`:726`). Plan:
1. After answers are graded, compute each topic's new schedule with the **TS pure function** (§5).
2. **Extend `practice_update_trackers_bulk`** items payload (`{topic_id, average_score, n_incorrect}` → add `next_review_at, review_interval_days, review_ease, consecutive_good`) so the schedule is persisted in the **same atomic RPC** as the tracker update — no second write. Migration applied to **both** projects.

**Kill-switch:** mirror `streak_freeze_enabled()` (`supabase/migrations/20260531195123_streak_freeze_recovery.sql:18`) as `review_scheduler_enabled()` returning `true`; flip via `CREATE OR REPLACE` (no schema change).

## 7. Nightly selector + drain worker

**Selector** — new internal endpoint `app/api/internal/admin/review-scheduler/route.ts`, gated by `assertCronRequestAuthorized` (`src/lib/internal/cron-auth.ts:28`), scheduled via **pg_cron** (add to a migration like `supabase/migrations/20260516100000_internal_http_routes_pg_cron.sql`). Steps:
1. If `review_scheduler_enabled()` is false → exit.
2. Select tracker rows where `next_review_at <= now()`, mastery in `{familiar, proficient}`, student active (recent engagement) — ordered most-overdue / weakest first.
3. Apply caps per student: **≤1/day (D6)** and **sub-budget (D5)** — count existing `test_type='review'` tests in the current usage period; if `>= 8`, skip. (Sub-budget is thus **derived, migration-free**; ≤1/day plus ≤8/period fully bound volume, so no separate weekly cap is needed.)
4. **Quota gate (D4):** read `getEntitlements(supabase, studentId).testsLeft` (`src/lib/billing/entitlements.ts:299`); if `<= 0`, skip (never push over the period quota).
5. Write a **review-intent** row to the queue (reuse `practice_jobs` with a new job type, or a small `review_queue` table — decide in the plan).

**Drain worker** — mirror the existing operator-jobs drain (pg_cron every 5 min → `app/api/internal/admin/process-operator-jobs`). For each pending intent:
1. Build the retest (§8).
2. Materialize via `practice_generate_test()` RPC with `test_type='review'`.
3. **Consume quota** via `consumeTest(supabase, studentId)` (`entitlements.ts:394`); if it fails (race), drop the intent and leave the topic due.
4. Fire a notification (§9).

This decoupling keeps each cron invocation cheap and spreads heavy synchronous generation over time.

## 8. Retest builder (cost control)

- Pull the student's previously-missed questions for the topic: `student_answers JOIN questions` where `is_correct = false` and `questions.topic_id = X` (all columns to reconstruct exist — `answer_key`, `options`, `metadata.visual`, etc., `src/db/schema/assessment.ts:111-165`).
- Select a few, **lightly varied** (reorder options / minor rephrase) so it isn't a memorized repeat; de-dup against recently-served items.
- Top up to ~5 questions with fresh **weak-topic-biased** generation only if banked supply is short — via `generatePracticeTest()` (`app/student/practice/actions/generate-practice-test.ts:19`) with `focus_area='weak'`/`'recent_errors'`. `loadRecentErrorsForSubject()` (`src/lib/practice/resolve-config.ts:249`) already supplies recent errors.
- **Cost vs count:** banked reuse saves DeepSeek **tokens**; the retest still counts as **1 of the quota** (D4). Keep these two levers distinct in the implementation.

## 9. Surfaces

**A. Mistake-grounded doubt-chat.** New "Ask about this" entry from a graded test's wrong question, pre-loading that mistake. The **mistake-context provider** assembles `{ student answer, reference answer, grader feedback }` (all on the `student_answers` row: `aiUserAnswerSummary`, `aiReferenceAnswerSummary`, `aiFeedback`) into a new optional `{{mistake_block}}` placeholder in `SCOPE_TEMPLATE` (`src/lib/ai/doubt-prompt-templates.ts`), threaded through `interpolateDoubtPromptTemplate()` exactly like the existing optional `contextChunksBlock`. The three modes (explain / solve-with-me / quiz-me) then anchor on the real misconception.
- **Fingerprint guard:** editing doubt prompts trips `scripts/check-doubt-prompt-fingerprint.ts`; rerun with `--write` and commit `docs/doubt-prompt-fingerprint.json` (confirm the exact `pnpm` alias). Add as an explicit plan step.

**B. Parent advisory.** Replace the mirrored report with a ranked panel: top 1–3 actions in plain language ("Revisit Fractions — due for review, last score 45%"), scheduled vs overdue, and a one-line "why." Pure projection over the schedule/tracker — no new computation. Optional weekly digest via existing email (a `weekly-digest` internal job already exists).

**C. Teacher read-only view.** On existing class/analytics pages, an "Auto-retests" strip: per student — reviews issued / done / overdue by topic; per class — "topics the engine is re-testing most" (a strong class-weakness signal). No override in v1.

## 10. Outcome telemetry (renewal evidence)

For each topic review cycle, store the **before** score (the value that triggered scheduling) and the **after** score (the review test result) so we can report "average improvement after auto-review" per student / class / school. Both numbers already exist; we persist/compute the delta (small addition to the review-intent or a lightweight log).

## 11. Error handling & idempotency

- Generation failure in the drain worker → retry via the existing retry policy; after exhaustion, drop that intent (no broken test in the queue) and leave the topic due for the next selector run.
- **Selector is idempotent** — a topic already having a pending intent or a `review` test today is skipped; never double-issues.
- Quota race: `consumeTest()` returning false aborts materialization (mirrors existing pipeline behavior).
- Kill-switch short-circuits the selector entirely.

## 12. Testing strategy

- **Pure scheduler rule:** exhaustive unit tests — enter / pass / fail / graduate / re-entry, ease floor+cap, interval growth, stagger.
- **Selector:** integration tests for caps (1/day, 8-of-period sub-budget, quota exhaustion, kill-switch off) on the existing vitest suite.
- **Doubt mistake-context:** prompt-assembly snapshot test (+ fingerprint update).
- **Quota:** test that a review test decrements the period and respects `testsLeft`.
- Run repo gates: `tsc --noEmit`, `eslint --max-warnings=0` on changed files (via xargs), `vitest run`.

## 13. Rollout phases

- **Phase 1 — Foundation:** tracker schema cols + index, kill-switch fn, scheduler **pure function** + extended `practice_update_trackers_bulk`, on-grade wiring. No user-visible change; schedule state starts accruing.
- **Phase 2 — Loop live:** selector endpoint + pg_cron, review-intent queue, drain worker, retest builder, quota/sub-budget/1-per-day caps, student notification. Behind kill-switch; dark-launch to a cohort.
- **Phase 3 — Mistake-grounded doubt-chat:** mistake-context provider + template block + entry point + fingerprint update.
- **Phase 4 — Visibility:** parent advisory, teacher read-only view, outcome telemetry.

## 14. Open questions / future

- Exact queue substrate for review intents: reuse `practice_jobs` (new job type) vs a small `review_queue` table — decide in the plan.
- Confirm any CHECK/enum constraint on `tests.test_type` before adding `'review'`.
- Confirm exact `pnpm` alias for the doubt fingerprint `--write` step.
- "Active student" definition for the selector (engagement window + subscription state).
- Whether to also gate a new notification **category** (`review_ready`) in `user_preferences`.
- **FSRS upgrade path:** the scheduler-rule interface is stable; swapping SM-2-lite for FSRS later touches only the pure function, once review history exists to fit parameters.

## 15. Reused infrastructure (verified seams)

| Concern | Reuse | Location |
|---|---|---|
| Quota check / remaining | `getEntitlements().testsLeft`, `preflightPracticeTestQuota()` | `src/lib/billing/entitlements.ts:299,350` |
| Quota consume / refund | `consumeTest()`, `refundTest()` (RPC `billing_consume_test`) | `src/lib/billing/entitlements.ts:394,355` |
| Usage period | `usagePeriods`, `findCurrentUsagePeriod()` | `src/db/schema/billing.ts:63`, `src/lib/billing/usage-period.ts:28` |
| Grade hook / tracker update | RPC `practice_update_trackers_bulk()` | `src/lib/practice/ai-grade-practice-test.tsx:726` |
| Test materialization | RPC `practice_generate_test()` | `app/student/practice/actions/generate-practice-test.ts:19` |
| Weak-topic bias / recent errors | `focus_area`, `loadRecentErrorsForSubject()` | `src/lib/practice/user-message.ts:15`, `resolve-config.ts:249` |
| Kill-switch pattern | `streak_freeze_enabled()` | `supabase/migrations/20260531195123_streak_freeze_recovery.sql:18` |
| Cron infra / auth | pg_cron + `assertCronRequestAuthorized` | `supabase/migrations/20260516100000_internal_http_routes_pg_cron.sql`, `src/lib/internal/cron-auth.ts:28` |
| Drain cadence | operator-jobs drain (every 5 min) | `app/api/internal/admin/process-operator-jobs` |
| Notifications | `insertInAppNotification()`, `notifyAssignmentMaterialized()` pattern | `src/lib/notifications/insert.ts:46`, `assignment-events.ts:25` |
| Doubt scope / optional block | `interpolateDoubtPromptTemplate()`, `contextChunksBlock` pattern | `src/lib/ai/doubt-prompt-templates.ts:245`, `validate-doubt-scope.ts:98` |
| Fingerprint guard | `check-doubt-prompt-fingerprint.ts --write` | `scripts/check-doubt-prompt-fingerprint.ts` |
| Mastery bands | `computeMasteryState()` | `src/lib/student/mastery-states.ts:49` |

> Migrations must be applied to **both** Supabase projects (`ezxmjkvhrlqeimhnfvfd` canary + `suwakggcbxmmvqzeudmq` EDU_AI).
