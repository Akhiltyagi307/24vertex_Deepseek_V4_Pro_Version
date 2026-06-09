# Manual Assignment Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers author assignments by hand — writing each question, its answer key, and a chapter/topic tag — as an alternative to AI generation, while reusing the existing grading, performance-tracker, and reporting pipeline unchanged.

**Architecture:** A teacher-authored question template is stored in a new `assignment_questions` table. The assignment `config` gains an `authoring_mode: 'ai' | 'manual'` discriminator (missing = `'ai'`, so existing rows are unaffected). On publish, the existing per-student submission + job pipeline runs, but materialization forks: for manual assignments a new no-LLM RPC copies the authored questions into each student's `tests`/`questions` rows. Grading, tracker updates, reports, and the student test-taker are untouched. Editing a published manual assignment re-materializes only not-yet-started submissions.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Drizzle ORM, Supabase Postgres (SQL migrations + SECURITY DEFINER RPCs + RLS), Zod, Vitest.

---

## Spec reference

Implements `docs/superpowers/specs/2026-06-06-manual-assignment-creation-design.md`. Read it first — especially §6 (answer-key shapes per type) and §9.2 (edit-after-publish).

## Key facts verified in the codebase (do not re-discover)

- `questions.question_type` CHECK **already allows all five** types (`multiple_choice`, `short_answer`, `numerical`, `fill_in_blank`, `long_answer`) — see [20260420120000_practice_question_types_fill_long.sql](supabase/migrations/20260420120000_practice_question_types_fill_long.sql). No change needed on `questions`.
- The AI RPC `practice_generate_assigned_test` hard-rejects durations outside `(3600, 10800)` and requires config difficulty/count to match the payload ([20260618130000_…_final_hardening.sql:469-483](supabase/migrations/20260618130000_educator_practice_assignments_final_hardening.sql)). Manual needs its **own** RPC.
- The worker's `handleAssignGenerateTestJob` just calls `materializeAssignedPracticeTest(submissionId)` ([run-jobs/route.ts:573-585](app/api/internal/practice/run-jobs/route.ts)). **No worker change** — we branch inside `materializeAssignedPracticeTest`.
- The `tests` row for an assigned test is created with `status='in_progress'`, `is_draft=true`, `test_type='assigned'`, `time_limit_seconds=<duration>`. Mirror this exactly.
- Three read queries parse `config` with the **strict** `assignmentConfigSchema` and drop the row on failure ([queries.ts:186-192, 248-254, 456-461](src/lib/assignments/queries.ts)). A manual config would fail and the assignment would vanish from lists — Task 5 fixes this with a lenient parser.
- Performance trackers are updated by the existing grade job via `questions.topic_id` + `student_answers.score_earned` — origin-agnostic. As long as authored questions carry a valid `topic_id`, trackers update with no new code.
- DB writes in this codebase go through Drizzle `db` (direct Postgres connection that bypasses RLS); RLS is defense-in-depth. Follow that pattern.
- Tests: `pnpm test <path>` runs a single Vitest file. Migrations are tested by string-asserting the `.sql` file (see [migrations.test.ts](src/lib/assignments/migrations.test.ts)).

## File structure

**Create:**
- `supabase/migrations/20260703000000_manual_assignment_authoring.sql` — `assignment_questions` table, RLS, and the `practice_create_manual_assigned_test` RPC.
- `src/lib/assignments/manual-assignment-migration.test.ts` — string assertions over the migration.
- `src/lib/assignments/manual-schemas.ts` — Zod: manual config, per-type answer keys, per-question union, create/draft/update inputs.
- `src/lib/assignments/manual-schemas.test.ts` — schema unit tests.
- `src/lib/assignments/manual-helpers.ts` — pure helpers (derive config, draft→payload, impact counts).
- `src/lib/assignments/manual-helpers.test.ts` — helper unit tests.
- `src/lib/assignments/manual-queries.ts` — `createPublishedManualAssignment`, `saveManualAssignmentDraft`, `getManualAssignmentForEdit`, `updatePublishedManualAssignment`.
- `app/teacher/(protected)/assignments/manual-actions.ts` — `saveManualAssignmentDraftAction`, `publishManualAssignmentAction`, `updatePublishedManualAssignmentAction`.
- `app/teacher/(protected)/assignments/assignment-create-switcher.tsx` — client AI/Manual toggle.
- `src/components/teacher/manual/manual-topic-picker.tsx` — chapter-grouped single-select.
- `src/components/teacher/manual/manual-question-editor.tsx` — per-type question editor.
- `src/components/teacher/manual/teacher-manual-assignment-builder.tsx` — the builder (create + edit modes).

**Modify:**
- `src/db/schema/teaching.ts` — add `assignmentQuestions` Drizzle table.
- `src/db/schema/teaching.test.ts` — **create** a column-presence test.
- `src/lib/assignments/schemas.ts` — add `assignmentConfigBaseSchema`.
- `src/lib/assignments/queries.ts` — lenient config parse in the 3 read fns; add `authoringMode` to row types.
- `src/lib/admin/assignment-generation.ts` — branch to manual materialization.
- `app/teacher/(protected)/assignments/page.tsx` — render the switcher.
- The teacher assignment-list component — add a Manual/AI badge (Task 14 locates it).

**No change:** `app/api/internal/practice/run-jobs/route.ts`, all grading/tracker/report code, the student test-taker.

---

# Phase 1 — Database

### Task 1: `assignment_questions` table + manual materialization RPC (migration)

**Files:**
- Create: `supabase/migrations/20260703000000_manual_assignment_authoring.sql`
- Test: `src/lib/assignments/manual-assignment-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

Create `src/lib/assignments/manual-assignment-migration.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "supabase", "migrations");

function readManualMigration(): string {
	const fileName = readdirSync(migrationsDir).find((name) => name.endsWith("_manual_assignment_authoring.sql"));
	expect(fileName).toBeDefined();
	return readFileSync(join(migrationsDir, fileName!), "utf8");
}

describe("manual assignment authoring migration", () => {
	it("creates the assignment_questions template table with RLS", () => {
		const sql = readManualMigration();
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignment_questions");
		expect(sql).toContain("assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE");
		expect(sql).toContain("answer_key JSONB NOT NULL");
		expect(sql).toContain("question_type IN");
		expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
		expect(sql).toContain("public.auth_is_verified_teacher(auth.uid())");
	});

	it("creates a worker-only manual materialization RPC", () => {
		const sql = readManualMigration();
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.practice_create_manual_assigned_test");
		expect(sql).toContain("auth.role() <> 'service_role'");
		expect(sql).toContain("FROM public.assignment_questions");
		expect(sql).toContain("test_type"); // inserts an 'assigned' test
		expect(sql).toContain("lifecycle_status = 'ready'");
		expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.practice_create_manual_assigned_test(UUID) TO service_role");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/assignments/manual-assignment-migration.test.ts`
Expected: FAIL — `fileName` is undefined (migration not created yet).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260703000000_manual_assignment_authoring.sql`:

```sql
-- Manual (teacher-authored) assignments.
-- Adds the authored-question template table and a no-LLM materialization RPC.
-- AI assignments are unaffected: authoring_mode lives in config JSONB and defaults to 'ai'.

BEGIN;

-- 1. Authored question template (one set per assignment; copied per student at materialization).
CREATE TABLE IF NOT EXISTS public.assignment_questions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
	question_number INT NOT NULL,
	topic_id UUID NOT NULL REFERENCES public.topics(id),
	question_type VARCHAR(20) NOT NULL,
	question_text TEXT NOT NULL,
	options JSONB,
	answer_key JSONB NOT NULL,
	difficulty_level VARCHAR(10) NOT NULL DEFAULT 'medium',
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT assignment_questions_question_type_check CHECK (
		question_type IN ('multiple_choice', 'short_answer', 'numerical', 'fill_in_blank', 'long_answer')
	),
	CONSTRAINT assignment_questions_number_uq UNIQUE (assignment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment
	ON public.assignment_questions (assignment_id, question_number);

ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read own assignment questions" ON public.assignment_questions;
CREATE POLICY "Teachers read own assignment questions"
ON public.assignment_questions FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1 FROM public.assignments a
		WHERE a.id = assignment_questions.assignment_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);
-- Writes happen server-side via the Drizzle connection (bypasses RLS), mirroring assignments.

-- 2. Manual materialization: copy the authored template into a per-student assigned test. No LLM.
CREATE OR REPLACE FUNCTION public.practice_create_manual_assigned_test(
	p_assignment_submission_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id UUID;
	v_assignment_id UUID;
	v_assignment_status TEXT;
	v_teacher_id UUID;
	v_config JSONB;
	v_lifecycle_status TEXT;
	v_existing_test_id UUID;
	v_subject_id UUID;
	v_difficulty TEXT;
	v_duration INT;
	v_count INT;
	v_question_mix JSONB;
	v_test_id UUID;
BEGIN
	IF auth.role() <> 'service_role' THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	SELECT s.student_id, s.assignment_id, a.status, a.teacher_id, a.config, s.lifecycle_status, s.test_id
	INTO v_student_id, v_assignment_id, v_assignment_status, v_teacher_id, v_config, v_lifecycle_status, v_existing_test_id
	FROM public.assignment_submissions s
	JOIN public.assignments a ON a.id = s.assignment_id
	WHERE s.id = p_assignment_submission_id
	FOR UPDATE OF s;

	IF v_assignment_id IS NULL OR v_teacher_id IS NULL THEN
		RAISE EXCEPTION 'Assignment submission not found';
	END IF;
	IF v_existing_test_id IS NOT NULL THEN
		RETURN v_existing_test_id;
	END IF;
	IF v_assignment_status <> 'published' THEN
		RAISE EXCEPTION 'Assignment is not published';
	END IF;
	IF v_lifecycle_status NOT IN ('pending_materialize', 'failed_generation') THEN
		RAISE EXCEPTION 'Assignment submission is not awaiting materialization';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Assigned tests require a student profile';
	END IF;
	IF NOT public.teacher_can_access_student(v_teacher_id, v_student_id) THEN
		RAISE EXCEPTION 'Teacher cannot access this student';
	END IF;
	IF v_config->>'kind' <> 'practice_test' THEN
		RAISE EXCEPTION 'Unsupported assignment kind';
	END IF;
	IF v_config->>'authoring_mode' <> 'manual' THEN
		RAISE EXCEPTION 'Not a manual assignment';
	END IF;

	v_subject_id := (v_config->>'subject_id')::uuid;
	v_difficulty := COALESCE(v_config->>'difficulty', 'medium');
	v_duration := COALESCE((v_config->>'time_limit_seconds')::int, 3600);
	IF v_difficulty NOT IN ('easy', 'medium', 'hard') THEN
		v_difficulty := 'medium';
	END IF;
	IF v_duration <= 0 OR v_duration > 14400 THEN
		RAISE EXCEPTION 'Invalid manual assignment duration';
	END IF;

	SELECT count(*) INTO v_count FROM public.assignment_questions WHERE assignment_id = v_assignment_id;
	IF v_count <= 0 OR v_count > 200 THEN
		RAISE EXCEPTION 'Manual assignment has no questions or too many';
	END IF;

	SELECT jsonb_object_agg(qt, c)
	INTO v_question_mix
	FROM (
		SELECT question_type AS qt, count(*) AS c
		FROM public.assignment_questions
		WHERE assignment_id = v_assignment_id
		GROUP BY question_type
	) mix;

	INSERT INTO public.tests (
		student_id, subject_id, assignment_submission_id, test_type, status, is_draft,
		time_limit_seconds, total_questions, difficulty, question_count, question_mix
	) VALUES (
		v_student_id, v_subject_id, p_assignment_submission_id, 'assigned', 'in_progress', TRUE,
		v_duration, v_count, v_difficulty, v_count, COALESCE(v_question_mix, '{}'::jsonb)
	) RETURNING id INTO v_test_id;

	INSERT INTO public.questions (
		test_id, topic_id, question_text, question_type, difficulty_level, answer_key, options, question_number, metadata
	)
	SELECT
		v_test_id,
		aq.topic_id,
		aq.question_text,
		aq.question_type,
		aq.difficulty_level,
		aq.answer_key,
		CASE WHEN aq.question_type = 'multiple_choice' THEN aq.options ELSE NULL END,
		aq.question_number,
		COALESCE(aq.metadata, '{}'::jsonb)
	FROM public.assignment_questions aq
	WHERE aq.assignment_id = v_assignment_id
	ORDER BY aq.question_number;

	UPDATE public.assignment_submissions
	SET test_id = v_test_id,
		lifecycle_status = 'ready',
		error = NULL,
		updated_at = NOW()
	WHERE id = p_assignment_submission_id;

	RETURN v_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_create_manual_assigned_test(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_create_manual_assigned_test(UUID) TO service_role;

COMMIT;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/assignments/manual-assignment-migration.test.ts`
Expected: PASS (both tests green).

- [ ] **Step 5: Apply the migration to your local/staging Supabase**

Run (local dev DB): `pnpm exec supabase db push` — or apply via your team's migration workflow. Confirm no errors and that `assignment_questions` and `practice_create_manual_assigned_test` exist.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260703000000_manual_assignment_authoring.sql src/lib/assignments/manual-assignment-migration.test.ts
git commit -m "feat(assignments): add assignment_questions table + manual materialization RPC"
```

---

### Task 2: Drizzle schema for `assignment_questions`

**Files:**
- Modify: `src/db/schema/teaching.ts`
- Test: `src/db/schema/teaching.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/db/schema/teaching.test.ts`:

```ts
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { assignmentQuestions } from "@/db/schema/teaching";

describe("assignmentQuestions schema", () => {
	it("exposes the columns the manual flow copies into questions", () => {
		const columns = Object.keys(getTableColumns(assignmentQuestions));
		expect(columns).toEqual(
			expect.arrayContaining([
				"id",
				"assignmentId",
				"questionNumber",
				"topicId",
				"questionType",
				"questionText",
				"options",
				"answerKey",
				"difficultyLevel",
				"metadata",
			]),
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/db/schema/teaching.test.ts`
Expected: FAIL — `assignmentQuestions` is not exported.

- [ ] **Step 3: Add the Drizzle table**

In `src/db/schema/teaching.ts`, add `integer` to the import list from `drizzle-orm/pg-core` (it is not currently imported), import `topics`, and append the table after `assignmentSubmissions`:

```ts
import { topics } from "./academic";
```

```ts
export const assignmentQuestions = pgTable(
	"assignment_questions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		assignmentId: uuid("assignment_id")
			.notNull()
			.references(() => assignments.id, { onDelete: "cascade" }),
		questionNumber: integer("question_number").notNull(),
		topicId: uuid("topic_id")
			.notNull()
			.references(() => topics.id),
		questionType: varchar("question_type", { length: 20 }).notNull(),
		questionText: text("question_text").notNull(),
		options: jsonb("options"),
		answerKey: jsonb("answer_key").notNull(),
		difficultyLevel: varchar("difficulty_level", { length: 10 }).notNull().default("medium"),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("assignment_questions_number_uq").on(t.assignmentId, t.questionNumber),
		index("idx_assignment_questions_assignment").on(t.assignmentId, t.questionNumber),
	],
);
```

Note: `integer` must be added to the existing `drizzle-orm/pg-core` import block (it currently imports `boolean, decimal, index, jsonb, pgTable, text, timestamp, unique, uuid, varchar`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/db/schema/teaching.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify Drizzle/Postgres parity and types**

Run: `pnpm exec tsc --noEmit` (no new errors) and `pnpm db:check-parity` (the new table matches the migration).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/teaching.ts src/db/schema/teaching.test.ts
git commit -m "feat(assignments): add assignmentQuestions Drizzle table"
```

---

# Phase 2 — Schemas & validation

### Task 3: Lenient base config parser (`assignmentConfigBaseSchema`)

**Files:**
- Modify: `src/lib/assignments/schemas.ts`
- Test: `src/lib/assignments/schemas.test.ts` (add a case)

- [ ] **Step 1: Add the failing test case**

In `src/lib/assignments/schemas.test.ts`, add `assignmentConfigBaseSchema` to the import and add this test inside the `describe`:

```ts
it("base config parser accepts both AI and manual configs and defaults authoring_mode to ai", () => {
	const ai = assignmentConfigBaseSchema.parse({
		v: 1,
		kind: "practice_test",
		subject_id: "11111111-1111-1111-1111-111111111111",
		topic_ids: ["22222222-2222-2222-2222-222222222222"],
		difficulty: "medium",
		question_count: 15,
		time_limit_seconds: 3600,
	});
	expect(ai.authoring_mode).toBe("ai");
	expect(ai.subject_id).toBe("11111111-1111-1111-1111-111111111111");

	const manual = assignmentConfigBaseSchema.parse({
		v: 1,
		kind: "practice_test",
		authoring_mode: "manual",
		subject_id: "11111111-1111-1111-1111-111111111111",
		topic_ids: ["22222222-2222-2222-2222-222222222222"],
		difficulty: "easy",
		question_count: 7,
		time_limit_seconds: 1800,
	});
	expect(manual.authoring_mode).toBe("manual");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/assignments/schemas.test.ts`
Expected: FAIL — `assignmentConfigBaseSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `src/lib/assignments/schemas.ts`, after the `assignmentConfigSchema` definition (around line 62), add:

```ts
/**
 * Lenient parser used by read paths that only need `subject_id` + `authoring_mode`.
 * Tolerates BOTH the strict AI config and the manual config (and any future shape)
 * via `.passthrough()`, so manual assignments are never dropped from lists.
 * Existing rows without `authoring_mode` are treated as AI.
 */
export const assignmentConfigBaseSchema = z
	.object({
		subject_id: z.string().uuid(),
		authoring_mode: z.enum(["ai", "manual"]).default("ai"),
	})
	.passthrough();

export type AssignmentConfigBase = z.infer<typeof assignmentConfigBaseSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/assignments/schemas.test.ts`
Expected: PASS (all cases, including the existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignments/schemas.ts src/lib/assignments/schemas.test.ts
git commit -m "feat(assignments): add lenient assignmentConfigBaseSchema"
```

---

### Task 4: Manual Zod schemas (config, answer keys, questions, inputs)

**Files:**
- Create: `src/lib/assignments/manual-schemas.ts`
- Test: `src/lib/assignments/manual-schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/assignments/manual-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { manualQuestionInputSchema, createManualAssignmentInputSchema } from "@/lib/assignments/manual-schemas";

const TOPIC = "22222222-2222-2222-2222-222222222222";

describe("manualQuestionInputSchema", () => {
	it("accepts an MCQ whose correct answer is a present option", () => {
		const parsed = manualQuestionInputSchema.parse({
			question_type: "multiple_choice",
			topic_id: TOPIC,
			question_text: "2 + 2 = ?",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "B" },
		});
		expect(parsed.answer_key.correct_answer).toBe("B");
	});

	it("rejects an MCQ whose correct answer is not among the options", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "multiple_choice",
			topic_id: TOPIC,
			question_text: "2 + 2 = ?",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "C" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects a numerical question whose answer is not numeric", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "numerical",
			topic_id: TOPIC,
			question_text: "Speed?",
			answer_key: { correct_answer: "fast" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects an open-ended question with no marking points or model answer", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "short_answer",
			topic_id: TOPIC,
			question_text: "Explain inertia.",
			answer_key: {},
		});
		expect(result.success).toBe(false);
	});

	it("accepts a long answer with marking points", () => {
		const parsed = manualQuestionInputSchema.parse({
			question_type: "long_answer",
			topic_id: TOPIC,
			question_text: "Discuss the causes of WW1.",
			answer_key: { marking_points: ["Alliances", "Militarism", "Assassination"] },
		});
		expect(parsed.answer_key.marking_points?.length).toBe(3);
	});
});

describe("createManualAssignmentInputSchema", () => {
	const base = {
		title: "Unit 1 quiz",
		instructions: null,
		subject_id: "11111111-1111-1111-1111-111111111111",
		difficulty: "medium",
		time_limit_seconds: 1800,
		student_ids: ["33333333-3333-3333-3333-333333333333"],
		due_at: null,
		questions: [
			{
				question_type: "multiple_choice",
				topic_id: TOPIC,
				question_text: "2 + 2 = ?",
				options: { A: "3", B: "4" },
				answer_key: { correct_answer: "B" },
			},
		],
	};

	it("accepts a valid manual assignment", () => {
		const parsed = createManualAssignmentInputSchema.parse(base);
		expect(parsed.questions).toHaveLength(1);
		expect(parsed.time_limit_seconds).toBe(1800);
	});

	it("requires at least one question", () => {
		const result = createManualAssignmentInputSchema.safeParse({ ...base, questions: [] });
		expect(result.success).toBe(false);
	});

	it("rejects a time limit outside bounds", () => {
		const result = createManualAssignmentInputSchema.safeParse({ ...base, time_limit_seconds: 60 });
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/assignments/manual-schemas.test.ts`
Expected: FAIL — module `manual-schemas` not found.

- [ ] **Step 3: Write the schemas**

Create `src/lib/assignments/manual-schemas.ts`:

```ts
import { z } from "zod";

import { isAssignmentDueAtInPast } from "@/lib/assignments/assignment-due-at";
import { practiceDifficultySchema } from "@/lib/practice";

export const MANUAL_ASSIGNMENT_MAX_QUESTIONS = 50;
export const MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS = 300; // 5 min
export const MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS = 14400; // 4 h

const optionalTextToNull = z
	.string()
	.nullish()
	.transform((value) => {
		if (value == null) return null;
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	});

const optionLetters = ["A", "B", "C", "D", "E", "F"] as const;
export type ManualOptionLetter = (typeof optionLetters)[number];

const trimmedNonEmpty = z.string().trim().min(1);
const trimmedList = z.array(trimmedNonEmpty).optional();

/** MCQ options object keyed by letter. A and B required; C–F optional. */
const mcqOptionsSchema = z
	.object({
		A: trimmedNonEmpty,
		B: trimmedNonEmpty,
		C: trimmedNonEmpty.optional(),
		D: trimmedNonEmpty.optional(),
		E: trimmedNonEmpty.optional(),
		F: trimmedNonEmpty.optional(),
	})
	.strict();

const mcqAnswerKeySchema = z
	.object({
		correct_answer: z.enum(optionLetters),
		explanation: z.string().trim().optional(),
		distractor_rationale: z.record(z.enum(optionLetters), z.string()).optional(),
	})
	.strip();

const fillBlankAnswerKeySchema = z
	.object({
		correct_answer: trimmedNonEmpty,
		acceptable_variants: trimmedList,
		explanation: z.string().trim().optional(),
	})
	.strip();

const numericalAnswerKeySchema = z
	.object({
		correct_answer: trimmedNonEmpty.refine((v) => Number.isFinite(Number(v)), "Enter a numeric answer."),
		tolerance: z.number().nonnegative().optional(),
		units: z.string().trim().optional(),
		explanation: z.string().trim().optional(),
	})
	.strip();

const openEndedAnswerKeySchema = z
	.object({
		model_answer: z.string().trim().optional(),
		marking_points: trimmedList,
		full_credit_requires: trimmedList,
		acceptable_variants: trimmedList,
		expected_misanswers: z
			.array(z.object({ answer: trimmedNonEmpty, why: trimmedNonEmpty }))
			.optional(),
	})
	.strip()
	.refine(
		(k) =>
			(k.model_answer && k.model_answer.trim().length > 0) ||
			(k.marking_points && k.marking_points.length > 0) ||
			(k.full_credit_requires && k.full_credit_requires.length > 0),
		{ message: "Add a model answer or at least one marking point so the AI can grade this." },
	);

const baseQuestionFields = {
	topic_id: z.string().uuid({ message: "Pick a chapter & topic for this question." }),
	question_text: z.string().trim().min(1, "Write the question.").max(8000),
	difficulty_level: practiceDifficultySchema.default("medium"),
};

const mcqQuestionSchema = z
	.object({
		question_type: z.literal("multiple_choice"),
		...baseQuestionFields,
		options: mcqOptionsSchema,
		answer_key: mcqAnswerKeySchema,
	})
	.strict()
	.superRefine((q, ctx) => {
		if (!(q.answer_key.correct_answer in q.options)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["answer_key", "correct_answer"],
				message: "The correct answer must be one of the options you wrote.",
			});
		}
	});

const fillBlankQuestionSchema = z
	.object({ question_type: z.literal("fill_in_blank"), ...baseQuestionFields, answer_key: fillBlankAnswerKeySchema })
	.strict();

const numericalQuestionSchema = z
	.object({ question_type: z.literal("numerical"), ...baseQuestionFields, answer_key: numericalAnswerKeySchema })
	.strict();

const shortAnswerQuestionSchema = z
	.object({ question_type: z.literal("short_answer"), ...baseQuestionFields, answer_key: openEndedAnswerKeySchema })
	.strict();

const longAnswerQuestionSchema = z
	.object({ question_type: z.literal("long_answer"), ...baseQuestionFields, answer_key: openEndedAnswerKeySchema })
	.strict();

export const manualQuestionInputSchema = z.discriminatedUnion("question_type", [
	mcqQuestionSchema,
	fillBlankQuestionSchema,
	numericalQuestionSchema,
	shortAnswerQuestionSchema,
	longAnswerQuestionSchema,
]);

export type ManualQuestionInput = z.infer<typeof manualQuestionInputSchema>;

/** Stored config shape for a manual assignment (mirrors AI config keys + authoring_mode). */
export const manualAssignmentConfigSchema = z
	.object({
		v: z.literal(1),
		kind: z.literal("practice_test"),
		authoring_mode: z.literal("manual"),
		subject_id: z.string().uuid(),
		topic_ids: z.array(z.string().uuid()).min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		difficulty: practiceDifficultySchema.default("medium"),
		question_count: z.number().int().min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		time_limit_seconds: z
			.number()
			.int()
			.min(MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS)
			.max(MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS),
	})
	.strict();

export type ManualAssignmentConfig = z.infer<typeof manualAssignmentConfigSchema>;

const dueAtSchema = optionalTextToNull
	.refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid due date.")
	.refine((v) => v === null || !isAssignmentDueAtInPast(v), "Due date must be in the future.");

const manualHeaderFields = {
	title: z.string().trim().min(1, "Enter an assignment title.").max(300),
	instructions: optionalTextToNull,
	subject_id: z.string().uuid(),
	difficulty: practiceDifficultySchema.default("medium"),
	time_limit_seconds: z
		.number()
		.int()
		.min(MANUAL_ASSIGNMENT_MIN_TIME_LIMIT_SECONDS)
		.max(MANUAL_ASSIGNMENT_MAX_TIME_LIMIT_SECONDS),
	due_at: dueAtSchema,
};

/** Publish: everything required. */
export const createManualAssignmentInputSchema = z
	.object({
		...manualHeaderFields,
		questions: z.array(manualQuestionInputSchema).min(1, "Add at least one question.").max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		student_ids: z.array(z.string().uuid()).min(1, "Select at least one student."),
	})
	.strict();

export type CreateManualAssignmentInput = z.infer<typeof createManualAssignmentInputSchema>;

/** Draft: title required; questions/students may be empty work-in-progress. */
export const saveManualAssignmentDraftInputSchema = z
	.object({
		assignment_id: z.string().uuid().nullish(),
		...manualHeaderFields,
		questions: z.array(manualQuestionInputSchema).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
		student_ids: z.array(z.string().uuid()),
	})
	.strict();

export type SaveManualAssignmentDraftInput = z.infer<typeof saveManualAssignmentDraftInputSchema>;

/** Edit a published manual assignment: recipients are fixed in v1, so no student_ids. */
export const updateManualAssignmentInputSchema = z
	.object({
		assignment_id: z.string().uuid(),
		...manualHeaderFields,
		questions: z.array(manualQuestionInputSchema).min(1).max(MANUAL_ASSIGNMENT_MAX_QUESTIONS),
	})
	.strict();

export type UpdateManualAssignmentInput = z.infer<typeof updateManualAssignmentInputSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/assignments/manual-schemas.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignments/manual-schemas.ts src/lib/assignments/manual-schemas.test.ts
git commit -m "feat(assignments): manual assignment + per-type answer-key Zod schemas"
```

---

### Task 5: Pure helpers (derive config, draft→DB rows, impact counts)

**Files:**
- Create: `src/lib/assignments/manual-helpers.ts`
- Test: `src/lib/assignments/manual-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/assignments/manual-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { deriveManualConfig, summarizeNotStartedImpact } from "@/lib/assignments/manual-helpers";
import type { ManualQuestionInput } from "@/lib/assignments/manual-schemas";

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";

const questions: ManualQuestionInput[] = [
	{ question_type: "short_answer", topic_id: T1, question_text: "a", difficulty_level: "medium", answer_key: { marking_points: ["x"] } },
	{ question_type: "short_answer", topic_id: T2, question_text: "b", difficulty_level: "medium", answer_key: { marking_points: ["y"] } },
	{ question_type: "short_answer", topic_id: T1, question_text: "c", difficulty_level: "medium", answer_key: { marking_points: ["z"] } },
];

describe("deriveManualConfig", () => {
	it("derives distinct topic_ids and question_count from authored questions", () => {
		const config = deriveManualConfig({
			subjectId: "55555555-5555-5555-5555-555555555555",
			difficulty: "easy",
			timeLimitSeconds: 1800,
			questions,
		});
		expect(config.authoring_mode).toBe("manual");
		expect(config.question_count).toBe(3);
		expect([...config.topic_ids].sort()).toEqual([T1, T2].sort());
		expect(config.time_limit_seconds).toBe(1800);
	});
});

describe("summarizeNotStartedImpact", () => {
	it("counts not-started vs frozen submissions", () => {
		const out = summarizeNotStartedImpact({
			pending_materialize: 1,
			ready: 2,
			failed_generation: 1,
			in_progress: 3,
			submitted: 1,
			grading: 0,
			graded: 4,
			late: 0,
			excused: 0,
		});
		expect(out.appliedToNotStarted).toBe(4); // 1 + 2 + 1
		expect(out.skippedAlreadyStarted).toBe(8); // 3 + 1 + 0 + 4 + 0 + 0
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/assignments/manual-helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

Create `src/lib/assignments/manual-helpers.ts`:

```ts
import type { PracticeDifficulty } from "@/lib/practice";

import { manualAssignmentConfigSchema, type ManualAssignmentConfig, type ManualQuestionInput } from "./manual-schemas";

/** Build the stored manual config from authored questions (derives topic_ids + count). */
export function deriveManualConfig(input: {
	subjectId: string;
	difficulty: PracticeDifficulty;
	timeLimitSeconds: number;
	questions: ManualQuestionInput[];
}): ManualAssignmentConfig {
	const topicIds = [...new Set(input.questions.map((q) => q.topic_id))];
	return manualAssignmentConfigSchema.parse({
		v: 1,
		kind: "practice_test",
		authoring_mode: "manual",
		subject_id: input.subjectId,
		topic_ids: topicIds,
		difficulty: input.difficulty,
		question_count: input.questions.length,
		time_limit_seconds: input.timeLimitSeconds,
	});
}

/** Row shape for inserting authored questions into assignment_questions. */
export type ManualQuestionDbRow = {
	questionNumber: number;
	topicId: string;
	questionType: ManualQuestionInput["question_type"];
	questionText: string;
	options: unknown | null;
	answerKey: unknown;
	difficultyLevel: string;
};

/** Map validated questions to DB rows (1-based numbering, MCQ-only options). */
export function manualQuestionsToDbRows(questions: ManualQuestionInput[]): ManualQuestionDbRow[] {
	return questions.map((q, index) => ({
		questionNumber: index + 1,
		topicId: q.topic_id,
		questionType: q.question_type,
		questionText: q.question_text,
		options: q.question_type === "multiple_choice" ? q.options : null,
		answerKey: q.answer_key,
		difficultyLevel: q.difficulty_level,
	}));
}

export const NOT_STARTED_LIFECYCLES = ["pending_materialize", "ready", "failed_generation"] as const;

/** Given per-lifecycle counts, split into not-started (editable) vs frozen. */
export function summarizeNotStartedImpact(counts: Record<string, number>): {
	appliedToNotStarted: number;
	skippedAlreadyStarted: number;
} {
	let applied = 0;
	let skipped = 0;
	for (const [status, n] of Object.entries(counts)) {
		if ((NOT_STARTED_LIFECYCLES as readonly string[]).includes(status)) applied += n;
		else skipped += n;
	}
	return { appliedToNotStarted: applied, skippedAlreadyStarted: skipped };
}
```

> If `PracticeDifficulty` is not exported from `@/lib/practice`, use `z.infer<typeof practiceDifficultySchema>` via `import type { ManualAssignmentConfig }` and type `difficulty` as `"easy" | "medium" | "hard"` instead. Verify the export with `grep -n "PracticeDifficulty" src/lib/practice/index.ts` before writing; adjust the import accordingly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/assignments/manual-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignments/manual-helpers.ts src/lib/assignments/manual-helpers.test.ts
git commit -m "feat(assignments): pure helpers for manual config + edit impact"
```

---

### Task 6: Keep manual assignments in lists (lenient parse + `authoringMode`)

**Files:**
- Modify: `src/lib/assignments/queries.ts`

This stops manual assignments from being dropped by the strict `assignmentConfigSchema.safeParse(...) → return []` guards, and surfaces `authoringMode` for the UI badge.

- [ ] **Step 1: Update imports**

In `src/lib/assignments/queries.ts`, change the schema import (line ~19-23) to also import the base schema:

```ts
import {
	assignmentConfigBaseSchema,
	computeAssignmentJobRunAfter,
	type AssignmentConfigBase,
} from "./schemas";
```

(`assignmentConfigSchema` / `AssignmentConfig` are no longer needed here once the three call sites below are migrated — remove them from the import only if nothing else in the file references them; run `grep -n "assignmentConfigSchema\|AssignmentConfig" src/lib/assignments/queries.ts` to check.)

- [ ] **Step 2: Update `TeacherAssignmentSummaryRow` and `TeacherAssignmentSubmissionRow` types**

Replace `config: AssignmentConfig;` in `TeacherAssignmentSummaryRow` (line ~65) with:

```ts
	config: AssignmentConfigBase;
	authoringMode: "ai" | "manual";
```

Add to `TeacherAssignmentSubmissionRow` (after `subjectName`, line ~45):

```ts
	authoringMode: "ai" | "manual";
```

- [ ] **Step 3: Migrate the three parse sites to the base schema**

In `listTeacherAssignmentSummaries`, replace the `configs`/`subjectIds` lines (≈186-188) with:

```ts
	const configs = assignmentRows.map((row) => assignmentConfigBaseSchema.safeParse(row.config));
	const subjectIds = [...new Set(configs.flatMap((result) => (result.success ? [result.data.subject_id] : [])))];
```

and in the returned object (≈202-203) replace the `subjectName`/`config` lines with:

```ts
				subjectName: subjectNameById.get(config.data.subject_id) ?? null,
				config: config.data,
				authoringMode: config.data.authoring_mode,
```

In `listTeacherAssignmentSubmissionRows`, replace the parse (≈248-249) the same way, then add `authoringMode` to the returned object (≈261):

```ts
					subjectName,
					authoringMode: config.success ? config.data.authoring_mode : "ai",
```

In `listAssignmentCardsForStudentIds`, replace the parse (≈456-457) the same way. (Student cards don't need `authoringMode`; leaving `StudentAssignmentCard` unchanged is fine.)

- [ ] **Step 4: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors. If a consumer of `TeacherAssignmentSummaryRow.config` referenced an AI-only field, narrow it via `authoringMode` or read the now-optional field defensively.

- [ ] **Step 5: Run the assignments test suite**

Run: `pnpm test src/lib/assignments`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assignments/queries.ts
git commit -m "fix(assignments): parse config leniently so manual assignments stay in lists"
```

---

# Phase 3 — Server queries (DB orchestration)

> The codebase does not unit-test Drizzle `db` functions (no test DB in Vitest). These tasks are verified by typecheck + the Phase 6 integration checks. Pure logic lives in Task 5 helpers (already unit-tested).

### Task 7: Manual assignment queries (create / draft / load / edit)

**Files:**
- Create: `src/lib/assignments/manual-queries.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/assignments/manual-queries.ts`:

```ts
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { practiceJobs } from "@/db/schema/practice-tables";
import { tests } from "@/db/schema/assessment";
import { assignmentQuestions, assignmentSubmissions, assignments } from "@/db/schema/teaching";

import { deriveManualConfig, manualQuestionsToDbRows, summarizeNotStartedImpact } from "./manual-helpers";
import type { ManualQuestionInput } from "./manual-schemas";
import type { PracticeDifficulty } from "@/lib/practice";

const NOT_STARTED = ["pending_materialize", "ready", "failed_generation"] as const;

type ManualHeader = {
	teacherId: string;
	organizationId: string | null;
	title: string;
	instructions: string | null;
	subjectId: string;
	difficulty: PracticeDifficulty;
	timeLimitSeconds: number;
	dueAt: string | null;
	questions: ManualQuestionInput[];
};

/** Insert (or replace) the authored question rows for an assignment inside a tx. */
async function replaceAssignmentQuestions(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	assignmentId: string,
	questions: ManualQuestionInput[],
): Promise<void> {
	await tx.delete(assignmentQuestions).where(eq(assignmentQuestions.assignmentId, assignmentId));
	if (questions.length === 0) return;
	const now = new Date();
	await tx.insert(assignmentQuestions).values(
		manualQuestionsToDbRows(questions).map((row) => ({
			assignmentId,
			questionNumber: row.questionNumber,
			topicId: row.topicId,
			questionType: row.questionType,
			questionText: row.questionText,
			options: row.options as never,
			answerKey: row.answerKey as never,
			difficultyLevel: row.difficultyLevel,
			createdAt: now,
			updatedAt: now,
		})),
	);
}

/** Create a DRAFT manual assignment (or update an existing draft) and return its id. */
export async function saveManualAssignmentDraft(
	input: ManualHeader & { assignmentId: string | null; studentIds: string[] },
): Promise<{ assignmentId: string }> {
	const now = new Date();
	const config =
		input.questions.length > 0
			? deriveManualConfig({
					subjectId: input.subjectId,
					difficulty: input.difficulty,
					timeLimitSeconds: input.timeLimitSeconds,
					questions: input.questions,
				})
			: {
					v: 1 as const,
					kind: "practice_test" as const,
					authoring_mode: "manual" as const,
					subject_id: input.subjectId,
					topic_ids: [] as string[],
					difficulty: input.difficulty,
					question_count: 0,
					time_limit_seconds: input.timeLimitSeconds,
				};

	return db.transaction(async (tx) => {
		let assignmentId = input.assignmentId;
		if (assignmentId) {
			const [owned] = await tx
				.update(assignments)
				.set({
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					updatedAt: now,
				})
				.where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, input.teacherId), eq(assignments.status, "draft")))
				.returning({ id: assignments.id });
			if (!owned) throw new Error("Draft not found or not editable.");
		} else {
			const [created] = await tx
				.insert(assignments)
				.values({
					teacherId: input.teacherId,
					organizationId: input.organizationId,
					assignmentKind: "practice_test",
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "draft",
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: assignments.id });
			if (!created) throw new Error("Could not create draft.");
			assignmentId = created.id;
		}
		await replaceAssignmentQuestions(tx, assignmentId, input.questions);
		return { assignmentId };
	});
}

/** Publish a manual assignment: persist questions + fan out submissions/jobs. */
export async function createPublishedManualAssignment(
	input: ManualHeader & { studentIds: string[]; fromDraftId: string | null },
): Promise<{ assignmentId: string; submissionIds: string[] }> {
	const now = new Date();
	const config = deriveManualConfig({
		subjectId: input.subjectId,
		difficulty: input.difficulty,
		timeLimitSeconds: input.timeLimitSeconds,
		questions: input.questions,
	});

	return db.transaction(async (tx) => {
		let assignmentId = input.fromDraftId;
		if (assignmentId) {
			const [owned] = await tx
				.update(assignments)
				.set({
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "published",
					publishedAt: now,
					updatedAt: now,
				})
				.where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, input.teacherId), eq(assignments.status, "draft")))
				.returning({ id: assignments.id });
			if (!owned) throw new Error("Draft not found or not editable.");
		} else {
			const [created] = await tx
				.insert(assignments)
				.values({
					teacherId: input.teacherId,
					organizationId: input.organizationId,
					assignmentKind: "practice_test",
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "published",
					publishedAt: now,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: assignments.id });
			if (!created) throw new Error("Could not create assignment.");
			assignmentId = created.id;
		}

		await replaceAssignmentQuestions(tx, assignmentId, input.questions);

		const submissionRows = await tx
			.insert(assignmentSubmissions)
			.values(
				input.studentIds.map((studentId) => ({
					assignmentId: assignmentId!,
					studentId,
					lifecycleStatus: "pending_materialize",
					createdAt: now,
					updatedAt: now,
				})),
			)
			.returning({ id: assignmentSubmissions.id });

		await tx.insert(practiceJobs).values(
			submissionRows.map((submission, index) => ({
				jobType: "assign_generate_test",
				testId: null,
				studentId: input.studentIds[index],
				assignmentSubmissionId: submission.id,
				payload: { assignment_submission_id: submission.id },
				runAfter: now, // no LLM → no staggering
				createdAt: now,
				updatedAt: now,
			})),
		);

		return { assignmentId, submissionIds: submissionRows.map((r) => r.id) };
	});
}

export type ManualAssignmentForEdit = {
	assignmentId: string;
	title: string;
	instructions: string | null;
	subjectId: string;
	difficulty: string;
	timeLimitSeconds: number;
	dueAt: string | null;
	status: string;
	questions: Array<{
		topicId: string;
		questionType: string;
		questionText: string;
		options: unknown | null;
		answerKey: unknown;
		difficultyLevel: string;
	}>;
};

/** Load a manual assignment (draft or published) the teacher owns, for the editor. */
export async function getManualAssignmentForEdit(
	teacherId: string,
	assignmentId: string,
): Promise<ManualAssignmentForEdit | null> {
	const [row] = await db
		.select()
		.from(assignments)
		.where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)))
		.limit(1);
	if (!row) return null;
	const config = (row.config ?? {}) as Record<string, unknown>;
	if (config.authoring_mode !== "manual") return null;

	const questions = await db
		.select()
		.from(assignmentQuestions)
		.where(eq(assignmentQuestions.assignmentId, assignmentId))
		.orderBy(assignmentQuestions.questionNumber);

	return {
		assignmentId: row.id,
		title: row.title,
		instructions: row.instructions,
		subjectId: String(config.subject_id ?? ""),
		difficulty: String(config.difficulty ?? "medium"),
		timeLimitSeconds: Number(config.time_limit_seconds ?? 3600),
		dueAt: row.dueAt ? row.dueAt.toISOString() : null,
		status: row.status,
		questions: questions.map((q) => ({
			topicId: q.topicId,
			questionType: q.questionType,
			questionText: q.questionText,
			options: q.options,
			answerKey: q.answerKey,
			difficultyLevel: q.difficultyLevel,
		})),
	};
}

/**
 * Edit a PUBLISHED manual assignment. Replaces the template and re-materializes
 * ONLY not-yet-started submissions (§9.2). Started/graded submissions are frozen.
 */
export async function updatePublishedManualAssignment(
	input: ManualHeader & { assignmentId: string },
): Promise<{ appliedToNotStarted: number; skippedAlreadyStarted: number; resetSubmissionIds: string[] }> {
	const now = new Date();
	const config = deriveManualConfig({
		subjectId: input.subjectId,
		difficulty: input.difficulty,
		timeLimitSeconds: input.timeLimitSeconds,
		questions: input.questions,
	});

	return db.transaction(async (tx) => {
		const [owned] = await tx
			.update(assignments)
			.set({
				title: input.title,
				instructions: input.instructions,
				config,
				dueAt: input.dueAt ? new Date(input.dueAt) : null,
				updatedAt: now,
			})
			.where(
				and(
					eq(assignments.id, input.assignmentId),
					eq(assignments.teacherId, input.teacherId),
					eq(assignments.status, "published"),
				),
			)
			.returning({ id: assignments.id });
		if (!owned) throw new Error("Published assignment not found or not owned.");

		await replaceAssignmentQuestions(tx, input.assignmentId, input.questions);

		// Per-lifecycle counts (for the affected/frozen banner).
		const countRows = await tx
			.select({
				lifecycleStatus: assignmentSubmissions.lifecycleStatus,
				n: sql<number>`count(*)::int`,
			})
			.from(assignmentSubmissions)
			.where(eq(assignmentSubmissions.assignmentId, input.assignmentId))
			.groupBy(assignmentSubmissions.lifecycleStatus);
		const counts: Record<string, number> = {};
		for (const r of countRows) counts[r.lifecycleStatus] = Number(r.n);
		const impact = summarizeNotStartedImpact(counts);

		// Atomically capture + reset not-started submissions. A student who started
		// mid-edit is in 'in_progress' and excluded by this WHERE clause (race-safe).
		const resetRows = await tx
			.update(assignmentSubmissions)
			.set({ lifecycleStatus: "pending_materialize", testId: null, error: null, updatedAt: now })
			.where(
				and(
					eq(assignmentSubmissions.assignmentId, input.assignmentId),
					inArray(assignmentSubmissions.lifecycleStatus, [...NOT_STARTED]),
				),
			)
			.returning({ id: assignmentSubmissions.id, testId: assignmentSubmissions.testId });

		const staleTestIds = resetRows.map((r) => r.testId).filter((id): id is string => Boolean(id));
		if (staleTestIds.length > 0) {
			// Cascades the copied questions; no student_answers exist for not-started tests.
			await tx.delete(tests).where(inArray(tests.id, staleTestIds));
		}

		const resetIds = resetRows.map((r) => r.id);
		if (resetIds.length > 0) {
			// Clear any active generate jobs to free the partial unique index, then re-enqueue.
			await tx
				.delete(practiceJobs)
				.where(
					and(
						inArray(practiceJobs.assignmentSubmissionId, resetIds),
						eq(practiceJobs.jobType, "assign_generate_test"),
						inArray(practiceJobs.status, ["pending", "running"]),
					),
				);
			await tx.insert(practiceJobs).values(
				resetIds.map((submissionId, index) => ({
					jobType: "assign_generate_test",
					testId: null,
					studentId: undefined as unknown as string, // set below
					assignmentSubmissionId: submissionId,
					payload: { assignment_submission_id: submissionId },
					runAfter: now,
					createdAt: now,
					updatedAt: now,
					_index: index,
				})),
			);
		}

		return { ...impact, resetSubmissionIds: resetIds };
	});
}
```

> **Important fix-up:** `practice_jobs.student_id` is `NOT NULL`. In the re-enqueue insert above, replace the placeholder with the real student id by joining: instead of `student_id: undefined…`, first fetch `{ id, studentId }` for the reset submissions (`tx.select({ id: assignmentSubmissions.id, studentId: assignmentSubmissions.studentId }).from(...).where(inArray(assignmentSubmissions.id, resetIds))`), build a `Map`, and set `studentId: studentById.get(submissionId)!`. Remove the `_index` field (not a column). Write it that way — do not ship the placeholder.

- [ ] **Step 2: Apply the student-id fix-up**

Edit the re-enqueue block in `updatePublishedManualAssignment` to:

```ts
		if (resetIds.length > 0) {
			const studentRows = await tx
				.select({ id: assignmentSubmissions.id, studentId: assignmentSubmissions.studentId })
				.from(assignmentSubmissions)
				.where(inArray(assignmentSubmissions.id, resetIds));
			const studentById = new Map(studentRows.map((r) => [r.id, r.studentId]));
			await tx
				.delete(practiceJobs)
				.where(
					and(
						inArray(practiceJobs.assignmentSubmissionId, resetIds),
						eq(practiceJobs.jobType, "assign_generate_test"),
						inArray(practiceJobs.status, ["pending", "running"]),
					),
				);
			await tx.insert(practiceJobs).values(
				resetIds.map((submissionId) => ({
					jobType: "assign_generate_test",
					testId: null,
					studentId: studentById.get(submissionId)!,
					assignmentSubmissionId: submissionId,
					payload: { assignment_submission_id: submissionId },
					runAfter: now,
					createdAt: now,
					updatedAt: now,
				})),
			);
		}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors. (If `PracticeDifficulty` isn't exported from `@/lib/practice`, type `difficulty` as `"easy" | "medium" | "hard"` here too.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/assignments/manual-queries.ts
git commit -m "feat(assignments): manual assignment create/draft/load/edit queries"
```

---

# Phase 4 — Materialization fork

### Task 8: Manual materialization (branch in `materializeAssignedPracticeTest`)

**Files:**
- Modify: `src/lib/admin/assignment-generation.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/admin/assignment-generation.ts`, add:

```ts
import { assignmentQuestions } from "@/db/schema/teaching";
import { assignmentConfigBaseSchema } from "@/lib/assignments/schemas";
```

- [ ] **Step 2: Branch at the start of `materializeAssignedPracticeTest`**

Immediately after the `if (row.assignmentStatus !== "published")` guard (line ~54-56) and **before** the strict `assignmentConfigSchema.safeParse(row.config)` block, insert:

```ts
	const baseConfig = assignmentConfigBaseSchema.safeParse(row.config);
	if (baseConfig.success && baseConfig.data.authoring_mode === "manual") {
		return materializeManualAssignedTest({
			submissionId: row.submissionId,
			studentId: row.studentId,
			assignmentId: row.assignmentId,
			assignmentTitle: row.assignmentTitle,
			subjectId: baseConfig.data.subject_id,
		});
	}
```

- [ ] **Step 3: Add the `materializeManualAssignedTest` function**

Append to `src/lib/admin/assignment-generation.ts`:

```ts
async function materializeManualAssignedTest(args: {
	submissionId: string;
	studentId: string;
	assignmentId: string;
	assignmentTitle: string;
	subjectId: string;
}): Promise<AssignmentGenerationResult> {
	// Distinct topics across authored questions → ensure tracker rows exist first
	// (mirrors the AI path so the post-grading tracker update has rows to update).
	const topicRows = await db
		.selectDistinct({ topicId: assignmentQuestions.topicId })
		.from(assignmentQuestions)
		.where(eq(assignmentQuestions.assignmentId, args.assignmentId));
	const topicIds = topicRows.map((r) => r.topicId);
	if (topicIds.length === 0) {
		const message = "Manual assignment has no questions.";
		await markSubmissionGenerationFailed(args.submissionId, message);
		return { ok: false, message };
	}
	await ensurePerformanceTrackerRowsForAssignmentTopics(args.studentId, args.subjectId, topicIds);

	const admin = createServiceRoleClient();
	const rpc = await admin.rpc("practice_create_manual_assigned_test", {
		p_assignment_submission_id: args.submissionId,
	});
	if (rpc.error) {
		logSupabaseError("materializeManualAssignedTest.practice_create_manual_assigned_test", rpc.error, {
			assignmentSubmissionId: args.submissionId,
		});
		await markSubmissionGenerationFailed(args.submissionId, rpc.error.message ?? "Manual materialization failed.");
		return { ok: false, message: rpc.error.message ?? "Manual materialization failed." };
	}
	const testId = (rpc.data as string | null) ?? null;
	if (!testId) {
		const message = "Manual materialization returned no test id.";
		await markSubmissionGenerationFailed(args.submissionId, message);
		return { ok: false, message };
	}

	await notifyAssignmentMaterialized({
		assignmentId: args.assignmentId,
		submissionId: args.submissionId,
		studentId: args.studentId,
		title: args.assignmentTitle,
	});

	return { ok: true, testId };
}
```

> `db`, `eq`, `assignmentQuestions`, `ensurePerformanceTrackerRowsForAssignmentTopics`, `notifyAssignmentMaterialized`, `createServiceRoleClient`, `logSupabaseError`, and `markSubmissionGenerationFailed` are all already imported or defined in this file (verify `eq` is in the `drizzle-orm` import — it is). The `supabase` typings may flag the new RPC name; if so, cast: `admin.rpc("practice_create_manual_assigned_test" as never, { p_assignment_submission_id: args.submissionId } as never)` and regenerate types with `pnpm db:gen-types` after the migration is applied.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/assignment-generation.ts
git commit -m "feat(assignments): no-LLM manual materialization fork"
```

---

# Phase 5 — Server actions

### Task 9: Manual assignment server actions

**Files:**
- Create: `app/teacher/(protected)/assignments/manual-actions.ts`

- [ ] **Step 1: Write the actions**

Create `app/teacher/(protected)/assignments/manual-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import {
	createPublishedManualAssignment,
	saveManualAssignmentDraft,
	updatePublishedManualAssignment,
} from "@/lib/assignments/manual-queries";
import { validatePracticeAssignmentConfigForStudents } from "@/lib/assignments/queries";
import { deriveManualConfig } from "@/lib/assignments/manual-helpers";
import {
	createManualAssignmentInputSchema,
	saveManualAssignmentDraftInputSchema,
	updateManualAssignmentInputSchema,
} from "@/lib/assignments/manual-schemas";
import { notifyAssignmentPublished } from "@/lib/notifications/assignment-events";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { logServerError } from "@/lib/server/log-supabase-error";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { teacherFilterAccessibleStudentIdsForSession } from "@/lib/teachers/teacher-student-access";

export type ManualAssignmentActionState = {
	ok: boolean;
	message: string;
	assignmentId?: string;
	title?: string;
	studentCount?: number;
	appliedToNotStarted?: number;
	skippedAlreadyStarted?: number;
};

export async function saveManualAssignmentDraftAction(
	input: unknown,
): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("saveManualAssignmentDraftAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = saveManualAssignmentDraftInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the draft." };
		}
		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const result = await saveManualAssignmentDraft({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			assignmentId: parsed.data.assignment_id ?? null,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
			studentIds: parsed.data.student_ids,
		});
		revalidatePath("/teacher/assignments");
		return { ok: true, message: "Draft saved.", assignmentId: result.assignmentId };
	});
}

export async function publishManualAssignmentAction(
	input: unknown,
	fromDraftId?: string,
): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("publishManualAssignmentAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { profile, user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = createManualAssignmentInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the assignment." };
		}

		const uniqueStudentIds = [...new Set(parsed.data.student_ids)];
		const accessible = await teacherFilterAccessibleStudentIdsForSession(user.id, uniqueStudentIds);
		if (uniqueStudentIds.some((id) => !accessible.has(id))) {
			return { ok: false, message: "One or more selected students are no longer in your roster." };
		}

		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const config = deriveManualConfig({
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			questions: parsed.data.questions,
		});
		const scope = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: organization?.id ?? null,
			teacherRosterGrade: profile.teacher_roster_grade,
			teacherRosterSubjectId: profile.teacher_roster_subject_id,
			config,
			studentIds: uniqueStudentIds,
		});
		if (!scope.ok) return { ok: false, message: scope.message };

		const result = await createPublishedManualAssignment({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			fromDraftId: fromDraftId ?? null,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
			studentIds: uniqueStudentIds,
		});

		await notifyAssignmentPublished({
			teacherId: user.id,
			assignmentId: result.assignmentId,
			title: parsed.data.title,
			studentIds: uniqueStudentIds,
		});
		void triggerPracticeWorkerInBackground().catch((error) => {
			logServerError("publishManualAssignmentAction.triggerWorker", error, { assignmentId: result.assignmentId });
		});

		revalidatePath("/teacher/assignments");
		revalidatePath("/teacher/submissions");
		return {
			ok: true,
			message: `Assignment published for ${uniqueStudentIds.length} student${uniqueStudentIds.length === 1 ? "" : "s"}.`,
			assignmentId: result.assignmentId,
			title: parsed.data.title,
			studentCount: uniqueStudentIds.length,
		};
	});
}

export async function updatePublishedManualAssignmentAction(
	input: unknown,
): Promise<ManualAssignmentActionState> {
	return withTeacherActionTelemetry("updatePublishedManualAssignmentAction", async (breadcrumb) => {
		const session = await getVerifiedTeacherSession();
		if (!session.ok) return { ok: false, message: session.message };
		const { user } = session;
		const rate = await consumeTeacherPortalDataActionRateLimit(user.id);
		if (!rate.ok) return { ok: false, message: rate.message };

		const parsed = updateManualAssignmentInputSchema.safeParse(input);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your edits." };
		}

		const organization = await getActiveTeacherOrganizationSnapshot(user.id);
		const result = await updatePublishedManualAssignment({
			teacherId: user.id,
			organizationId: organization?.id ?? null,
			assignmentId: parsed.data.assignment_id,
			title: parsed.data.title,
			instructions: parsed.data.instructions,
			subjectId: parsed.data.subject_id,
			difficulty: parsed.data.difficulty,
			timeLimitSeconds: parsed.data.time_limit_seconds,
			dueAt: parsed.data.due_at,
			questions: parsed.data.questions,
		});
		void triggerPracticeWorkerInBackground().catch((error) => {
			logServerError("updatePublishedManualAssignmentAction.triggerWorker", error, {
				assignmentId: parsed.data.assignment_id,
			});
		});

		revalidatePath("/teacher/assignments");
		revalidatePath("/teacher/submissions");
		return {
			ok: true,
			message: `Updated. ${result.appliedToNotStarted} not-yet-started student(s) will get the new questions; ${result.skippedAlreadyStarted} already started and were not changed.`,
			assignmentId: parsed.data.assignment_id,
			appliedToNotStarted: result.appliedToNotStarted,
			skippedAlreadyStarted: result.skippedAlreadyStarted,
		};
	});
}
```

> Verify the session object's field names by reading [require-verified-teacher.ts](src/lib/auth/require-verified-teacher.ts) — match `profile.teacher_roster_grade` / `profile.teacher_roster_subject_id` exactly as the AI action ([actions.ts:86-87](app/teacher/(protected)/assignments/actions.ts)) uses them.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/teacher/(protected)/assignments/manual-actions.ts"
git commit -m "feat(assignments): manual draft/publish/edit server actions"
```

---

# Phase 6 — UI

### Task 10: Chapter-grouped topic picker

**Files:**
- Create: `src/components/teacher/manual/manual-topic-picker.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/teacher/manual/manual-topic-picker.tsx`:

```tsx
"use client";

import * as React from "react";

import { NativeSelect } from "@/components/ui/native-select";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import { cn } from "@/lib/utils";

type Props = {
	topics: AssignmentTopicCatalogRow[];
	value: string;
	onChange: (topicId: string) => void;
	className?: string;
	"aria-label"?: string;
};

type ChapterGroup = { key: string; label: string; topics: AssignmentTopicCatalogRow[] };

/** Group topics by (unit, chapter) and sort, mirroring TeacherAssignmentTopicMatrix bucketing. */
function groupByChapter(rows: AssignmentTopicCatalogRow[]): ChapterGroup[] {
	const byKey = new Map<string, ChapterGroup>();
	for (const row of rows) {
		const key = `${row.unitNumber}:${row.chapterNumber}`;
		let group = byKey.get(key);
		if (!group) {
			group = { key, label: `Ch ${row.chapterNumber}: ${row.chapterName}`, topics: [] };
			byKey.set(key, group);
		}
		group.topics.push(row);
	}
	const groups = [...byKey.values()];
	for (const g of groups) g.topics.sort((a, b) => a.topicNumber - b.topicNumber);
	groups.sort((a, b) => {
		const [au, ac] = a.key.split(":").map(Number);
		const [bu, bc] = b.key.split(":").map(Number);
		return au - bu || ac - bc;
	});
	return groups;
}

export function ManualTopicPicker({ topics, value, onChange, className, ...rest }: Props) {
	const groups = React.useMemo(() => groupByChapter(topics), [topics]);
	return (
		<NativeSelect
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={cn("rounded-lg border border-input", className)}
			aria-label={rest["aria-label"] ?? "Chapter and topic"}
		>
			<option value="">Select chapter & topic…</option>
			{groups.map((group) => (
				<optgroup key={group.key} label={group.label}>
					{group.topics.map((t) => (
						<option key={t.id} value={t.id}>
							{t.topicName}
						</option>
					))}
				</optgroup>
			))}
		</NativeSelect>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teacher/manual/manual-topic-picker.tsx
git commit -m "feat(assignments): chapter-grouped manual topic picker"
```

---

### Task 11: Per-type question editor

**Files:**
- Create: `src/components/teacher/manual/manual-question-editor.tsx`

This component owns the editor UI for one question and emits a draft object the builder collects. It mirrors the validated shapes from Task 4 so the builder can submit them directly.

- [ ] **Step 1: Write the component**

Create `src/components/teacher/manual/manual-question-editor.tsx`:

```tsx
"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { ManualTopicPicker } from "@/components/teacher/manual/manual-topic-picker";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import { cn } from "@/lib/utils";

export type ManualQuestionType =
	| "multiple_choice"
	| "fill_in_blank"
	| "numerical"
	| "short_answer"
	| "long_answer";

/** Loose client-side draft; the builder maps it to the server payload on submit. */
export type ManualQuestionDraft = {
	id: string; // client id for list keys
	questionType: ManualQuestionType;
	topicId: string;
	questionText: string;
	difficultyLevel: "easy" | "medium" | "hard";
	// MCQ
	options: string[]; // index 0 = A, 1 = B, ...
	correctIndex: number;
	// short text answers
	correctAnswer: string;
	acceptableVariants: string; // newline-separated
	// numerical
	tolerance: string;
	units: string;
	// open-ended
	modelAnswer: string;
	markingPoints: string; // newline-separated
};

export function emptyManualQuestionDraft(id: string): ManualQuestionDraft {
	return {
		id,
		questionType: "multiple_choice",
		topicId: "",
		questionText: "",
		difficultyLevel: "medium",
		options: ["", ""],
		correctIndex: 0,
		correctAnswer: "",
		acceptableVariants: "",
		tolerance: "",
		units: "",
		modelAnswer: "",
		markingPoints: "",
	};
}

const TYPE_LABELS: Record<ManualQuestionType, string> = {
	multiple_choice: "Multiple choice",
	fill_in_blank: "Fill in the blank",
	numerical: "Numerical",
	short_answer: "Short answer",
	long_answer: "Long answer",
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const inputClass =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

export function ManualQuestionEditor({
	index,
	draft,
	topics,
	onChange,
	onRemove,
}: {
	index: number;
	draft: ManualQuestionDraft;
	topics: AssignmentTopicCatalogRow[];
	onChange: (next: ManualQuestionDraft) => void;
	onRemove: () => void;
}) {
	const set = <K extends keyof ManualQuestionDraft>(key: K, val: ManualQuestionDraft[K]) =>
		onChange({ ...draft, [key]: val });

	const isOpenEnded = draft.questionType === "short_answer" || draft.questionType === "long_answer";

	return (
		<div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<span className="font-medium text-foreground text-sm">Question {index + 1}</span>
				<button
					type="button"
					onClick={onRemove}
					className="inline-flex items-center gap-1 text-destructive text-xs hover:underline"
				>
					<Trash2 className="size-3.5" /> Remove
				</button>
			</div>

			<div className="grid gap-3 medium:grid-cols-2">
				<label className="block space-y-1">
					<span className="text-foreground text-xs">Type</span>
					<NativeSelect
						value={draft.questionType}
						onChange={(e) => set("questionType", e.target.value as ManualQuestionType)}
						className="rounded-lg border border-input"
					>
						{(Object.keys(TYPE_LABELS) as ManualQuestionType[]).map((t) => (
							<option key={t} value={t}>
								{TYPE_LABELS[t]}
							</option>
						))}
					</NativeSelect>
				</label>
				<label className="block space-y-1">
					<span className="text-foreground text-xs">Chapter & topic</span>
					<ManualTopicPicker topics={topics} value={draft.topicId} onChange={(id) => set("topicId", id)} />
				</label>
			</div>

			<label className="block space-y-1">
				<span className="text-foreground text-xs">Question (use $…$ for math)</span>
				<textarea
					rows={2}
					value={draft.questionText}
					onChange={(e) => set("questionText", e.target.value)}
					className={cn(inputClass, "resize-y")}
					placeholder="Write the question stem"
				/>
			</label>

			{draft.questionType === "multiple_choice" ? (
				<div className="space-y-2">
					<span className="text-foreground text-xs">Options (select the correct one)</span>
					{draft.options.map((opt, i) => (
						<div key={i} className="flex items-center gap-2">
							<input
								type="radio"
								name={`correct-${draft.id}`}
								checked={draft.correctIndex === i}
								onChange={() => set("correctIndex", i)}
								className="size-4"
								aria-label={`Mark option ${LETTERS[i]} correct`}
							/>
							<span className="w-5 text-muted-foreground text-xs">{LETTERS[i]}</span>
							<input
								value={opt}
								onChange={(e) => {
									const next = [...draft.options];
									next[i] = e.target.value;
									set("options", next);
								}}
								className={inputClass}
								placeholder={`Option ${LETTERS[i]}`}
							/>
							{draft.options.length > 2 ? (
								<button
									type="button"
									onClick={() => {
										const next = draft.options.filter((_, j) => j !== i);
										onChange({
											...draft,
											options: next,
											correctIndex: Math.min(draft.correctIndex, next.length - 1),
										});
									}}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									✕
								</button>
							) : null}
						</div>
					))}
					{draft.options.length < 6 ? (
						<button
							type="button"
							onClick={() => set("options", [...draft.options, ""])}
							className="text-link text-xs hover:underline"
						>
							+ Add option
						</button>
					) : null}
				</div>
			) : null}

			{draft.questionType === "fill_in_blank" || draft.questionType === "numerical" ? (
				<div className="grid gap-3 medium:grid-cols-2">
					<label className="block space-y-1">
						<span className="text-foreground text-xs">Correct answer</span>
						<input
							value={draft.correctAnswer}
							onChange={(e) => set("correctAnswer", e.target.value)}
							className={inputClass}
							placeholder={draft.questionType === "numerical" ? "e.g. 9.8" : "e.g. photosynthesis"}
						/>
					</label>
					{draft.questionType === "numerical" ? (
						<div className="grid grid-cols-2 gap-2">
							<label className="block space-y-1">
								<span className="text-foreground text-xs">± Tolerance</span>
								<input
									value={draft.tolerance}
									onChange={(e) => set("tolerance", e.target.value)}
									className={inputClass}
									placeholder="0.1"
								/>
							</label>
							<label className="block space-y-1">
								<span className="text-foreground text-xs">Units</span>
								<input
									value={draft.units}
									onChange={(e) => set("units", e.target.value)}
									className={inputClass}
									placeholder="m/s²"
								/>
							</label>
						</div>
					) : (
						<label className="block space-y-1">
							<span className="text-foreground text-xs">Accepted variants (one per line)</span>
							<textarea
								rows={2}
								value={draft.acceptableVariants}
								onChange={(e) => set("acceptableVariants", e.target.value)}
								className={cn(inputClass, "resize-y")}
							/>
						</label>
					)}
				</div>
			) : null}

			{isOpenEnded ? (
				<div className="space-y-3">
					<label className="block space-y-1">
						<span className="text-foreground text-xs">Model answer (optional)</span>
						<textarea
							rows={2}
							value={draft.modelAnswer}
							onChange={(e) => set("modelAnswer", e.target.value)}
							className={cn(inputClass, "resize-y")}
						/>
					</label>
					<label className="block space-y-1">
						<span className="text-foreground text-xs">
							Marking points (one per line — improves AI grading)
						</span>
						<textarea
							rows={3}
							value={draft.markingPoints}
							onChange={(e) => set("markingPoints", e.target.value)}
							className={cn(inputClass, "resize-y")}
							placeholder={"States the definition\nGives a correct example"}
						/>
					</label>
				</div>
			) : null}

			<label className="block space-y-1">
				<span className="text-foreground text-xs">Difficulty</span>
				<NativeSelect
					value={draft.difficultyLevel}
					onChange={(e) => set("difficultyLevel", e.target.value as ManualQuestionDraft["difficultyLevel"])}
					className="max-w-40 rounded-lg border border-input"
				>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</NativeSelect>
			</label>
		</div>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/teacher/manual/manual-question-editor.tsx
git commit -m "feat(assignments): per-type manual question editor"
```

---

### Task 12: Draft→payload mapper (pure, tested)

**Files:**
- Modify: `src/lib/assignments/manual-helpers.ts`
- Modify: `src/lib/assignments/manual-helpers.test.ts`

Converts the loose `ManualQuestionDraft` (Task 11) into the strict `ManualQuestionInput` payload, so the builder submits clean data and we can unit-test the mapping.

- [ ] **Step 1: Add the failing test**

Append to `src/lib/assignments/manual-helpers.test.ts`:

```ts
import { manualDraftToQuestionInput } from "@/lib/assignments/manual-helpers";

describe("manualDraftToQuestionInput", () => {
	it("maps an MCQ draft to letter-keyed options and a letter answer", () => {
		const out = manualDraftToQuestionInput({
			id: "x",
			questionType: "multiple_choice",
			topicId: T1,
			questionText: "2+2?",
			difficultyLevel: "medium",
			options: ["3", "4", ""],
			correctIndex: 1,
			correctAnswer: "",
			acceptableVariants: "",
			tolerance: "",
			units: "",
			modelAnswer: "",
			markingPoints: "",
		});
		expect(out).toEqual({
			question_type: "multiple_choice",
			topic_id: T1,
			question_text: "2+2?",
			difficulty_level: "medium",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "B" },
		});
	});

	it("maps an open-ended draft's marking points from newlines", () => {
		const out = manualDraftToQuestionInput({
			id: "y",
			questionType: "short_answer",
			topicId: T1,
			questionText: "Define inertia.",
			difficultyLevel: "easy",
			options: [],
			correctIndex: 0,
			correctAnswer: "",
			acceptableVariants: "",
			tolerance: "",
			units: "",
			modelAnswer: "A body resists change in motion.",
			markingPoints: "Mentions resistance\nLinks to mass",
		});
		expect(out.answer_key).toMatchObject({
			model_answer: "A body resists change in motion.",
			marking_points: ["Mentions resistance", "Links to mass"],
		});
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/assignments/manual-helpers.test.ts`
Expected: FAIL — `manualDraftToQuestionInput` not exported.

- [ ] **Step 3: Implement the mapper**

Append to `src/lib/assignments/manual-helpers.ts` (add the import at top: `import type { ManualQuestionDraft, ManualQuestionType } from "@/components/teacher/manual/manual-question-editor";`):

```ts
const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function splitLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/**
 * Map a loose editor draft to the strict server payload. Returns a plain object;
 * the caller validates it with `manualQuestionInputSchema` (server side) so this
 * mapper stays pure and dependency-light.
 */
export function manualDraftToQuestionInput(draft: ManualQuestionDraft): ManualQuestionInput {
	const base = {
		topic_id: draft.topicId,
		question_text: draft.questionText.trim(),
		difficulty_level: draft.difficultyLevel,
	};

	switch (draft.questionType) {
		case "multiple_choice": {
			const options: Record<string, string> = {};
			draft.options.forEach((opt, i) => {
				const text = opt.trim();
				if (text) options[LETTERS[i]] = text;
			});
			return {
				...base,
				question_type: "multiple_choice",
				options: options as never,
				answer_key: { correct_answer: LETTERS[draft.correctIndex] as never },
			} as ManualQuestionInput;
		}
		case "fill_in_blank": {
			const variants = splitLines(draft.acceptableVariants);
			return {
				...base,
				question_type: "fill_in_blank",
				answer_key: {
					correct_answer: draft.correctAnswer.trim(),
					...(variants.length ? { acceptable_variants: variants } : {}),
				},
			} as ManualQuestionInput;
		}
		case "numerical": {
			const tolerance = draft.tolerance.trim() === "" ? undefined : Number(draft.tolerance);
			return {
				...base,
				question_type: "numerical",
				answer_key: {
					correct_answer: draft.correctAnswer.trim(),
					...(tolerance != null && Number.isFinite(tolerance) ? { tolerance } : {}),
					...(draft.units.trim() ? { units: draft.units.trim() } : {}),
				},
			} as ManualQuestionInput;
		}
		case "short_answer":
		case "long_answer": {
			const markingPoints = splitLines(draft.markingPoints);
			return {
				...base,
				question_type: draft.questionType,
				answer_key: {
					...(draft.modelAnswer.trim() ? { model_answer: draft.modelAnswer.trim() } : {}),
					...(markingPoints.length ? { marking_points: markingPoints } : {}),
				},
			} as ManualQuestionInput;
		}
		default: {
			const _exhaustive: never = draft.questionType;
			throw new Error(`Unsupported question type: ${String(_exhaustive)}`);
		}
	}
}

export type { ManualQuestionType };
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/assignments/manual-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignments/manual-helpers.ts src/lib/assignments/manual-helpers.test.ts
git commit -m "feat(assignments): editor-draft to validated-payload mapper"
```

---

### Task 13: The manual assignment builder (create + edit)

**Files:**
- Create: `src/components/teacher/manual/teacher-manual-assignment-builder.tsx`

- [ ] **Step 1: Write the builder**

Create `src/components/teacher/manual/teacher-manual-assignment-builder.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { AssignmentDueDatetimeField } from "@/components/teacher/assignment-due-datetime-field";
import {
	ManualQuestionEditor,
	emptyManualQuestionDraft,
	type ManualQuestionDraft,
} from "@/components/teacher/manual/manual-question-editor";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
	publishManualAssignmentAction,
	saveManualAssignmentDraftAction,
	updatePublishedManualAssignmentAction,
	type ManualAssignmentActionState,
} from "@/app/teacher/(protected)/assignments/manual-actions";
import { manualDraftToQuestionInput } from "@/lib/assignments/manual-helpers";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [
	{ value: 1800, label: "30 minutes" },
	{ value: 2700, label: "45 minutes" },
	{ value: 3600, label: "1 hour" },
	{ value: 5400, label: "1.5 hours" },
	{ value: 7200, label: "2 hours" },
	{ value: 10800, label: "3 hours" },
];

let draftSeq = 0;
const nextId = () => `q-${draftSeq++}`;

type EditTarget = {
	assignmentId: string;
	status: "draft" | "published";
	title: string;
	instructions: string | null;
	subjectId: string;
	timeLimitSeconds: number;
	difficulty: "easy" | "medium" | "hard";
	dueAt: string | null;
	drafts: ManualQuestionDraft[];
};

export function TeacherManualAssignmentBuilder({
	subjectsCatalog,
	topicsCatalog,
	students,
	editTarget,
}: {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	editTarget?: EditTarget;
}) {
	const router = useRouter();
	const isEditingPublished = editTarget?.status === "published";

	const [title, setTitle] = React.useState(editTarget?.title ?? "");
	const [instructions, setInstructions] = React.useState(editTarget?.instructions ?? "");
	const [subjectId, setSubjectId] = React.useState(editTarget?.subjectId ?? subjectsCatalog[0]?.id ?? "");
	const [timeLimit, setTimeLimit] = React.useState(editTarget?.timeLimitSeconds ?? 3600);
	const [difficulty, setDifficulty] = React.useState<"easy" | "medium" | "hard">(editTarget?.difficulty ?? "medium");
	const [dueAt, setDueAt] = React.useState(editTarget?.dueAt ?? "");
	const [questions, setQuestions] = React.useState<ManualQuestionDraft[]>(
		editTarget?.drafts.length ? editTarget.drafts : [emptyManualQuestionDraft(nextId())],
	);
	const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);
	const [pending, setPending] = React.useState(false);
	const [state, setState] = React.useState<ManualAssignmentActionState | null>(null);

	const topicsForSubject = React.useMemo(
		() => topicsCatalog.filter((t) => t.subjectId === subjectId),
		[topicsCatalog, subjectId],
	);
	const subjectGrade = React.useMemo(
		() => subjectsCatalog.find((s) => s.id === subjectId)?.grade ?? null,
		[subjectsCatalog, subjectId],
	);
	const studentsForSubject = React.useMemo(
		() => (subjectGrade == null ? students : students.filter((s) => s.grade === subjectGrade)),
		[students, subjectGrade],
	);

	function buildPayloadQuestions() {
		return questions.map(manualDraftToQuestionInput);
	}

	async function onSaveDraft() {
		setPending(true);
		setState(null);
		const res = await saveManualAssignmentDraftAction({
			assignment_id: editTarget?.assignmentId ?? null,
			title,
			instructions: instructions || null,
			subject_id: subjectId,
			difficulty,
			time_limit_seconds: timeLimit,
			due_at: dueAt || null,
			questions: buildPayloadQuestions(),
			student_ids: selectedStudentIds,
		});
		setState(res);
		setPending(false);
		if (res.ok) router.refresh();
	}

	async function onPublish() {
		setPending(true);
		setState(null);
		const res = isEditingPublished
			? await updatePublishedManualAssignmentAction({
					assignment_id: editTarget!.assignmentId,
					title,
					instructions: instructions || null,
					subject_id: subjectId,
					difficulty,
					time_limit_seconds: timeLimit,
					due_at: dueAt || null,
					questions: buildPayloadQuestions(),
				})
			: await publishManualAssignmentAction(
					{
						title,
						instructions: instructions || null,
						subject_id: subjectId,
						difficulty,
						time_limit_seconds: timeLimit,
						due_at: dueAt || null,
						questions: buildPayloadQuestions(),
						student_ids: selectedStudentIds,
					},
					editTarget?.assignmentId,
				);
		setState(res);
		setPending(false);
		if (res.ok) router.refresh();
	}

	const inputClass =
		"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

	return (
		<div className="space-y-8 rounded-2xl border border-border/70 bg-card p-5 medium:p-7">
			{isEditingPublished ? (
				<p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
					Editing a published assignment. Changes apply only to students who haven’t started yet; students who
					already started or finished keep their original test.
				</p>
			) : null}

			<section className="space-y-4">
				<label className="block space-y-1">
					<span className="font-medium text-foreground text-sm">Title</span>
					<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={inputClass} />
				</label>
				<label className="block space-y-1">
					<span className="font-medium text-foreground text-sm">Instructions (optional)</span>
					<textarea
						rows={3}
						value={instructions}
						onChange={(e) => setInstructions(e.target.value)}
						className={cn(inputClass, "resize-y")}
					/>
				</label>
				<div className="grid gap-4 medium:grid-cols-3">
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Subject</span>
						<NativeSelect
							value={subjectId}
							onChange={(e) => setSubjectId(e.target.value)}
							disabled={isEditingPublished}
							className="rounded-lg border border-input"
						>
							{subjectsCatalog.map((s) => (
								<option key={s.id} value={s.id}>
									Grade {s.grade} · {s.name}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Time limit</span>
						<NativeSelect
							value={timeLimit}
							onChange={(e) => setTimeLimit(Number(e.target.value))}
							className="rounded-lg border border-input"
						>
							{DURATION_OPTIONS.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Difficulty (label)</span>
						<NativeSelect
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
							className="rounded-lg border border-input"
						>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</NativeSelect>
					</label>
				</div>
				<AssignmentDueDatetimeField id="manual-due" onValueChange={setDueAt} />
			</section>

			<Separator />

			<section className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-foreground text-sm">Questions ({questions.length})</h3>
				</div>
				{questions.map((q, i) => (
					<ManualQuestionEditor
						key={q.id}
						index={i}
						draft={q}
						topics={topicsForSubject}
						onChange={(next) => setQuestions((prev) => prev.map((p) => (p.id === q.id ? next : p)))}
						onRemove={() => setQuestions((prev) => prev.filter((p) => p.id !== q.id))}
					/>
				))}
				<button
					type="button"
					onClick={() => setQuestions((prev) => [...prev, emptyManualQuestionDraft(nextId())])}
					className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-foreground hover:bg-muted/40"
				>
					+ Add question
				</button>
			</section>

			{!isEditingPublished ? (
				<>
					<Separator />
					<section className="space-y-3">
						<h3 className="font-medium text-foreground text-sm">Students</h3>
						<div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/15 p-3">
							{studentsForSubject.length === 0 ? (
								<p className="text-muted-foreground text-sm">No students on your roster for this subject.</p>
							) : (
								studentsForSubject.map((s) => (
									<label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-background/80">
										<input
											type="checkbox"
											checked={selectedStudentIds.includes(s.id)}
											onChange={() =>
												setSelectedStudentIds((prev) =>
													prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
												)
											}
											className="size-4"
										/>
										<span>
											{s.fullName}{" "}
											<span className="text-muted-foreground text-xs">
												· Grade {s.grade ?? "—"} · Sec {s.section ?? "—"}
											</span>
										</span>
									</label>
								))
							)}
						</div>
					</section>
				</>
			) : null}

			{state && state.message ? (
				<p className={cn("text-sm", state.ok ? "text-foreground" : "text-destructive")} role={state.ok ? undefined : "alert"}>
					{state.message}
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-3 border-border/50 border-t pt-6">
				<button
					type="button"
					onClick={onPublish}
					disabled={pending}
					className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
				>
					{pending ? "Working…" : isEditingPublished ? "Save changes" : "Publish assignment"}
				</button>
				{!isEditingPublished ? (
					<button
						type="button"
						onClick={onSaveDraft}
						disabled={pending}
						className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input px-5 text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-60"
					>
						Save draft
					</button>
				) : null}
			</div>
		</div>
	);
}
```

> Two integration points to verify while wiring:
> 1. `AssignmentDueDatetimeField` — confirm its prop for emitting the value. Read [assignment-due-datetime-field.tsx](src/components/teacher/assignment-due-datetime-field.tsx); the AI form uses it inside a `<form>` (name-based). For this controlled builder, either use a callback prop if it exists, or wrap it and read a hidden input. If it only supports form `name`, render it inside a `<form>` or replace with a plain `datetime-local` input bound to `dueAt`.
> 2. `TeacherPerformanceStudentRow` import path — the AI manager imports the type from `@/lib/teachers/teacher-performance-directory-types`; match that exact path.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors. Fix the two integration points above if flagged.

- [ ] **Step 3: Commit**

```bash
git add src/components/teacher/manual/teacher-manual-assignment-builder.tsx
git commit -m "feat(assignments): manual assignment builder (create + edit)"
```

---

### Task 14: AI/Manual mode switch on the create page

**Files:**
- Create: `app/teacher/(protected)/assignments/assignment-create-switcher.tsx`
- Modify: `app/teacher/(protected)/assignments/page.tsx`

- [ ] **Step 1: Read the page to learn what props it loads**

Run: `cat "app/teacher/(protected)/assignments/page.tsx"` and note how `subjectsCatalog`, `topicsCatalog`, `students`, and `initialGrade` are fetched and passed to `TeacherAssignmentsManager`.

- [ ] **Step 2: Create the switcher**

Create `app/teacher/(protected)/assignments/assignment-create-switcher.tsx`:

```tsx
"use client";

import * as React from "react";

import { TeacherAssignmentsManager } from "@/app/teacher/(protected)/assignments/teacher-assignments-manager";
import { TeacherManualAssignmentBuilder } from "@/components/teacher/manual/teacher-manual-assignment-builder";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";
import { cn } from "@/lib/utils";

type Mode = "ai" | "manual";

export function AssignmentCreateSwitcher(props: {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	initialGrade?: number | null;
}) {
	const [mode, setMode] = React.useState<Mode>("ai");
	const tab = (id: Mode, label: string) => (
		<button
			type="button"
			onClick={() => setMode(id)}
			className={cn(
				"min-h-9 rounded-lg px-4 text-sm font-medium transition-colors",
				mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
			)}
			aria-pressed={mode === id}
		>
			{label}
		</button>
	);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 py-6">
			<div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-1">
				{tab("ai", "AI-generated")}
				{tab("manual", "Write my own")}
			</div>
			{mode === "ai" ? (
				<TeacherAssignmentsManager
					subjectsCatalog={props.subjectsCatalog}
					topicsCatalog={props.topicsCatalog}
					students={props.students}
					initialGrade={props.initialGrade}
				/>
			) : (
				<TeacherManualAssignmentBuilder
					subjectsCatalog={props.subjectsCatalog}
					topicsCatalog={props.topicsCatalog}
					students={props.students}
				/>
			)}
		</div>
	);
}
```

> If `TeacherAssignmentsManager` already renders its own outer `max-w-6xl … py-6` wrapper (it does), drop the duplicate wrapper here or keep the AI manager visually unchanged by rendering it without the extra padding — verify visually in Task 16.

- [ ] **Step 3: Render the switcher from the page**

In `app/teacher/(protected)/assignments/page.tsx`, replace the `<TeacherAssignmentsManager … />` render with `<AssignmentCreateSwitcher … />` (same props), and update the import:

```tsx
import { AssignmentCreateSwitcher } from "./assignment-create-switcher";
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/teacher/(protected)/assignments/assignment-create-switcher.tsx" "app/teacher/(protected)/assignments/page.tsx"
git commit -m "feat(assignments): AI/Manual mode switch on create page"
```

---

### Task 15: Manual/AI badge on the teacher assignment list

**Files:**
- Modify: the component that renders the teacher's assignment/submission list.

- [ ] **Step 1: Locate the list component**

Run: `grep -rln "listTeacherAssignmentSubmissionRows\|TeacherAssignmentSubmissionRow\|lifecycleStatus" "app/teacher" src/components/teacher --include="*.tsx" | head`. Open the component that maps these rows into the teacher-facing list. Confirm it now receives `authoringMode` (added in Task 6).

- [ ] **Step 2: Add the badge**

Next to each assignment title, render:

```tsx
<span
	className={cn(
		"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
		row.authoringMode === "manual"
			? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
			: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
	)}
>
	{row.authoringMode === "manual" ? "Manual" : "AI"}
</span>
```

(Import `cn` from `@/lib/utils` if not already imported.) If the list is grouped by assignment via `listTeacherAssignmentSummaries` instead, use that row's `authoringMode` field (also added in Task 6).

- [ ] **Step 3: Verify + commit**

Run: `pnpm exec tsc --noEmit` (no new errors).

```bash
git add -A
git commit -m "feat(assignments): show Manual/AI badge on teacher assignment list"
```

---

# Phase 7 — Verification

### Task 16: Student renderer + full automated suite

**Files:** none (verification).

- [ ] **Step 1: Confirm the student test-taker handles all five types**

Run: `grep -rln "question_type\|questionType" app/student/practice src/components/student/practice --include="*.tsx" | head` and open the question renderer. Confirm it renders `multiple_choice`, `fill_in_blank`, `numerical`, `short_answer`, `long_answer` (AI tests already use these, so this should already hold). If any type is unhandled, note it — but per the spec this should require no change.

- [ ] **Step 2: Run the full unit suite**

Run: `pnpm test`
Expected: PASS (no regressions; new schema/helper/migration tests green).

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit (if lint applied fixes)**

```bash
git add -A
git commit -m "chore(assignments): lint + typecheck for manual assignments" || echo "nothing to commit"
```

---

### Task 17: End-to-end integration verification (manual, against a real DB)

**Files:** none (verification). Requires a local/staging Supabase with the migration applied and a worker that can run (`/api/internal/practice/run-jobs`).

- [ ] **Step 1: Publish a manual assignment**

As a verified teacher, open the assignments page → "Write my own" → author one question of **each** of the five types (tag each with a chapter/topic), pick 3 students, set a 30-minute limit, Publish.

- [ ] **Step 2: Confirm materialization (no LLM)**

Trigger the worker (or wait for cron). Then verify in SQL:

```sql
-- 3 submissions move pending_materialize → ready, each with a test_id
select lifecycle_status, count(*) from assignment_submissions
where assignment_id = '<ASSIGNMENT_ID>' group by 1;

-- each ready submission has a 5-question assigned test copied from the template
select t.id, t.test_type, t.time_limit_seconds, count(q.id) as questions
from tests t join questions q on q.test_id = t.id
where t.assignment_submission_id in (
  select id from assignment_submissions where assignment_id = '<ASSIGNMENT_ID>'
) group by 1,2,3;
```

Expected: `ready` count = 3; each test `test_type='assigned'`, 5 questions, `time_limit_seconds=1800`.

- [ ] **Step 2b: Confirm answer keys copied verbatim**

```sql
select question_type, answer_key, options from questions
where test_id = '<ONE_TEST_ID>' order by question_number;
```

Expected: MCQ has `options` + `answer_key.correct_answer`; open-ended has `marking_points`/`model_answer`; numerical has `correct_answer` (+ optional `tolerance`/`units`).

- [ ] **Step 3: Grade + tracker update (the core acceptance test)**

As one student, take and submit the test. Let the grade job run. Then:

```sql
-- scores written per question
select count(*), count(score_earned) from student_answers where test_id = '<THAT_TEST_ID>';

-- performance_tracker updated for each tagged topic
select topic_id, average_score, tests_taken, last_test_id, updated_at
from performance_tracker
where student_id = '<STUDENT_ID>' and topic_id in (
  select distinct topic_id from assignment_questions where assignment_id = '<ASSIGNMENT_ID>'
);
```

Expected: every answer has `score_earned`; `performance_tracker` rows show the new `average_score`, incremented `tests_taken`, and `last_test_id` = the graded test. **This proves the manual flow feeds the performance table through the unchanged pipeline.**

- [ ] **Step 4: Edit-after-publish (not-started-only + race guard)**

With 3 students at `ready`, move ONE to `in_progress` (open the test as that student). Edit the published assignment (change a question), Save changes. Verify:

```sql
select lifecycle_status, count(*) from assignment_submissions
where assignment_id = '<ASSIGNMENT_ID>' group by 1;
```

Expected: the 2 not-started submissions return to `pending_materialize` then re-materialize to `ready` with the **new** questions; the `in_progress` student is unchanged (still has the **old** test). The action's banner reports `appliedToNotStarted = 2`, `skippedAlreadyStarted = 1`.

Race check: set one submission to `ready`, then in two near-simultaneous actions run the student "start" and the teacher "save edit". Confirm exactly one wins and no submission ends up with a deleted test but `ready` status.

- [ ] **Step 5: Access control**

As a different teacher, attempt to read another teacher's `assignment_questions` via the authenticated client (PostgREST) and confirm RLS denies it. Confirm an org teacher can only pick topics/students within their roster subject/grade (publish returns the scope error otherwise).

- [ ] **Step 6: Document results**

Record the SQL outputs (or screenshots) in the PR description as evidence the acceptance tests pass.

---

## Implementation notes / gotchas (read before starting)

- **Migration ordering:** the file is dated `20260703000000` so it applies after `20260702000000_security_idor_hardening.sql` (which defines `teacher_can_access_student`) and after the assignment spine in `20260618130000`.
- **Supabase RPC typings:** after applying the migration, run `pnpm db:gen-types` so `practice_create_manual_assigned_test` is typed; otherwise cast the `.rpc(...)` call as noted in Task 8.
- **`db` bypasses RLS:** all manual writes go through Drizzle `db` (same as `createPublishedPracticeAssignment`). The `assignment_questions` RLS policy is defense-in-depth for any direct PostgREST access.
- **No worker change:** `handleAssignGenerateTestJob` already routes to `materializeAssignedPracticeTest`, which now branches on `authoring_mode`.
- **Equal weight preserved:** manual questions become ordinary `questions` rows; the grader scores each 0–100 and averages, exactly like AI assignments. No scoring/report code changes.
- **YAGNI:** no per-question marks, no question bank, no CSV import, no AI-draft hybrid in v1 (spec §12 future work).

## Self-review (completed by plan author)

- **Spec coverage:** authoring mode toggle (Task 14) ✓; all five types (Tasks 4, 11) ✓; per-question chapter/topic (Tasks 4, 10) ✓ → trackers update (Task 8, verified Task 17.3) ✓; equal-weight grading reused (no code) ✓; teacher-set count/time (Tasks 4, 13) ✓; draft persistence (Tasks 7, 9, 13) ✓; manual materialization by copy (Tasks 1, 8) ✓; edit-after-publish, not-started-only, race-safe (Tasks 7, 9, 13; verified 17.4) ✓; lists don't drop manual rows (Task 6) ✓; Manual/AI badge (Task 15) ✓; RLS/access control (Tasks 1, verified 17.5) ✓.
- **Placeholder scan:** the only intentional "fix this" is the `practice_jobs.student_id` placeholder in Task 7 Step 1, which Task 7 Step 2 replaces with real code before any commit — called out explicitly.
- **Type consistency:** `ManualQuestionInput`/`ManualQuestionDraft` flow editor → `manualDraftToQuestionInput` → schema → `deriveManualConfig` → queries → RPC consistently; `authoringMode` added to row types in Task 6 is consumed in Task 15.
- **Integration risks flagged inline:** `AssignmentDueDatetimeField` prop shape, `PracticeDifficulty` export, session field names, and the list component location each have a verify-first note.
