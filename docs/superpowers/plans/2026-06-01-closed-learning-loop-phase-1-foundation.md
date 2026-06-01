# Closed Learning Loop — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a per-(student, topic) spaced-repetition review schedule that advances automatically every time a practice test is graded — with no user-visible change yet.

**Architecture:** A pure TypeScript function (`computeReviewSchedule`) implements the SM-2-lite rule and is the algorithm's source of truth. The grade pipeline loads each topic's prior schedule, advances it, and ships the new schedule fields as extra keys inside the existing `practice_update_trackers_bulk` jsonb payload. The bulk RPC persists them in the same atomic write that updates the tracker. A `review_scheduler_enabled()` kill-switch and a partial index on `next_review_at` set up Phase 2.

**Tech Stack:** Next.js 15 (server), TypeScript (TABS, `@/` = `src/`), Drizzle ORM, Supabase Postgres (plpgsql RPCs), Vitest. Migrations are hand-written idempotent SQL in `supabase/migrations/` applied to **both** Supabase projects via the Supabase MCP, plus a parallel Drizzle schema update for type parity.

**Spec:** `docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md` (§5 rule, §6 data model).

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `src/lib/practice/review-schedule.ts` | Create | SM-2-lite pure function + config + types. Source of truth for the algorithm. |
| `src/lib/practice/__tests__/review-schedule.test.ts` | Create | Exhaustive unit tests for the rule. |
| `src/db/schema/assessment.ts` | Modify (`performanceTracker`, ~L21-48) | Add 4 schedule columns + partial index for Drizzle type parity. |
| `supabase/migrations/<ts>_review_schedule_phase1.sql` | Create | Idempotent DDL: columns, index, `review_scheduler_enabled()`, extended `practice_update_trackers_bulk`. |
| `src/lib/practice/ai-grade-practice-test.tsx` | Modify (~L717-732) | Load prior schedule, advance it, attach schedule keys to tracker items + replay job payload. |

**Verify commands (used throughout):**
- Types: `node_modules/.bin/tsc --noEmit -p tsconfig.json`
- Lint (changed files): `… | xargs node_modules/.bin/eslint --max-warnings=0`
- Unit tests: `node_modules/.bin/vitest run`
- Drizzle parity: `pnpm db:check-parity`

---

## Task 1: SM-2-lite pure scheduler function

**Files:**
- Create: `src/lib/practice/review-schedule.ts`
- Test: `src/lib/practice/__tests__/review-schedule.test.ts`

Do this first: it has no dependencies and locks the algorithm + types that later tasks consume.

- [ ] **Step 1: Write the failing test**

Create `src/lib/practice/__tests__/review-schedule.test.ts` (TABS for indentation):

```ts
import { describe, expect, it } from "vitest";

import {
	computeReviewSchedule,
	REVIEW_SCHEDULE_CONFIG,
	type ReviewScheduleState,
} from "@/lib/practice/review-schedule";

const UNSCHEDULED: ReviewScheduleState = { intervalDays: null, ease: null, consecutiveGood: 0 };
const T0 = 1_700_000_000_000; // fixed epoch ms; no Date.now() in tests
const DAY = 86_400_000;

describe("computeReviewSchedule", () => {
	it("leaves a passing, unscheduled topic unscheduled (nothing to remediate)", () => {
		const r = computeReviewSchedule({ prior: UNSCHEDULED, topicScore: 90, nowMs: T0 });
		expect(r).toEqual({ intervalDays: null, ease: null, consecutiveGood: 0, nextReviewAt: null });
	});

	it("ENTERS scheduling on the first failing score (start interval + ease)", () => {
		const r = computeReviewSchedule({ prior: UNSCHEDULED, topicScore: 40, nowMs: T0 });
		expect(r.intervalDays).toBe(REVIEW_SCHEDULE_CONFIG.startIntervalDays);
		expect(r.ease).toBe(REVIEW_SCHEDULE_CONFIG.startEase);
		expect(r.consecutiveGood).toBe(0);
		expect(r.nextReviewAt).toBe(new Date(T0 + REVIEW_SCHEDULE_CONFIG.startIntervalDays * DAY).toISOString());
	});

	it("RESETS a scheduled topic to 1 day and lowers ease on a fail", () => {
		const prior: ReviewScheduleState = { intervalDays: 8, ease: 2.2, consecutiveGood: 2 };
		const r = computeReviewSchedule({ prior, topicScore: 30, nowMs: T0 });
		expect(r.intervalDays).toBe(1);
		expect(r.ease).toBeCloseTo(2.0, 5); // 2.2 - 0.2 step down
		expect(r.consecutiveGood).toBe(0);
		expect(r.nextReviewAt).toBe(new Date(T0 + DAY).toISOString());
	});

	it("STRETCHES the interval and raises ease on a pass", () => {
		const prior: ReviewScheduleState = { intervalDays: 2, ease: 2.0, consecutiveGood: 0 };
		const r = computeReviewSchedule({ prior, topicScore: 80, nowMs: T0 });
		expect(r.intervalDays).toBe(4); // round(2 * 2.0)
		expect(r.ease).toBeCloseTo(2.1, 5);
		expect(r.consecutiveGood).toBe(1);
		expect(r.nextReviewAt).toBe(new Date(T0 + 4 * DAY).toISOString());
	});

	it("GRADUATES (clears schedule) after the configured consecutive good streak", () => {
		const prior: ReviewScheduleState = { intervalDays: 8, ease: 2.2, consecutiveGood: 2 };
		const r = computeReviewSchedule({ prior, topicScore: 90, nowMs: T0 });
		expect(r.consecutiveGood).toBe(3);
		expect(r.intervalDays).toBeNull();
		expect(r.ease).toBeNull();
		expect(r.nextReviewAt).toBeNull();
	});

	it("clamps ease to the configured floor and never below", () => {
		const prior: ReviewScheduleState = { intervalDays: 1, ease: REVIEW_SCHEDULE_CONFIG.easeMin, consecutiveGood: 0 };
		const r = computeReviewSchedule({ prior, topicScore: 10, nowMs: T0 });
		expect(r.ease).toBe(REVIEW_SCHEDULE_CONFIG.easeMin);
	});

	it("treats exactly the pass threshold as a pass", () => {
		const r = computeReviewSchedule({ prior: UNSCHEDULED, topicScore: REVIEW_SCHEDULE_CONFIG.masteryPassPct, nowMs: T0 });
		// passing + unscheduled → stays unscheduled
		expect(r.nextReviewAt).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/vitest run src/lib/practice/__tests__/review-schedule.test.ts`
Expected: FAIL — `Cannot find module '@/lib/practice/review-schedule'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/practice/review-schedule.ts` (TABS):

```ts
/**
 * SM-2-lite spaced-repetition scheduler for per-topic review.
 *
 * Pure + deterministic: given a topic's prior review state and the latest test
 * score for that topic, return the next review state. No I/O, no clock access
 * (the caller passes `nowMs`) — so it unit-tests exhaustively.
 *
 * SOURCE OF TRUTH for the algorithm. Persisted by passing the result fields as
 * extra keys in each `practice_update_trackers_bulk` jsonb item. See
 * docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §5.
 */

export const REVIEW_SCHEDULE_CONFIG = {
	/** Score (0–100) at/above which a review counts as a pass. */
	masteryPassPct: 75,
	/** Interval (days) when a topic first enters scheduling. */
	startIntervalDays: 2,
	/** Ease multiplier when a topic first enters scheduling. */
	startEase: 2.0,
	easeMin: 1.3,
	easeMax: 2.6,
	easeStepUp: 0.1,
	easeStepDown: 0.2,
	/** Consecutive passes after which a topic graduates out of scheduling. */
	graduateGoodStreak: 3,
} as const;

const MS_PER_DAY = 86_400_000;

/** Persisted spaced-repetition state for one (student, topic). */
export type ReviewScheduleState = {
	/** Days until next review. `null` ⇒ not actively scheduled. */
	intervalDays: number | null;
	/** SM-2-lite multiplier. `null` ⇒ not actively scheduled. */
	ease: number | null;
	/** Count of consecutive passing reviews. */
	consecutiveGood: number;
};

export type ComputeReviewScheduleInput = {
	prior: ReviewScheduleState;
	/** This test's average score for the topic, 0–100. */
	topicScore: number;
	/** This test's timestamp, ms since epoch (caller-supplied). */
	nowMs: number;
};

export type ReviewScheduleResult = ReviewScheduleState & {
	/** ISO timestamp of the next review, or `null` when unscheduled/graduated. */
	nextReviewAt: string | null;
};

function clampEase(ease: number): number {
	return Math.min(REVIEW_SCHEDULE_CONFIG.easeMax, Math.max(REVIEW_SCHEDULE_CONFIG.easeMin, ease));
}

function dueAt(nowMs: number, intervalDays: number): string {
	return new Date(nowMs + intervalDays * MS_PER_DAY).toISOString();
}

export function computeReviewSchedule(input: ComputeReviewScheduleInput): ReviewScheduleResult {
	const cfg = REVIEW_SCHEDULE_CONFIG;
	const { prior, topicScore, nowMs } = input;
	const passed = topicScore >= cfg.masteryPassPct;
	const wasScheduled = prior.intervalDays != null && prior.ease != null;

	// Passing on a topic that isn't being remediated → nothing to schedule.
	if (!wasScheduled && passed) {
		return { intervalDays: null, ease: null, consecutiveGood: 0, nextReviewAt: null };
	}

	if (!passed) {
		if (!wasScheduled) {
			// ENTER scheduling.
			return {
				intervalDays: cfg.startIntervalDays,
				ease: cfg.startEase,
				consecutiveGood: 0,
				nextReviewAt: dueAt(nowMs, cfg.startIntervalDays),
			};
		}
		// RESET: comes back fast, ease drops.
		const ease = clampEase((prior.ease ?? cfg.startEase) - cfg.easeStepDown);
		return { intervalDays: 1, ease, consecutiveGood: 0, nextReviewAt: dueAt(nowMs, 1) };
	}

	// PASS on a scheduled topic.
	const consecutiveGood = prior.consecutiveGood + 1;
	if (consecutiveGood >= cfg.graduateGoodStreak) {
		// GRADUATE: drop out of active scheduling.
		return { intervalDays: null, ease: null, consecutiveGood, nextReviewAt: null };
	}
	const priorInterval = prior.intervalDays ?? cfg.startIntervalDays;
	const priorEase = prior.ease ?? cfg.startEase;
	const intervalDays = Math.round(priorInterval * priorEase);
	const ease = clampEase(priorEase + cfg.easeStepUp);
	return { intervalDays, ease, consecutiveGood, nextReviewAt: dueAt(nowMs, intervalDays) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/vitest run src/lib/practice/__tests__/review-schedule.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint + typecheck the new files**

Run: `printf '%s\n' src/lib/practice/review-schedule.ts src/lib/practice/__tests__/review-schedule.test.ts | xargs node_modules/.bin/eslint --max-warnings=0`
Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no output / exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/practice/review-schedule.ts src/lib/practice/__tests__/review-schedule.test.ts
git commit -m "feat(practice): SM-2-lite review-schedule pure function (loop phase 1)"
```

---

## Task 2: Add schedule columns to the Drizzle schema

**Files:**
- Modify: `src/db/schema/assessment.ts` (the `performanceTracker` table, ~L21-48)

This keeps Drizzle's types in parity with the SQL migration in Task 3. No new imports are needed — `integer`, `decimal`, `timestamp`, `index`, and `sql` are already imported at the top of the file.

- [ ] **Step 1: Add the four columns**

In `performanceTracker`, immediately after the `trend` column (currently `trend: varchar("trend", { length: 20 }).default("stable"),`) add:

```ts
		nextReviewAt: timestamp("next_review_at"),
		reviewIntervalDays: integer("review_interval_days"),
		reviewEase: decimal("review_ease", { precision: 3, scale: 2 }),
		consecutiveGood: integer("consecutive_good").notNull().default(0),
```

- [ ] **Step 2: Add the partial index**

In the same table's index array (the `(t) => [ ... ]` block), add a new entry after `index("idx_perf_student").on(t.studentId),`:

```ts
		index("idx_perf_next_review").on(t.nextReviewAt).where(sql`${t.nextReviewAt} is not null`),
```

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0 (the new columns/index are now part of the `performanceTracker` type).

- [ ] **Step 4: Lint the changed file**

Run: `printf '%s\n' src/db/schema/assessment.ts | xargs node_modules/.bin/eslint --max-warnings=0`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/assessment.ts
git commit -m "feat(db): performance_tracker review-schedule columns + due index (loop phase 1)"
```

---

## Task 3: SQL migration — columns, kill-switch, extended bulk RPC

**Files:**
- Create: `supabase/migrations/<TS>_review_schedule_phase1.sql`

`<TS>` = a 14-digit timestamp that sorts AFTER the latest existing migration. At time of writing the latest is `20260703000000_*`; use `20260704000000` (verify with `ls -1 supabase/migrations/ | tail -1` and bump if newer files exist). All statements are idempotent (`ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `CREATE OR REPLACE`) so re-applying is safe — matching the `streak_freeze_recovery.sql` precedent.

> **Why the jsonb payload, not new function params:** `practice_update_tracker_running` has a fixed 7-arg signature shared by 3 callers, and Postgres `CREATE OR REPLACE FUNCTION` cannot change an argument list (it would create an overload, not replace). So the schedule fields ride as extra keys inside the existing `p_items` jsonb of `practice_update_trackers_bulk`; non-grade callers omit those keys and their schedule is left untouched.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260704000000_review_schedule_phase1.sql`:

```sql
-- Closed learning loop — Phase 1 foundation.
-- Persist a per-(student, topic) spaced-repetition review schedule, advanced on
-- every graded test. Idempotent; apply to BOTH Supabase projects via MCP
-- (canary ezxmjkvhrlqeimhnfvfd + EDU_AI suwakggcbxmmvqzeudmq), then capture here.
-- Spec: docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §5–§6.

-- 1. Schedule columns on the existing per-(student, topic) tracker row.
ALTER TABLE public.performance_tracker
	ADD COLUMN IF NOT EXISTS next_review_at timestamptz,
	ADD COLUMN IF NOT EXISTS review_interval_days integer,
	ADD COLUMN IF NOT EXISTS review_ease numeric(3,2),
	ADD COLUMN IF NOT EXISTS consecutive_good integer NOT NULL DEFAULT 0;

-- 2. Partial index so the Phase 2 nightly selector is a cheap lookup, not a scan.
CREATE INDEX IF NOT EXISTS idx_perf_next_review
	ON public.performance_tracker (next_review_at)
	WHERE next_review_at IS NOT NULL;

-- 3. Kill-switch / staged-rollout gate (mirrors streak_freeze_enabled()).
--    Flip with CREATE OR REPLACE returning false; no schema change.
CREATE OR REPLACE FUNCTION public.review_scheduler_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$ SELECT true $$;

-- 4. Extend the bulk tracker RPC to persist the TS-computed schedule fields.
--    Signature is UNCHANGED (jsonb payload); the schedule is written only when
--    the caller supplied the keys (guarded by `elem ? 'consecutive_good'`).
CREATE OR REPLACE FUNCTION public.practice_update_trackers_bulk(
	p_student_id uuid,
	p_subject_id uuid,
	p_current_test_id uuid,
	p_now timestamptz,
	p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	elem jsonb;
BEGIN
	IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
		RETURN;
	END IF;

	FOR elem IN SELECT t.x FROM jsonb_array_elements(p_items) AS t(x)
	LOOP
		IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
			CONTINUE;
		END IF;
		IF elem->>'topic_id' IS NULL OR elem->>'average_score' IS NULL THEN
			CONTINUE;
		END IF;

		PERFORM public.practice_update_tracker_running(
			p_student_id,
			p_subject_id,
			(elem->>'topic_id')::uuid,
			p_current_test_id,
			(elem->>'average_score')::numeric,
			COALESCE((elem->>'n_incorrect')::int, 0),
			p_now::timestamp
		);

		-- Closed-learning-loop: persist the spaced-repetition schedule computed in
		-- TS (src/lib/practice/review-schedule.ts). Only when the caller supplied
		-- the keys, so replay/admin callers without them leave the schedule intact.
		-- A JSON null for next_review_at/interval/ease clears the column (graduation).
		IF elem ? 'consecutive_good' THEN
			UPDATE public.performance_tracker
			SET next_review_at = (elem->>'next_review_at')::timestamptz,
			    review_interval_days = (elem->>'review_interval_days')::int,
			    review_ease = (elem->>'review_ease')::numeric,
			    consecutive_good = COALESCE((elem->>'consecutive_good')::int, 0),
			    updated_at = p_now
			WHERE student_id = p_student_id
			  AND topic_id = (elem->>'topic_id')::uuid;
		END IF;
	END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO service_role;
```

- [ ] **Step 2: Apply to BOTH Supabase projects**

Use the Supabase MCP `apply_migration` (name `review_schedule_phase1`, the SQL above) against **each** project: canary `ezxmjkvhrlqeimhnfvfd` and EDU_AI `suwakggcbxmmvqzeudmq`. (CLI alternative if MCP is unavailable: `supabase db push` per linked project.)
Expected: both apply cleanly; re-running is a no-op (idempotent).

- [ ] **Step 3: Verify the function + columns landed (per project)**

Run via MCP `execute_sql` on each project:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'performance_tracker'
  AND column_name IN ('next_review_at','review_interval_days','review_ease','consecutive_good')
ORDER BY column_name;
SELECT public.review_scheduler_enabled() AS enabled;
```
Expected: 4 rows; `enabled = true`.

- [ ] **Step 4: Check Drizzle ↔ Postgres parity**

Run: `pnpm db:check-parity`
Expected: no drift reported between `src/db/schema/assessment.ts` (Task 2) and the live schema. If it flags the migration-ledger version offset between projects, run `pnpm db:reconcile-migration-ledger` (see the streak migration's header note for precedent).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260704000000_review_schedule_phase1.sql
git commit -m "feat(db): review-schedule columns, kill-switch, bulk RPC persist (loop phase 1)"
```

---

## Task 4: Advance the schedule from the grade pipeline

**Files:**
- Modify: `src/lib/practice/ai-grade-practice-test.tsx` (~L717-759)
- Test: `src/lib/practice/__tests__/grade-review-schedule-payload.test.ts` (create)

The grade pipeline already builds `trackerPayloadItems` from `topicRollups` and sends them to `practice_update_trackers_bulk`, with a best-effort replay via a `tracker_update` job. We load each topic's prior schedule, advance it with the Task 1 function, and attach the four schedule keys to each item (so both the RPC call and the replay payload carry them).

- [ ] **Step 1: Write the failing test (payload-builder extraction)**

To test the wiring without standing up the whole grade pipeline, extract the item-building into a small pure helper. Create `src/lib/practice/__tests__/grade-review-schedule-payload.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildTrackerPayloadItems } from "@/lib/practice/review-schedule-payload";

const T0 = 1_700_000_000_000;

describe("buildTrackerPayloadItems", () => {
	it("attaches advanced schedule keys per topic rollup", () => {
		const items = buildTrackerPayloadItems({
			rollups: [{ topic_id: "11111111-1111-1111-1111-111111111111", average_score: 40, n_incorrect: 3 }],
			priorByTopic: new Map(),
			nowMs: T0,
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			topic_id: "11111111-1111-1111-1111-111111111111",
			average_score: 40,
			n_incorrect: 3,
			review_interval_days: 2, // ENTER on a fail
			consecutive_good: 0,
		});
		expect(items[0].next_review_at).toBe(new Date(T0 + 2 * 86_400_000).toISOString());
	});

	it("clears the schedule on graduation (3rd consecutive pass)", () => {
		const items = buildTrackerPayloadItems({
			rollups: [{ topic_id: "22222222-2222-2222-2222-222222222222", average_score: 90, n_incorrect: 0 }],
			priorByTopic: new Map([["22222222-2222-2222-2222-222222222222", { intervalDays: 8, ease: 2.2, consecutiveGood: 2 }]]),
			nowMs: T0,
		});
		expect(items[0].next_review_at).toBeNull();
		expect(items[0].review_interval_days).toBeNull();
		expect(items[0].consecutive_good).toBe(3);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node_modules/.bin/vitest run src/lib/practice/__tests__/grade-review-schedule-payload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/practice/review-schedule-payload'`.

- [ ] **Step 3: Write the payload helper**

Create `src/lib/practice/review-schedule-payload.ts` (TABS):

```ts
import { computeReviewSchedule, type ReviewScheduleState } from "@/lib/practice/review-schedule";

export type TopicRollup = {
	topic_id: string;
	average_score: number;
	n_incorrect: number;
};

export type TrackerPayloadItem = TopicRollup & {
	next_review_at: string | null;
	review_interval_days: number | null;
	review_ease: number | null;
	consecutive_good: number;
};

export function buildTrackerPayloadItems(args: {
	rollups: TopicRollup[];
	priorByTopic: Map<string, ReviewScheduleState>;
	nowMs: number;
}): TrackerPayloadItem[] {
	const { rollups, priorByTopic, nowMs } = args;
	return rollups.map((row) => {
		const prior = priorByTopic.get(row.topic_id) ?? { intervalDays: null, ease: null, consecutiveGood: 0 };
		const schedule = computeReviewSchedule({ prior, topicScore: Number(row.average_score), nowMs });
		return {
			topic_id: row.topic_id,
			average_score: row.average_score,
			n_incorrect: row.n_incorrect,
			next_review_at: schedule.nextReviewAt,
			review_interval_days: schedule.intervalDays,
			review_ease: schedule.ease,
			consecutive_good: schedule.consecutiveGood,
		};
	});
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node_modules/.bin/vitest run src/lib/practice/__tests__/grade-review-schedule-payload.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the helper into the grade pipeline**

In `src/lib/practice/ai-grade-practice-test.tsx`, add the import near the other `@/lib/practice` imports at the top of the file:

```ts
import { buildTrackerPayloadItems } from "@/lib/practice/review-schedule-payload";
import type { ReviewScheduleState } from "@/lib/practice/review-schedule";
```

Then replace the existing `trackerPayloadItems` construction (currently):

```ts
	const trackerPayloadItems = topicRollups.map((row) => ({
		topic_id: row.topic_id,
		average_score: row.average_score,
		n_incorrect: row.n_incorrect,
	}));
```

with a prior-schedule load followed by the helper:

```ts
	// Closed-learning-loop: load each topic's prior review schedule so we can
	// advance the SM-2-lite state inside the same tracker write (and replay job).
	const reviewTopicIds = topicRollups.map((row) => row.topic_id);
	const priorScheduleByTopic = new Map<string, ReviewScheduleState>();
	if (reviewTopicIds.length > 0) {
		const { data: priorRows } = await supabase
			.from("performance_tracker")
			.select("topic_id, review_interval_days, review_ease, consecutive_good")
			.eq("student_id", userId)
			.in("topic_id", reviewTopicIds);
		for (const row of priorRows ?? []) {
			priorScheduleByTopic.set(row.topic_id, {
				intervalDays: row.review_interval_days ?? null,
				ease: row.review_ease != null ? Number(row.review_ease) : null,
				consecutiveGood: row.consecutive_good ?? 0,
			});
		}
	}
	const trackerPayloadItems = buildTrackerPayloadItems({
		rollups: topicRollups,
		priorByTopic: priorScheduleByTopic,
		nowMs: new Date(nowIso).getTime(),
	});
```

No other change is needed: the existing `supabase.rpc("practice_update_trackers_bulk", { … p_items: trackerPayloadItems })` call and the `tracker_update` replay job payload both already reference `trackerPayloadItems`, so they now carry the schedule keys automatically.

- [ ] **Step 6: Typecheck + lint the changed files**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json`
Run: `printf '%s\n' src/lib/practice/ai-grade-practice-test.tsx src/lib/practice/review-schedule-payload.ts src/lib/practice/__tests__/grade-review-schedule-payload.test.ts | xargs node_modules/.bin/eslint --max-warnings=0`
Expected: exit 0 for both.

- [ ] **Step 7: Commit**

```bash
git add src/lib/practice/ai-grade-practice-test.tsx src/lib/practice/review-schedule-payload.ts src/lib/practice/__tests__/grade-review-schedule-payload.test.ts
git commit -m "feat(practice): advance review schedule on grade (loop phase 1)"
```

---

## Task 5: Full verification & integration check

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `node_modules/.bin/vitest run`
Expected: the full suite (~2150 tests) passes, including the 2 new test files. If anything unrelated fails, it's pre-existing — note it, don't fix it here.

- [ ] **Step 2: Full typecheck**

Run: `node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Lint the full set of changed files**

Run: `git diff --name-only origin/main...HEAD -- '*.ts' '*.tsx' | xargs node_modules/.bin/eslint --max-warnings=0`
Expected: exit 0 (strict `--max-warnings=0`).

- [ ] **Step 4: End-to-end sanity (manual, optional but recommended)**

Against a dev/staging project, grade one practice test where a topic scores below 75, then query:

```sql
SELECT topic_id, average_score, next_review_at, review_interval_days, review_ease, consecutive_good
FROM public.performance_tracker
WHERE student_id = '<test-student-id>'
ORDER BY updated_at DESC LIMIT 10;
```
Expected: the weak topic now has `next_review_at ≈ now + 2 days`, `review_interval_days = 2`, `consecutive_good = 0`. A topic scored ≥75 that wasn't already scheduled has `next_review_at IS NULL`.

- [ ] **Step 5: Push the branch**

```bash
git push
```

---

## Phase 1 self-review (author check against the spec)

- **Spec §6 columns** (`next_review_at`, `review_interval_days`, `review_ease`, `consecutive_good`, partial index) → Task 2 (Drizzle) + Task 3 (SQL). ✓
- **Spec §6 kill-switch** (`review_scheduler_enabled()`) → Task 3 step 1. ✓
- **Spec §5 SM-2-lite rule** (enter / pass / fail / graduate, ease floor/cap, interval stretch) → Task 1 function + tests. ✓
- **Spec §6 on-grade hook** (compute in TS, persist via the tracker RPC items payload, atomic, replay-consistent) → Task 4. ✓
- **Both Supabase projects** → Task 3 step 2. ✓
- **Conventions** (TABS, `@/`, strict eslint, idempotent migration) → honored throughout.
- **Refinement vs spec, intentional:** graduation keys on "3 consecutive passes (each ≥75%)" via `consecutive_good` rather than the running-average mastery band, so the rule stays a self-contained pure function (no cross-language dependency on the SQL-computed running average). Equivalent outcome; noted for the Phase 4 telemetry author.
- **Deferred to Phase 2 (not in scope here):** the nightly selector, review-intent queue, drain worker, retest builder, quota/sub-budget/1-per-day caps, and the "your review is ready" notification. Phase 1 only accrues schedule state; nothing reads `next_review_at` yet.

**No user-visible change ships in Phase 1.** This is intentional (dark foundation) per spec §13.
