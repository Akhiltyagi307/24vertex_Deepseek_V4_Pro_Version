# Closed Learning Loop — Phase 2 (Loop Live) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the dormant Phase 1 schedule into a live, prescriptive loop: a nightly job selects due topics (respecting quota, an 8-of-period sub-budget, and ≤1/day), enqueues a background job per pick, a worker generates a short "review" test biased to the weak topic, and the student is notified — all behind a kill-switch.

**Architecture:** Reuses the existing `practice_jobs` queue + `run-jobs` drain worker (mirroring the proven `assign_generate_test` job) and the pg_cron→internal-endpoint pattern. A new service-role RPC `practice_generate_review_test` materializes a `test_type='review'` test (mirror of `practice_generate_assigned_test`). A new internal endpoint is the nightly *selector*; the worker is the *generator*.

**Tech Stack:** Next.js 15 route handlers, Supabase Postgres (plpgsql RPCs, pg_cron, pg_net), Drizzle, Vitest. Migrations are idempotent hand-written SQL applied to BOTH projects (canary `ezxmjkvhrlqeimhnfvfd` + EDU_AI `suwakggcbxmmvqzeudmq`) via the Supabase MCP.

**Depends on:** Phase 1 (committed on this branch): `performance_tracker.next_review_at/review_interval_days/review_ease/consecutive_good`, `idx_perf_next_review`, `review_scheduler_enabled()`.

**Spec:** `docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md` §7–§9.

---

## Key reused seams (verified, with file:line)

| Concern | Reuse | Location |
|---|---|---|
| Background generation for a specific student | `materializeAssignedPracticeTest()` (mirror it) | `src/lib/admin/assignment-generation.ts:31` |
| Run pipeline under service role for explicit student | `resolvePracticeConfigForStudent(admin, input, { id })` + `runPracticeGenerationAfterResolve(...)` | `src/lib/admin/assignment-generation.ts:102-130` |
| Materialize RPC to mirror | `practice_generate_assigned_test` (test_type='assigned') | `supabase/migrations/20260618130000_*:405-571` |
| Queue table + CHECKs | `practice_jobs`, `practice_jobs_job_type_check`, `practice_jobs_required_ids_check` | `…20260618130000_*:174-196` |
| Claim RPC (ordering) | `practice_claim_jobs` | `…20260618130000_*:201-259` |
| Drain worker + dispatch | `run-jobs` route + `handleAssignGenerateTestJob` | `app/api/internal/practice/run-jobs/route.ts:514, 575-580` |
| Cron auth | `assertCronRequestAuthorized(request)` | `src/lib/internal/cron-auth.ts:32` |
| pg_cron → endpoint pattern | `cron.schedule(... net.http_post ... vault cron_secret ...)` | `supabase/migrations/20260516100000_*:51-65` |
| Internal endpoint template | health-pings route | `app/api/internal/admin/health-pings/route.ts:1-17` |
| Quota read / consume | `getEntitlements().testsLeft` (+ `currentPeriodStart/End`), `consumeTest()` | `src/lib/billing/entitlements.ts:304, 394` |
| Notification insert | `insertInAppNotification(...)`, `notifyAssignmentMaterialized` | `src/lib/notifications/insert.ts:25`, `assignment-events.ts:66` |
| Test-type CHECK to extend | `tests_test_type_check IN ('self','assigned')` | `…20260618130000_*:137` |

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `supabase/migrations/<ts>_review_scheduler_phase2.sql` | Create | test_type +`'review'`; job_type +`'review_generate'` + required-ids branch; `practice_claim_jobs` ordering; `practice_generate_review_test` RPC. Both projects. |
| `src/lib/notifications/types.ts` | Modify | Add `'review_ready'` notification category. |
| `src/lib/practice/review-generation.ts` | Create | `materializeReviewPracticeTest(studentId, subjectId, topicId)` — service-role generator (mirror of assignment-generation). |
| `src/lib/practice/review-selection.ts` | Create | Pure cap/decision logic: `decideReviewEnqueue(...)`. |
| `src/lib/practice/__tests__/review-selection.test.ts` | Create | Unit tests for the pure cap logic. |
| `app/api/internal/practice/run-jobs/route.ts` | Modify (L72, L514+, L561, L575-580) | Add `review_generate` to ClaimedJob type, claim list, dispatch + `handleReviewGenerateJob`. |
| `app/api/internal/practice/review-scheduler/route.ts` | Create | Nightly selector: kill-switch → due query → caps → enqueue jobs. |
| `supabase/migrations/<ts+1>_review_scheduler_cron.sql` | Create | pg_cron nightly schedule calling the selector. Both projects. |
| `src/lib/student/<dashboard pending query>` | Modify | Surface `test_type='review'` tests in the student's to-do list (confirm exact file at execution; see Task 7). |

**Verify commands:** `node_modules/.bin/tsc --noEmit -p tsconfig.json`; `node_modules/.bin/vitest run`; changed files `| xargs node_modules/.bin/eslint --max-warnings=0`.

---

## Task 1: Migration — review test type, job type, generator RPC

**Files:** Create `supabase/migrations/<TS>_review_scheduler_phase2.sql` (`<TS>` sorts after the latest; at writing use `20260704010000`).

- [ ] **Step 1: Write the migration**

```sql
-- Closed learning loop — Phase 2 (loop live). Idempotent; apply to BOTH projects.

-- 1. Allow review tests.
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_test_type_check;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_test_type_check CHECK (test_type IN ('self', 'assigned', 'review'));

-- 2. Allow a review_generate job (no test_id, no submission, student_id required).
ALTER TABLE public.practice_jobs
	DROP CONSTRAINT IF EXISTS practice_jobs_job_type_check,
	DROP CONSTRAINT IF EXISTS practice_jobs_required_ids_check;
ALTER TABLE public.practice_jobs
	ADD CONSTRAINT practice_jobs_job_type_check
	CHECK (job_type IN ('grade','pdf','auto_submit','email','tracker_update','assign_generate_test','review_generate')),
	ADD CONSTRAINT practice_jobs_required_ids_check
	CHECK (
		(job_type = 'assign_generate_test' AND test_id IS NULL AND assignment_submission_id IS NOT NULL)
		OR (job_type = 'review_generate' AND test_id IS NULL AND assignment_submission_id IS NULL AND student_id IS NOT NULL)
		OR (job_type NOT IN ('assign_generate_test','review_generate') AND test_id IS NOT NULL AND assignment_submission_id IS NULL)
	);

-- 3. One active review_generate per (student, topic) to avoid pile-ups.
CREATE UNIQUE INDEX IF NOT EXISTS practice_jobs_review_generate_active_uq
	ON public.practice_jobs (student_id, (payload->>'topic_id'))
	WHERE job_type = 'review_generate' AND status IN ('pending','running');

-- 4. Claim ordering: include review_generate (after assignment gen).
CREATE OR REPLACE FUNCTION public.practice_claim_jobs(
	p_worker_id TEXT, p_job_types TEXT[], p_limit INT DEFAULT 5
)
RETURNS TABLE(
	id uuid, job_type text, test_id uuid, student_id uuid,
	assignment_submission_id uuid, attempts integer, max_attempts integer, payload jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.role() <> 'service_role' THEN
		RAISE EXCEPTION 'Workers only';
	END IF;
	RETURN QUERY
	WITH claimed AS (
		SELECT pj.id FROM public.practice_jobs pj
		WHERE pj.status = 'pending' AND pj.job_type = ANY(p_job_types) AND pj.run_after <= NOW()
		ORDER BY CASE pj.job_type
			WHEN 'grade' THEN 1 WHEN 'assign_generate_test' THEN 2 WHEN 'review_generate' THEN 3
			WHEN 'pdf' THEN 4 WHEN 'email' THEN 5 WHEN 'tracker_update' THEN 6 WHEN 'auto_submit' THEN 7
			ELSE 99 END ASC,
			CASE WHEN pj.job_type = 'email' THEN pj.created_at END DESC NULLS LAST,
			CASE WHEN pj.job_type <> 'email' THEN pj.run_after END ASC NULLS LAST,
			pj.created_at ASC
		LIMIT p_limit FOR UPDATE SKIP LOCKED
	)
	UPDATE public.practice_jobs pj
	SET status = 'running', attempts = pj.attempts + 1, claimed_at = NOW(), claimed_by = p_worker_id, updated_at = NOW()
	FROM claimed WHERE pj.id = claimed.id
	RETURNING pj.id, pj.job_type, pj.test_id, pj.student_id, pj.assignment_submission_id, pj.attempts, pj.max_attempts, pj.payload;
END;
$$;
REVOKE ALL ON FUNCTION public.practice_claim_jobs(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_claim_jobs(TEXT, TEXT[], INT) TO service_role;

-- 5. Review generator RPC (mirror of practice_generate_assigned_test; test_type='review').
CREATE OR REPLACE FUNCTION public.practice_generate_review_test(
	p_student_id UUID, p_subject_id UUID, p_difficulty TEXT, p_duration_seconds INT,
	p_question_count INT, p_question_mix JSONB, p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Workers only'; END IF;
	IF p_student_id IS NULL THEN RAISE EXCEPTION 'Student required'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Review tests require a student profile';
	END IF;
	IF p_difficulty NOT IN ('easy','medium','hard') THEN RAISE EXCEPTION 'Invalid difficulty'; END IF;
	IF p_duration_seconds NOT IN (3600, 10800) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
	IF p_question_count <= 0 OR p_question_count > 200 THEN RAISE EXCEPTION 'Invalid question count'; END IF;
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'Questions payload must be a JSON array'; END IF;
	v_expected_count := jsonb_array_length(p_questions);
	IF v_expected_count <> p_question_count THEN
		RAISE EXCEPTION 'question_count % does not match payload length %', p_question_count, v_expected_count;
	END IF;

	INSERT INTO public.tests (
		student_id, subject_id, test_type, status, is_draft,
		time_limit_seconds, total_questions, difficulty, question_count, question_mix
	) VALUES (
		p_student_id, p_subject_id, 'review', 'in_progress', TRUE,
		p_duration_seconds, p_question_count, p_difficulty, p_question_count, p_question_mix
	) RETURNING id INTO v_test_id;

	INSERT INTO public.questions (
		test_id, topic_id, question_text, question_type, difficulty_level,
		answer_key, options, question_number, metadata
	)
	SELECT v_test_id, (elem->>'topic_id')::uuid, elem->>'question_text', elem->>'question_type',
		elem->>'difficulty_level', elem->'answer_key',
		CASE WHEN (elem->>'question_type') = 'multiple_choice' THEN elem->'options' ELSE NULL END,
		ord::int, COALESCE(elem->'metadata', '{}'::jsonb)
	FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord);

	RETURN v_test_id;
END;
$$;
REVOKE ALL ON FUNCTION public.practice_generate_review_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_generate_review_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB) TO service_role;
```

- [ ] **Step 2: Apply to BOTH projects** via MCP `apply_migration` (name `review_scheduler_phase2`) on `ezxmjkvhrlqeimhnfvfd` then `suwakggcbxmmvqzeudmq`.
- [ ] **Step 3: Verify (each project)** via `execute_sql`:
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='tests_test_type_check';
SELECT count(*) FROM pg_proc WHERE proname='practice_generate_review_test';
```
Expected: CHECK includes `'review'`; proc count = 1.
- [ ] **Step 4: Commit** the migration file.

---

## Task 2: `review_ready` notification category

**Files:** Modify `src/lib/notifications/types.ts`.

- [ ] **Step 1:** Add `"review_ready"` to the `NotificationCategory` union/const (mirror an existing slug like `"assignment_materialized"`). If there is a DB CHECK on `notifications.category`, extend it in the Task 1 migration too (grep `notifications_category_check` in `supabase/migrations/`; if absent, no DB change needed).
- [ ] **Step 2:** `node_modules/.bin/tsc --noEmit` + eslint the file. Commit.

---

## Task 3: `materializeReviewPracticeTest` (the generator)

**Files:** Create `src/lib/practice/review-generation.ts`.

Mirror `src/lib/admin/assignment-generation.ts:31-150`, adapted: input is `(studentId, subjectId, topicId, trackerId)`; bias generation to the weak topic via `focusArea: "recent_errors"`; persist via the new RPC; notify with `review_ready`.

- [ ] **Step 1: Write the module**

```ts
import "server-only";

import { resolvePracticeConfigForStudent } from "@/lib/practice";
import { runPracticeGenerationAfterResolve } from "@/lib/practice/practice-generation-pipeline";
import { insertInAppNotification } from "@/lib/notifications/insert";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type ReviewGenerationResult = { ok: true; testId: string } | { ok: false; message: string };

export async function materializeReviewPracticeTest(args: {
	studentId: string;
	subjectId: string;
	topicId: string;
	trackerId: string;
}): Promise<ReviewGenerationResult> {
	const { studentId, subjectId, topicId, trackerId } = args;
	const admin = createServiceRoleClient();

	const practiceInput = {
		subjectId,
		trackerIds: [trackerId],
		difficulty: "medium" as const,
		durationSeconds: 3600 as const,
		focusArea: "recent_errors" as const,
	};

	const resolved = await resolvePracticeConfigForStudent(admin, practiceInput, { id: studentId });
	if (!resolved.ok) return { ok: false, message: resolved.message };

	const result = await runPracticeGenerationAfterResolve(admin, practiceInput, resolved, {
		useStreamObject: false,
		requestMode: "review_worker",
		recordGenerateClicked: false,
		persistGeneratedTest: async (input) => {
			const rpc = await admin.rpc("practice_generate_review_test", {
				p_student_id: studentId,
				p_subject_id: input.subjectId,
				p_difficulty: input.difficulty,
				p_duration_seconds: input.durationSeconds,
				p_question_count: input.questionCount,
				p_question_mix: input.questionMix,
				p_questions: input.questions,
			});
			if (rpc.error) {
				logSupabaseError("materializeReviewPracticeTest.practice_generate_review_test", rpc.error, {
					studentId, topicId,
				});
			}
			return { data: (rpc.data as string | null) ?? null, error: rpc.error };
		},
	});

	if (!result.ok) {
		logServerError("materializeReviewPracticeTest.generation_failed", new Error(result.message), {
			studentId, subjectId, topicId,
		});
		return { ok: false, message: result.message };
	}

	await insertInAppNotification({
		recipientId: studentId,
		title: "Time for a quick review",
		body: "A short review test is ready on a topic to strengthen.",
		type: "reminder",
		category: "review_ready",
		referenceType: "test",
		referenceId: result.testId,
	});

	return { ok: true, testId: result.testId };
}
```

- [ ] **Step 2:** Confirm `runPracticeGenerationAfterResolve` accepts `requestMode: "review_worker"` (it's a string mode; grep its type in `practice-generation-pipeline.ts` and add `"review_worker"` to the union if it's a closed enum). Confirm `resolvePracticeConfigForStudent` accepts `focusArea` in the input (it does via the practice config schema). Adjust if the option names differ.
- [ ] **Step 3:** `tsc` + eslint. Commit. (No unit test here — it's an integration shell over the pipeline; covered by the worker integration check in Task 8.)

---

## Task 4: Drain worker — `review_generate` handler

**Files:** Modify `app/api/internal/practice/run-jobs/route.ts`.

- [ ] **Step 1:** Add `"review_generate"` to the `ClaimedJob.job_type` union (~L72).
- [ ] **Step 2:** Add `"review_generate"` to the `p_job_types` array passed to `practice_claim_jobs` (~L561) and to the per-type timeout map (~L28-40; use 180000ms like `assign_generate_test`).
- [ ] **Step 3:** Add the handler (mirror `handleAssignGenerateTestJob`, ~L514):

```ts
async function handleReviewGenerateJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const studentId = job.student_id;
	const subjectId = typeof job.payload?.subject_id === "string" ? job.payload.subject_id : null;
	const topicId = typeof job.payload?.topic_id === "string" ? job.payload.topic_id : null;
	const trackerId = typeof job.payload?.tracker_id === "string" ? job.payload.tracker_id : null;
	if (!studentId || !subjectId || !topicId || !trackerId) {
		return { ok: false, message: "review_generate payload missing student/subject/topic/tracker" };
	}
	const result = await materializeReviewPracticeTest({ studentId, subjectId, topicId, trackerId });
	return result.ok ? { ok: true } : { ok: false, message: result.message };
}
```

- [ ] **Step 4:** Add the dispatch case (~L580): `: job.job_type === "review_generate" ? handleReviewGenerateJob(job)`. Import `materializeReviewPracticeTest` from `@/lib/practice/review-generation`.
- [ ] **Step 5:** `tsc` + eslint. Commit.

---

## Task 5: Pure cap/decision logic

**Files:** Create `src/lib/practice/review-selection.ts` + `__tests__/review-selection.test.ts`.

Keep all the cap arithmetic in one pure, tested function so the endpoint stays thin.

- [ ] **Step 1: Write the failing test** (`review-selection.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { decideReviewEnqueue, REVIEW_PERIOD_SUBBUDGET } from "@/lib/practice/review-selection";

describe("decideReviewEnqueue", () => {
	it("enqueues when under all caps", () => {
		expect(decideReviewEnqueue({ testsLeft: 10, reviewTestsThisPeriod: 0, hasReviewActivityToday: false }))
			.toEqual({ enqueue: true, reason: "ok" });
	});
	it("blocks when no quota left", () => {
		expect(decideReviewEnqueue({ testsLeft: 0, reviewTestsThisPeriod: 0, hasReviewActivityToday: false }))
			.toEqual({ enqueue: false, reason: "no_quota" });
	});
	it("blocks at the period sub-budget", () => {
		expect(decideReviewEnqueue({ testsLeft: 10, reviewTestsThisPeriod: REVIEW_PERIOD_SUBBUDGET, hasReviewActivityToday: false }))
			.toEqual({ enqueue: false, reason: "subbudget" });
	});
	it("blocks a second review the same day", () => {
		expect(decideReviewEnqueue({ testsLeft: 10, reviewTestsThisPeriod: 1, hasReviewActivityToday: true }))
			.toEqual({ enqueue: false, reason: "daily_cap" });
	});
});
```

- [ ] **Step 2:** Run → fail (module missing).
- [ ] **Step 3: Implement** `review-selection.ts`:

```ts
/** Max review tests the scheduler may auto-consume of a student's period quota. */
export const REVIEW_PERIOD_SUBBUDGET = 8;

export type ReviewEnqueueInput = {
	testsLeft: number;
	reviewTestsThisPeriod: number;
	hasReviewActivityToday: boolean;
};

export type ReviewEnqueueDecision = {
	enqueue: boolean;
	reason: "ok" | "no_quota" | "subbudget" | "daily_cap";
};

export function decideReviewEnqueue(input: ReviewEnqueueInput): ReviewEnqueueDecision {
	if (input.testsLeft <= 0) return { enqueue: false, reason: "no_quota" };
	if (input.reviewTestsThisPeriod >= REVIEW_PERIOD_SUBBUDGET) return { enqueue: false, reason: "subbudget" };
	if (input.hasReviewActivityToday) return { enqueue: false, reason: "daily_cap" };
	return { enqueue: true, reason: "ok" };
}
```

- [ ] **Step 4:** Run → pass. eslint + tsc. Commit.

---

## Task 6: Nightly selector endpoint

**Files:** Create `app/api/internal/practice/review-scheduler/route.ts`.

- [ ] **Step 1: Write the endpoint** (mirror health-pings auth shape; use the service-role client for all reads/writes):

```ts
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/entitlements";
import { decideReviewEnqueue } from "@/lib/practice/review-selection";
import { logServerError } from "@/lib/server/log-supabase-error";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const admin = createServiceRoleClient();

	// Kill-switch.
	const { data: enabledRow } = await admin.rpc("review_scheduler_enabled");
	if (enabledRow === false) return Response.json({ ok: true, enqueued: 0, skipped: "disabled" });

	// Due topics (graduated topics have next_review_at = NULL, so this is the active set).
	const { data: dueRows } = await admin
		.from("performance_tracker")
		.select("id, student_id, subject_id, topic_id, next_review_at")
		.not("next_review_at", "is", null)
		.lte("next_review_at", new Date().toISOString())
		.order("next_review_at", { ascending: true })
		.limit(500);
	const due = (dueRows ?? []) as Array<{
		id: string; student_id: string; subject_id: string; topic_id: string;
	}>;

	// One review per student per run (enforces ≤1/day together with the unique active-job index).
	const seenStudents = new Set<string>();
	let enqueued = 0;
	for (const row of due) {
		if (seenStudents.has(row.student_id)) continue;
		seenStudents.add(row.student_id);
		try {
			const ent = await getEntitlements(admin, row.student_id);
			if (!ent) continue;

			// Period sub-budget: count review tests created this period.
			const { count: reviewCount } = await admin
				.from("tests")
				.select("id", { count: "exact", head: true })
				.eq("student_id", row.student_id)
				.eq("test_type", "review")
				.gte("test_date", ent.currentPeriodStart)
				.lt("test_date", ent.currentPeriodEnd);

			// Daily cap: any review test or pending/running review job today.
			const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
			const { count: todayCount } = await admin
				.from("tests")
				.select("id", { count: "exact", head: true })
				.eq("student_id", row.student_id)
				.eq("test_type", "review")
				.gte("test_date", startOfDay.toISOString());

			const decision = decideReviewEnqueue({
				testsLeft: ent.testsLeft,
				reviewTestsThisPeriod: reviewCount ?? 0,
				hasReviewActivityToday: (todayCount ?? 0) > 0,
			});
			if (!decision.enqueue) continue;

			// Enqueue (unique active-job index dedupes per student+topic).
			const { error: insErr } = await admin.from("practice_jobs").insert({
				job_type: "review_generate",
				student_id: row.student_id,
				status: "pending",
				run_after: new Date().toISOString(),
				payload: { subject_id: row.subject_id, topic_id: row.topic_id, tracker_id: row.id },
			});
			if (!insErr) enqueued += 1;
		} catch (e) {
			logServerError("review-scheduler.student_failed", e as Error, { studentId: row.student_id });
		}
	}

	return Response.json({ ok: true, enqueued });
}

export async function POST(request: Request): Promise<Response> { return handle(request); }
export async function GET(request: Request): Promise<Response> { return handle(request); }
```

- [ ] **Step 2:** Confirm `getEntitlements`'s return includes `currentPeriodStart`/`currentPeriodEnd`/`testsLeft` (it does — `entitlements.ts:304`). Confirm the `practice_jobs` insert column names match the Drizzle schema (`src/db/schema/practice-tables.ts`) — `job_type`, `student_id`, `run_after`, `payload`, `status`. (The unique partial index `practice_jobs_review_generate_active_uq` makes a duplicate insert error → caught/ignored.)
- [ ] **Step 3:** `tsc` + eslint. Commit.

---

## Task 7: Surface review tests to the student

**Files:** Modify the student "pending tests / continue" query (confirm exact file at execution — likely `src/lib/student/dashboard-open-assignments.ts` or a `dashboard-*` pending-tests query; grep for `test_type` / `'in_progress'` / `is_draft` selects).

A `test_type='review'`, `status='in_progress'`, `is_draft=TRUE` test must appear in the student's actionable list with a "Review" label, and be startable through the existing practice-taking flow (the take flow is test-type agnostic — verify it doesn't filter to `'self'`).

- [ ] **Step 1:** Locate the query that lists a student's startable/in-progress tests on the dashboard. Confirm whether it filters `test_type`. If it filters to `'self'`/`'assigned'`, add `'review'`.
- [ ] **Step 2:** Add a minimal "Review" badge/label on review tests (reuse the existing assignment/self badge pattern).
- [ ] **Step 3:** Add/extend a unit test for the pending-list query to include a `'review'` row. `tsc` + eslint. Commit.

> If the take flow or dashboard query turns out to be tightly coupled to `'self'`/`'assigned'`, STOP and raise it — surfacing may need its own small design rather than a one-line filter change.

---

## Task 8: pg_cron schedule + verification

**Files:** Create `supabase/migrations/<TS+1>_review_scheduler_cron.sql`.

- [ ] **Step 1: Write the cron migration** (mirror `20260516100000_*:51-65`):

```sql
-- Nightly review scheduler (02:30 UTC). Idempotent; apply to BOTH projects.
SELECT cron.schedule(
	'practice-review-scheduler-nightly',
	'30 2 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url')
				|| '/api/internal/practice/review-scheduler',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);
```

- [ ] **Step 2:** Apply to BOTH projects via MCP. Verify with `SELECT jobname FROM cron.job WHERE jobname = 'practice-review-scheduler-nightly';` (expect 1 row each). Commit.
- [ ] **Step 3: Dark-launch gate.** Confirm `review_scheduler_enabled()` returns true only when you're ready to dark-launch; to start OFF, first `CREATE OR REPLACE FUNCTION public.review_scheduler_enabled() ... AS $$ SELECT false $$;` on both projects, enable for a cohort, then flip true.
- [ ] **Step 4: Full verification.** `node_modules/.bin/tsc --noEmit`; `node_modules/.bin/vitest run` (expect prior count + the new review-selection tests, 0 failed); eslint on all changed files. Push the branch.
- [ ] **Step 5: End-to-end smoke (staging/cohort).** Manually set a `performance_tracker.next_review_at` to the past for a test student, POST the selector endpoint with the cron bearer, confirm a `review_generate` job is enqueued, run the drain (`/api/internal/practice/run-jobs`), and confirm a `test_type='review'` test + a `review_ready` notification appear for that student.

---

## Phase 2 self-review (author check vs spec §7–§9)

- **Selector + caps** (1/day via one-per-student-per-run + unique active-job index; 8/period sub-budget via review-test count; quota via `getEntitlements`) → Tasks 5, 6. ✓
- **Queue + drain worker** (enqueue job → generate → materialize → notify) → Tasks 1, 3, 4. ✓
- **Kill-switch** → reuses Phase 1 `review_scheduler_enabled()`; checked in Task 6 + Task 8 step 3. ✓
- **pg_cron nightly** → Task 8. ✓
- **Notification** ("review ready") → Tasks 2, 3. ✓
- **Idempotency** (no double-issue) → unique partial index `practice_jobs_review_generate_active_uq` + drain claim `FOR UPDATE SKIP LOCKED`. ✓
- **Both projects** → Tasks 1, 8. ✓

**Intentional v1 simplifications (documented; bounded by the ≤8/period + ≤1/day caps):**
1. **Fresh generation, not banked-question reuse (spec §8 cost control).** v1 mirrors the proven assignment generation path (fresh, biased to the weak topic via `focusArea`). Banked-question reuse (clone previously-missed `student_answers`→`questions`, top up with fresh) is a fast-follow optimization, not in this plan. Rationale: lower risk + the caps bound generation spend to ≤8 tests/student/period.
2. **Standard test length, not short ~5-question reviews.** v1 uses the pipeline's default length. "Short review tests" is a follow-up once the pipeline's question-count override is confirmed.

**Open items to resolve at execution (not blockers):**
- Confirm `runPracticeGenerationAfterResolve` `requestMode` union accepts `"review_worker"` (add it if closed).
- Confirm `notifications.category` has no DB CHECK (or extend it in Task 1).
- Confirm the student dashboard pending-tests query + take flow are `test_type`-agnostic (Task 7).
- Confirm `practice_jobs` Drizzle insert field names (Task 6 step 2).
