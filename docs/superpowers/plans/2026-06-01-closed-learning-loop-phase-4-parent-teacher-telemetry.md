# Closed Learning Loop — Phase 4 (Parent Advisory + Teacher View + Telemetry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Make the loop's value visible and measurable: (A) parents get a ranked "what should my child do next" panel; (B) teachers get a read-only per-class view of auto-retests issued/done/overdue; (C) every review test records a before→after score delta so renewal-grade "did it work?" reporting is possible.

**Architecture:** Pure read/projection layer over data the loop already produces — `performance_tracker` (schedule + scores), `tests.test_type='review'`, `practice_jobs.job_type='review_generate'`. Telemetry reuses `practice_analytics_events` + `recordPracticeEvent` (a new `review_test_completed` event). **No new tables, no migration.**

**Tech Stack:** Next.js 15 server components + server actions, Drizzle/Supabase reads, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md` §9 (B, C) + §10. Depends on Phases 1–2 data.

---

## Key reused seams (verified, file:line)

| Concern | Reuse | Location |
|---|---|---|
| Parent→child link + active child | `loadLinkedChildrenForParent`, `assertParentActiveLink`, `getParentActiveStudentIdFromCookie` | `src/lib/parent/linked-children.ts:33-82`, `active-student-cookie.ts:1-22` |
| Child performance bundle (reused by parent) | `loadStudentPerformanceBundle()` (tracker + topics + subjects) | `src/lib/student/student-performance-load.ts:48-150` |
| Parent surfaces | `StudentPerformanceAsync` / `StudentDashboardAsync` (`variant="parent"`) | `app/parent/(portal)/{performance,dashboard}/page.tsx` |
| Teacher analytics queries | `listTeacherTopicPerformanceRows`, `listTeacherPerformanceDirectoryRows` (aggregate `performance_tracker` over roster) | `src/lib/teachers/teacher-topic-performance-queries.ts`, `teacher-performance-directory-queries.ts` |
| Teacher pages | topic + student detail | `app/teacher/(protected)/topic-performance/[topicId]/page.tsx`, `student-performance/[studentId]/performance/page.tsx` |
| Analytics sink | `practice_analytics_events` + `recordPracticeEvent(admin, name, props, {studentId})` | `src/db/schema/practice-tables.ts:42-55`, `src/lib/practice/analytics.ts` |
| Grade hook (emit telemetry; prior tracker read already added in Phase 1) | `gradePracticeTestWithAiInner` | `src/lib/practice/ai-grade-practice-test.tsx` (~L645 nowIso, ~L720 prior-tracker read) |

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/lib/student/review-advisory.ts` | Create | Pure ranking `rankAdvisoryActions(rows)` + `loadAdvisoryActions(supabase, studentId)`. Shared by parent (and reusable by student). |
| `src/lib/student/__tests__/review-advisory.test.ts` | Create | Unit-test the pure ranking. |
| Parent advisory panel component + wiring | Create/Modify | Render the ranked panel on the parent dashboard/performance (`variant="parent"`). |
| `src/lib/teachers/teacher-review-metrics.ts` | Create | `loadTeacherClassReviewMetrics(...)` (review tests issued/done/overdue per topic over roster). |
| `src/lib/teachers/__tests__/teacher-review-metrics.test.ts` | Create | Unit-test the pure shaping of the metrics rows. |
| Teacher "Auto-retests" strip component + wiring | Create/Modify | Read-only strip on topic + student detail pages. |
| `src/lib/practice/analytics.ts` | Modify | Add `"review_test_completed"` to the event-name union. |
| `src/lib/practice/ai-grade-practice-test.tsx` | Modify (~L347 select, ~L720 block) | Add `test_type` to testRow select; when `'review'`, emit before→after delta per topic. |

**Verify:** `tsc --noEmit`; `vitest run`; eslint changed files `--max-warnings=0`.

---

## Task 1: Advisory ranking (pure) + loader

**Files:** `src/lib/student/review-advisory.ts` + `__tests__/review-advisory.test.ts`.

- [ ] **Step 1: Failing test** for the pure ranker:

```ts
import { describe, expect, it } from "vitest";
import { rankAdvisoryActions } from "@/lib/student/review-advisory";

const NOW = 1_700_000_000_000;
const day = 86_400_000;

describe("rankAdvisoryActions", () => {
	it("orders overdue review > due-soon review > weak unscheduled, capped at 5", () => {
		const actions = rankAdvisoryActions(
			[
				{ topicId: "a", topicName: "A", averageScore: 40, nextReviewAtMs: NOW - day }, // overdue
				{ topicId: "b", topicName: "B", averageScore: 55, nextReviewAtMs: NOW + day }, // due soon
				{ topicId: "c", topicName: "C", averageScore: 30, nextReviewAtMs: null }, // weak unscheduled
				{ topicId: "d", topicName: "D", averageScore: 95, nextReviewAtMs: null }, // strong → excluded
			],
			NOW,
		);
		expect(actions.map((a) => a.topicId)).toEqual(["a", "b", "c"]);
		expect(actions[0].reason).toBe("overdue");
		expect(actions.length).toBeLessThanOrEqual(5);
	});

	it("excludes mastered, unscheduled topics", () => {
		expect(
			rankAdvisoryActions([{ topicId: "x", topicName: "X", averageScore: 90, nextReviewAtMs: null }], NOW),
		).toEqual([]);
	});
});
```

- [ ] **Step 2:** Run → fail. **Step 3: Implement**:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdvisoryReason = "overdue" | "due_soon" | "weak";
export type AdvisoryRow = {
	topicId: string;
	topicName: string;
	averageScore: number | null;
	/** next_review_at as epoch ms, or null if not scheduled. */
	nextReviewAtMs: number | null;
};
export type AdvisoryAction = { topicId: string; topicName: string; reason: AdvisoryReason; dueInDays: number | null };

const MASTERY_PCT = 75;
const MAX_ACTIONS = 5;

/** Pure ranking: overdue reviews first, then due-soon, then weak unscheduled topics. */
export function rankAdvisoryActions(rows: AdvisoryRow[], nowMs: number): AdvisoryAction[] {
	const scored = rows
		.map((r) => {
			const scheduled = r.nextReviewAtMs != null;
			if (scheduled) {
				const overdue = (r.nextReviewAtMs as number) <= nowMs;
				return {
					topicId: r.topicId,
					topicName: r.topicName,
					reason: (overdue ? "overdue" : "due_soon") as AdvisoryReason,
					dueInDays: Math.round(((r.nextReviewAtMs as number) - nowMs) / 86_400_000),
					rank: overdue ? 0 : 1,
				};
			}
			// Unscheduled: only surface if genuinely weak.
			if (r.averageScore != null && r.averageScore < MASTERY_PCT) {
				return { topicId: r.topicId, topicName: r.topicName, reason: "weak" as AdvisoryReason, dueInDays: null, rank: 2 };
			}
			return null;
		})
		.filter((x): x is NonNullable<typeof x> => x !== null)
		.sort((a, b) => a.rank - b.rank || (a.dueInDays ?? 0) - (b.dueInDays ?? 0));
	return scored.slice(0, MAX_ACTIONS).map(({ rank: _rank, ...rest }) => rest);
}

/** Load advisory rows for a student from performance_tracker (+ topic names). */
export async function loadAdvisoryActions(
	supabase: SupabaseClient,
	studentId: string,
	nowMs: number,
): Promise<AdvisoryAction[]> {
	const { data } = await supabase
		.from("performance_tracker")
		.select("topic_id, average_score, next_review_at, topics(name)")
		.eq("student_id", studentId);
	const rows = ((data ?? []) as Array<{
		topic_id: string;
		average_score: number | string | null;
		next_review_at: string | null;
		topics: { name: string } | null;
	}>).map((r) => ({
		topicId: r.topic_id,
		topicName: r.topics?.name ?? "this topic",
		averageScore: r.average_score != null ? Number(r.average_score) : null,
		nextReviewAtMs: r.next_review_at ? new Date(r.next_review_at).getTime() : null,
	}));
	return rankAdvisoryActions(rows, nowMs);
}
```

- [ ] **Step 4:** Run → pass. tsc + eslint. **Step 5:** Commit.

---

## Task 2: Parent advisory panel

**Files:** a panel component (e.g. `src/components/parent/review-advisory-panel.tsx`) + wire into the parent dashboard or performance page (confirm the exact `StudentDashboardAsync`/`StudentPerformanceAsync` prop seam at execution).

- [ ] **Step 1:** Build a server-rendered panel: title "What [child] should focus on next", a ranked list from `loadAdvisoryActions(supabase, activeChildId, Date.now())`, each row showing topic + a plain-language reason ("Due for review — last score 45%" / "Overdue review" / "Weak — worth practising"). Empty state: "All caught up — nothing due right now."
- [ ] **Step 2:** Resolve the active child via `getParentActiveStudentIdFromCookie()` + `assertParentActiveLink()` (authorization). Render the panel above the existing mirrored report on the parent performance/dashboard page.
- [ ] **Step 3:** Reduced-motion-safe, no client state needed (pure server render). tsc + eslint. **Step 4:** Commit.

> This is a *projection* — no new computation beyond the ranker. Keep it read-only and authorization-checked (parent must have an active link to the child).

---

## Task 3: Teacher auto-retests metrics + read-only strip

**Files:** `src/lib/teachers/teacher-review-metrics.ts` + `__tests__/teacher-review-metrics.test.ts` + a strip component wired into teacher topic/student detail pages.

- [ ] **Step 1:** Implement `loadTeacherClassReviewMetrics({ supabase, roster: studentIds[], subjectId? })`. Query review tests for the roster and shape per-topic counts:

```sql
SELECT t.topic_id,
  COUNT(*)                                                            AS issued,
  COUNT(*) FILTER (WHERE tests.status = 'graded')                     AS completed,
  COUNT(*) FILTER (WHERE tests.status <> 'graded'
                   AND tests.test_date < NOW() - INTERVAL '2 days')   AS overdue
FROM public.performance_tracker t
JOIN public.tests
  ON tests.student_id = t.student_id
 AND tests.test_type = 'review'
WHERE t.student_id = ANY($1) AND ($2::uuid IS NULL OR t.subject_id = $2)
GROUP BY t.topic_id;
```

(Use the existing roster helper in `src/lib/teachers/*` to get `studentIds`; mirror how `teacher-topic-performance-queries.ts` scopes the roster + org. Extract the pure row-shaping into a tested function.)

- [ ] **Step 2:** Add a tiny pure test for the row shaping (issued/completed/overdue derivation from raw counts).
- [ ] **Step 3:** Render a **read-only** "Auto-retests" strip: on the topic detail page (`topic-performance/[topicId]`) show issued/completed/overdue for that topic across the class; on the student detail page show that student's review tests + statuses. No actions/overrides (v1).
- [ ] **Step 4:** tsc + eslint. **Step 5:** Commit.

---

## Task 4: Outcome telemetry (before→after delta)

**Files:** `src/lib/practice/analytics.ts`, `src/lib/practice/ai-grade-practice-test.tsx`.

- [ ] **Step 1:** Add `"review_test_completed"` to the `PracticeEvent`/event-name union in `analytics.ts`.
- [ ] **Step 2:** In `ai-grade-practice-test.tsx`: (a) add `test_type` to the `testRow` select (~L347); (b) extend the Phase-1 prior-tracker read (~L720) to also select `average_score` into the prior map; (c) after the tracker bulk update, if `testRow.test_type === 'review'`, for each `topicRollups` row emit:

```ts
await recordPracticeEvent(
	supabase,
	"review_test_completed",
	{
		test_id: testId,
		topic_id: row.topic_id,
		before_score: priorAvgByTopic.get(row.topic_id) ?? null,
		after_score: row.average_score,
		delta: row.average_score - (priorAvgByTopic.get(row.topic_id) ?? row.average_score),
	},
	{ studentId: userId },
);
```

(`recordPracticeEvent` is fail-silent, so this never blocks grading.)

- [ ] **Step 3:** tsc + eslint. **Step 4:** Commit.

> Reporting (a teacher/admin "review efficacy" dashboard) is deferred — this task only *captures* the deltas. A later phase can aggregate `practice_analytics_events WHERE event_name='review_test_completed'` (avg delta, % improved). Promote to a dedicated `review_outcome_events` table only if/when richer queries are needed.

---

## Task 5: Verification

- [ ] `node_modules/.bin/vitest run` — full suite green incl. ranker + metrics tests.
- [ ] `node_modules/.bin/tsc --noEmit`; eslint changed files `--max-warnings=0`.
- [ ] **Manual:** as a parent, confirm the advisory panel ranks the child's overdue/weak topics and shows an empty state when nothing's due. As a teacher, confirm the read-only auto-retests strip shows issued/completed/overdue. Grade a `review` test and confirm a `review_test_completed` row lands in `practice_analytics_events` with a sensible delta.

---

## Phase 4 self-review (vs spec §9 B/C, §10)

- **Parent advisory** = ranked next-actions projection over `performance_tracker`, authorization-checked, with empty state. ✓ (Tasks 1–2)
- **Teacher read-only** auto-retests strip (issued/done/overdue), no override in v1. ✓ (Task 3)
- **Outcome telemetry** before→after delta per review, reusing `practice_analytics_events`, fail-silent, no migration. ✓ (Task 4)
- **No new tables / no migration** — pure read + one event type. ✓
- **Open at exec:** exact parent panel mount point in `StudentDashboardAsync`/`StudentPerformanceAsync`; the teacher roster helper to source `studentIds`; confirm `practice_analytics_events` event-name typing accepts the new value without a DB CHECK (it's a free-text `event_name`).
- **Deferred (documented):** the review-efficacy *dashboard* that reads the new telemetry (a later phase); a dedicated outcome table if richer queries are needed.
