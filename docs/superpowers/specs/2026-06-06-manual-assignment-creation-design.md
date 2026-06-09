# Manual Assignment Creation — Design Spec

- **Date:** 2026-06-06
- **Status:** Draft (awaiting review)
- **Feature:** Let teachers create assignments by hand-authoring each question + answer key (with chapter/topic tagging), as an alternative to the existing AI-generated assignments. Grading, performance tracking, reports, and the student experience stay the same.

---

## 1. Goal

Today every assignment is AI-generated: the teacher picks subject/topics/difficulty/length and the system generates a unique practice test per student via an LLM. We want a second authoring mode where the teacher **writes each question themselves**, supplies the **answer key**, and **tags each question with a chapter + topic**, so the existing AI grader can grade it and the **performance table updates exactly as it does today**.

The teacher account chooses between:

- **AI assignment** — unchanged from today.
- **Manual assignment** — teacher crafts every question + answer key + topic.

---

## 2. The three findings that make this cheap

The research surfaced three facts that shape the entire design:

1. **There is no separate `chapters` table.** "Chapter" is just denormalized columns on the `topics` row (`unit_name/number`, `chapter_name/number`, `topic_name/number`) — see [academic.ts](src/db/schema/academic.ts). So **"select chapter + topic" reduces to selecting one topic**; the chapter rides along for free, and the existing topic UI already groups topics by chapter in [teacher-assignment-topic-matrix.tsx](src/components/teacher/teacher-assignment-topic-matrix.tsx).

2. **The performance table is topic-keyed and origin-agnostic.** `performance_tracker` is unique on `(student_id, topic_id)`. The post-grading updater `practice_update_tracker_running` ([20260419200000_practice_integrity.sql](supabase/migrations/20260419200000_practice_integrity.sql)) aggregates `student_answers.score_earned` joined to topics via `questions.topic_id`. It does not know or care whether a question was AI- or human-authored. **As long as each authored question carries a valid `topic_id` and flows through the normal `tests → questions → student_answers → grading` path, the performance table updates with zero new code.**

3. **The AI grader is already answer-key-driven.** [grading-prompts.ts](src/lib/practice/grading-prompts.ts) injects each question's `answer_key` JSONB (`correct_answer`, `full_credit_requires`, `acceptable_variants`, `marking_points`, `distractor_rationale`, `expected_misanswers`, …) into the grading prompt and scores per `question_type`. The AI-generation step merely *fills in* that key today. If a teacher fills it instead, **grading works unchanged.**

**Conclusion:** this feature is mostly an **authoring UI**, a **place to store the authored questions**, and a **no-LLM "materialize by copy" step**. Grading, trackers, reports, PDFs, late penalties, and the student test-taker are all reused as-is.

---

## 3. Scope

### In scope (v1)
- Teacher chooses AI vs Manual at assignment creation.
- Manual builder supporting **all five question types**: `multiple_choice`, `fill_in_blank`, `numerical`, `short_answer`, `long_answer`.
- Per-question **topic tag** (chapter implied), optional per-question difficulty.
- Per-type **answer-key editor** producing the JSON the existing grader consumes.
- **Equal-weight scoring** (every question 0–100, averaged) — reuses the current engine unchanged.
- **Teacher-set question count and time limit** (sane min/max), not the AI 15/30 + 1h/3h presets.
- **Draft persistence**: author over multiple sessions; publish when ready.
- Publish → per-student materialization **by copy** (no LLM) → existing grading/trackers/reports.
- **Edit after publish (safe rules)**: a published assignment's questions can be edited; changes apply **only to submissions that haven't started** (`pending_materialize`/`ready`). Students who are in-progress, submitted, or graded are frozen and never disrupted (§9.2).

### Out of scope (v1, listed as future improvements in §12)
- Per-question marks/weighting (explicitly deferred — chose equal weight).
- AI-draft-then-teacher-edit hybrid.
- Reusable question banks / CSV import / duplicate-as-template.
- Chapter-level performance rollups (system is topic-level by design).

### Confirmed product decisions
| Decision | Choice |
|---|---|
| Question types in v1 | **All five** |
| Scoring | **Equal weight** (reuse engine) |
| Length & timing | **Teacher sets both** count and time limit |
| Same questions for all students? | **Yes** — one authored set, copied to every assigned student (a real shared exam) |
| Edit after publish? | **Yes (v1)** — applies only to not-yet-started submissions; started/done students frozen (§9.2) |

---

## 4. High-level approach

Reuse the entire existing assignment pipeline and **fork in only two places**:

1. **Authoring/creation** — a manual builder + new server actions that store authored questions instead of an AI config.
2. **Materialization** — when a manual submission materializes, **copy** the authored questions into a per-student `tests`/`questions` set instead of calling the LLM.

Everything downstream — submission lifecycle, the student test-taker, grading ([ai-grade-practice-test.tsx](src/lib/practice/ai-grade-practice-test.tsx)), tracker updates, reports, PDFs, notifications — is **untouched**.

```
                        ┌─────────────── shared ───────────────┐
Teacher → create ──┬─ AI:   config → submissions → jobs ─► materialize(LLM) ─┐
                   │                                                          ├─► tests+questions
                   └─ MANUAL: authored Qs → submissions → jobs ─► materialize(COPY) ─┘
                                                                              │
                            student takes test → submits → GRADE (unchanged) │
                                                                              ▼
                                            student_answers → trackers → reports/PDF (unchanged)
```

---

## 5. Data model changes

### 5.1 New table: `assignment_questions` (the authored template)

Holds the teacher's authored questions **once per assignment** (not per student). At materialization these rows are copied into the per-student `questions` table.

> **Why a dedicated table (vs. a JSONB blob on `assignments.config`)?** The rows need per-question validation, editing/reordering in draft, RLS scoped to the owning teacher, and a clean copy into the relational `questions` table. A JSONB array would bloat the assignment row and make editing/validation awkward. (JSONB was considered and rejected.)

Columns (mirrors the gradeable subset of [`questions`](src/db/schema/assessment.ts) so the copy is 1:1):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `assignment_id` | uuid NOT NULL FK → `assignments(id)` ON DELETE CASCADE | |
| `question_number` | int NOT NULL | author order, 1-based |
| `topic_id` | uuid NOT NULL FK → `topics(id)` | **required** — drives the performance table |
| `question_type` | varchar(20) NOT NULL | one of the five; CHECK matches `questions.question_type` |
| `question_text` | text NOT NULL | KaTeX `$...$` supported, same as AI |
| `options` | jsonb NULL | MCQ only: `{ "A": "...", "B": "...", ... }` |
| `answer_key` | jsonb NOT NULL | the grader's source of truth (see §6) |
| `difficulty_level` | varchar(10) NOT NULL DEFAULT `'medium'` | optional per-question; nominal only |
| `metadata` | jsonb NOT NULL DEFAULT `'{}'` | e.g. `{ source: 'manual' }` |
| `created_at` / `updated_at` | timestamptz | |

- **Indexes:** `(assignment_id, question_number)`.
- **RLS:** owning teacher can CRUD rows where the parent `assignments.teacher_id = auth.uid()`; students never read this table (they read the copied `questions` rows for their own test). Model the policies on the existing `assignments` RLS in [20260618130000_educator_practice_assignments_final_hardening.sql](supabase/migrations/20260618130000_educator_practice_assignments_final_hardening.sql).
- **Drizzle:** add to a schema module (e.g. `src/db/schema/teaching.ts`).

### 5.2 `assignments.config` — add an authoring discriminator

Keep `assignment_kind = 'practice_test'` (a manual assignment is still a graded practice test). Distinguish mode inside `config`:

- Add `authoring_mode: 'ai' | 'manual'`. **Existing rows have no field → treated as `'ai'`** (backward compatible; no backfill required, handled in the parser).
- **AI config**: unchanged shape (the current [`assignmentConfigSchema`](src/lib/assignments/schemas.ts)), with `authoring_mode` defaulting to `'ai'`.
- **Manual config** stored shape:
  ```jsonc
  {
    "v": 1,
    "kind": "practice_test",
    "authoring_mode": "manual",
    "subject_id": "<uuid>",            // single subject (teacher roster subject for org teachers)
    "topic_ids": ["<uuid>", ...],      // DERIVED = distinct topic_ids across authored questions (kept for summary/analytics reuse)
    "difficulty": "medium",            // nominal/display only; real difficulty is per-question
    "question_count": <int>,           // = number of authored questions
    "time_limit_seconds": <int>        // teacher-chosen
  }
  ```
  Storing the derived `topic_ids` keeps the existing assignment-summary and tracker-precreation code working without special-casing.

### 5.3 Verify/extend `questions.question_type` CHECK

The authored types must be insertable into `questions`. The base table plus [20260420120000_practice_question_types_fill_long.sql](supabase/migrations/20260420120000_practice_question_types_fill_long.sql) added `fill_in_blank`/`long_answer`. **Verify the CHECK constraint allows all five** (`multiple_choice`, `fill_in_blank`, `numerical`, `short_answer`, `long_answer`); if `numerical` (or any) is missing, add a migration extending the CHECK. Apply the same CHECK to `assignment_questions.question_type`.

---

## 6. The authoring → grading contract (answer-key shapes per type)

The authoring UI must produce, per type, the `answer_key` (and `options`) JSON the grader already consumes via `parseAnswerKeyBrief` in [grading-prompts.ts](src/lib/practice/grading-prompts.ts). The grader stringifies the **whole** `answer_key`, so extra fields (e.g. `tolerance`, `units`, `model_answer`) are honored.

| Type | `options` | `answer_key` (required → optional) | Grader scale |
|---|---|---|---|
| `multiple_choice` | `{A,B,C,…}` (2–6) | `correct_answer:"B"` → `explanation`, `distractor_rationale:{A..}` | 100 / 0 |
| `fill_in_blank` | — | `correct_answer` → `acceptable_variants[]`, `explanation` | 100 / 50 / 0 |
| `numerical` | — | `correct_answer` → `tolerance`, `units`, `explanation` | 100 / 50 / 0 |
| `short_answer` | — | one of `marking_points[]` / `full_credit_requires[]` / `model_answer` → `acceptable_variants[]`, `expected_misanswers[]` | 100/75/50/25/0 |
| `long_answer` | — | one of `marking_points[]` / `model_answer` → `full_credit_requires[]`, `criteria[]` | 5 criteria × {0,10,20} |

**Validation rules (enforced in schema, §7):**
- MCQ: `correct_answer` must be a key in `options`; ≥2 options; exactly one correct.
- `numerical`: `correct_answer` parses as a number; `tolerance` ≥ 0 if present.
- `short_answer` / `long_answer`: at least one of `marking_points` / `full_credit_requires` / `model_answer` is non-empty (otherwise the grader has nothing to grade against). UI strongly nudges marking points for consistent AI grading.

---

## 7. Validation schemas

In [schemas.ts](src/lib/assignments/schemas.ts):

- **`manualAssignmentConfigSchema`** — the §5.2 manual shape. `question_count` = `z.number().int().min(1).max(50)`; `time_limit_seconds` = bounded int (e.g. 300–14400); no AI count/time coupling.
- **Config router** — parse by `config.authoring_mode ?? 'ai'`: route to existing `assignmentConfigSchema` (AI) or `manualAssignmentConfigSchema` (manual). Avoids forcing the existing AI schema into a discriminated union.
- **`manualQuestionInputSchema`** — a `z.discriminatedUnion('question_type', [...])` with one member per type, each validating `question_text`, `topic_id` (uuid), optional `difficulty_level`, and the type-specific `options`/`answer_key` per §6.
- **`createManualAssignmentInputSchema`** — `{ title, instructions, config(manual), questions: manualQuestionInputSchema[] (1..50), student_ids, due_at }`, reusing the existing title/instructions/due_at validators.

---

## 8. Server actions & queries

### 8.1 Actions ([actions.ts](app/teacher/(protected)/assignments/actions.ts))
Add manual siblings to `createTeacherAssignmentAction`, reusing its session check, rate limit, `teacherFilterAccessibleStudentIdsForSession`, and `validatePracticeAssignmentConfigForStudents`:

- **`saveManualAssignmentDraftAction`** — validate with `createManualAssignmentInputSchema` (students/due optional for a draft); upsert assignment (`status='draft'`, `authoring_mode='manual'`) + replace its `assignment_questions`. Returns assignment id so the builder can keep editing.
- **`publishManualAssignmentAction`** — load the draft + its authored questions; **derive `config.topic_ids` = distinct authored topic_ids** and `config.question_count` = count; run `validatePracticeAssignmentConfigForStudents` (this already checks subject/grade/topic-belongs-to-subject/student access — reused unchanged); then call `createPublishedManualAssignment` (§8.2).
- **`updatePublishedManualAssignmentAction`** — edit a *published* manual assignment. Re-validate; replace `assignment_questions`; recompute derived `config` (topic_ids, question_count); then run the scoped re-materialization of §9.2 and return `{ appliedToNotStarted, skippedAlreadyStarted }` counts for the UI banner.

### 8.2 Queries ([queries.ts](src/lib/assignments/queries.ts))
- **`createPublishedManualAssignment`** — transactional, mirrors `createPublishedPracticeAssignment` (lines ~276–339) but:
  - assignment `config.authoring_mode='manual'`, `status='published'`, `published_at=now`;
  - persists `assignment_questions`;
  - inserts one `assignment_submissions` per student at `lifecycle_status='pending_materialize'`;
  - enqueues one `practice_jobs` row per student with `job_type='assign_generate_test'` (**reused** — satisfies the existing `test_id IS NULL AND assignment_submission_id IS NOT NULL` constraint), **`run_after = now` (no 30s staggering — there's no LLM rate limit to spread)**;
  - calls `notifyAssignmentPublished` + `triggerPracticeWorkerInBackground()` (reused).
- **Draft read/update helpers** — load a draft assignment + its `assignment_questions` for the editor; delete/replace questions on save.

> The worker ([run-jobs/route.ts](app/api/internal/practice/run-jobs/route.ts)) and its `handleAssignGenerateTestJob` need **no change** — they just call `materializeAssignedPracticeTest(submissionId)`, which forks internally (§9).

---

## 9. Materialization by copy (no LLM)

In [assignment-generation.ts](src/lib/admin/assignment-generation.ts), branch at the top of `materializeAssignedPracticeTest`:

1. Load submission → assignment → parse `config`.
2. **If `config.authoring_mode === 'manual'` → delegate to new `materializeManualAssignedTest(submissionId)`.** Otherwise existing AI path, unchanged.

**`materializeManualAssignedTest`:**
1. Guard: assignment `published`, submission `pending_materialize` (same guards as AI path).
2. Load `assignment_questions` for the assignment; compute distinct `topic_ids`.
3. `ensurePerformanceTrackerRowsForAssignmentTopics(studentId, subject_id, distinctTopicIds)` — **reused** ([queries.ts](src/lib/assignments/queries.ts) ~397), so trackers exist before grading.
4. Call new RPC **`practice_create_manual_assigned_test(p_assignment_submission_id)`** (§9.1).
5. On success → submission `lifecycle_status='ready'`; on failure → `failed_generation` + error (reuse `markSubmissionGenerationFailed`).
6. `notifyAssignmentMaterialized` (reused).

This keeps the manual path structurally identical to the AI path minus the LLM/quality-gate machinery.

### 9.1 New RPC: `practice_create_manual_assigned_test`
A trimmed clone of `practice_generate_assigned_test` ([20260618130000_…_final_hardening.sql](supabase/migrations/20260618130000_educator_practice_assignments_final_hardening.sql)) that takes **no AI question payload** and instead **reads `assignment_questions`** for the submission's assignment:
- Validate submission/assignment state (same guards as the AI RPC).
- Insert a `tests` row (`test_type='assigned'`, `assignment_submission_id`, `subject_id`, nominal `difficulty`, `question_count`, `duration` from config, status mirroring the AI RPC's takeable state) — **mirror exactly the column writes of the AI RPC** so the test-taker/grader see an identical shape.
- Insert `questions` rows copying `question_text`, `question_type`, `options`, `answer_key`, `topic_id`, `difficulty_level`, `question_number` from `assignment_questions`. `embedding` left NULL (only used for similarity search, not grading/trackers).
- Link `assignment_submissions.test_id`; set lifecycle `ready`.
- Idempotent: respect the existing one-test-per-submission unique index.

### 9.2 Re-materialization on edit (edit-after-publish)

When a published manual assignment is edited, the changes must reach **only students who haven't started**. We reuse the existing materialize-by-copy path via **reset-and-re-enqueue** — no new RPC needed.

For each submission of the assignment, in a row-locked step:
- `in_progress` / `submitted` / `grading` / `graded` / `late` / `excused` → **skip** (frozen; never touched).
- `pending_materialize` → **no action**: its pending `assign_generate_test` job will copy the latest `assignment_questions` when it runs.
- `ready` → **only if still `ready`** at this instant. Guard with a conditional `UPDATE ... WHERE lifecycle_status = 'ready'` (or `SELECT ... FOR UPDATE`) so a student who just started is not clobbered. When the guard holds: delete the per-student `tests` row (cascades its `questions`; no `student_answers` exist yet; `assignment_submissions.test_id` is `ON DELETE SET NULL`), reset the submission to `pending_materialize`, and enqueue a fresh `assign_generate_test` job (respecting `practice_jobs_assignment_generate_active_uq`). The unchanged §9 worker path then re-copies from the updated template.

Also re-run `ensurePerformanceTrackerRowsForAssignmentTopics` for any newly-added topics (idempotent). Title/instructions edits update the assignment row directly and are safe in any state. Time-limit edits take effect only for re-materialized (not-started) tests; already-materialized tests keep their original limit. The action returns affected/frozen counts so the teacher sees exactly who is impacted.

---

## 10. Grading, trackers, reports — unchanged (and why)

No changes. Because manual questions become ordinary `questions` rows (correct `topic_id`, valid `answer_key`, standard `question_type`) on an ordinary `assigned` `tests` row:
- The student takes/submits exactly as today; submission enqueues a `grade` job.
- `gradePracticeTestWithAi` loads `answer_key` per question and scores per type (§2, finding 3) — identical.
- It then calls `practice_update_trackers_bulk` keyed by `questions.topic_id` → `performance_tracker` updates (§2, finding 2) — identical.
- `test_reports`, the PDF, late penalties, excused, and the student/teacher report views — identical.

**Verification point:** confirm the student test-taker renderer handles all five `question_type`s (it does for AI tests today; manual reuses the same renderer). The student-answer payload union (`mcq` / `text` / `numerical`) already covers every type.

---

## 11. UI

### 11.1 Mode toggle
In [teacher-assignments-manager.tsx](app/teacher/(protected)/assignments/teacher-assignments-manager.tsx), add an **AI vs Manual** toggle at the top of the create flow. AI → existing form. Manual → new builder.

### 11.2 Manual builder (new component `TeacherManualAssignmentBuilder`)
- **Header fields:** title, instructions, subject (locked to roster subject for org teachers), time limit (teacher-set), due date, student picker — reuse existing pickers.
- **Question list:** add / edit / reorder / duplicate / delete; live count + a "ready to publish" checklist (every question complete & topic-tagged).
- **Per-question editor (`ManualQuestionEditor`)**, one panel per type:
  - type selector → `question_text` (with **KaTeX live preview**, since the platform already renders KaTeX) → **topic picker** (§11.3) → type-specific answer-key fields (§6) → optional difficulty.
  - MCQ: dynamic options A–F, mark exactly one correct, optional per-option rationale.
  - short/long: marking-points list + optional model answer; inline hint that more marking points = better AI grading.
- **Actions:** Save draft (persist), Publish (validate all → materialize). Published assignments remain **editable** with effect scoped to not-yet-started students (§9.2, §11.5).

### 11.3 Topic picker (chapter-grouped, single-select)
Reuse the data + bucketing from [teacher-assignment-topic-matrix.tsx](src/components/teacher/teacher-assignment-topic-matrix.tsx) (`listTeacherAssignmentSubjectCatalog`, `bucketTopics`), but as a **single-select** combobox grouped `Chapter N: <name> → <topic>`. Selecting a topic implicitly captures its chapter.

### 11.4 Student & teacher surfacing
- **Student side:** none — manual assignments appear and play identically (same `assigned` test). Verify the assignment card/list shows them (they're ordinary `assignment_submissions`).
- **Teacher lists:** the existing assignment summary already reads `config`; add a small **"Manual"/"AI"** badge using `config.authoring_mode`. Counts/scores reuse the existing aggregates.

### 11.5 Editing a published assignment
Opening a published manual assignment enters an **edit mode** that reuses the builder. A banner makes the blast radius explicit, e.g. _"N students haven't started — your changes apply to them. M students already started — frozen, not affected."_ Saving calls `updatePublishedManualAssignmentAction` (§8.1 → §9.2) and surfaces the applied/skipped counts on success. Students mid-test or already graded are never disrupted.

---

## 12. Suggested improvements

In-scope refinements (cheap, high value):
- **Grade-ability nudges** for open-ended questions (warn when no marking points).
- **KaTeX preview** in the editor (reuse existing renderer).
- **"Ready to publish" checklist** so teachers can't publish incomplete questions.

Future phases (noted, not built now):
- Per-question **marks/weighting** (we chose equal weight for v1).
- **Reusable question bank**, **CSV/paste import**, **duplicate assignment as template**.
- **AI-draft → teacher-edit** hybrid.
- **Preview-as-student** before publishing.
- **Per-question difficulty analytics** (stored now, unused by trackers today).

---

## 13. Edge cases & risks

- **`question_type` CHECK** must include all five on both `questions` and `assignment_questions` (§5.3) — verify first or inserts fail.
- **Clone fidelity of the test row:** the manual RPC must write the same `tests`/`questions` columns the test-taker and grader expect; mirror the AI RPC precisely (§9.1).
- **Topic ↔ subject integrity:** every authored question's `topic_id` must be active and belong to `config.subject_id`; enforced by reusing `validatePracticeAssignmentConfigForStudents` over derived `topic_ids`.
- **Empty answer key for open-ended** → grader can't grade; blocked by schema validation (§6).
- **Large rosters:** publish creates one submission+job per student (same as AI); materialization copy is pure SQL and fast.
- **Draft integrity:** saving replaces `assignment_questions` for that assignment; draft saves are unrestricted; published edits go through the scoped re-materialization path (§9.2) instead of editing students' live tests.
- **Edit-after-publish race:** a student transitioning `ready → in_progress` during an edit is protected by the conditional `WHERE lifecycle_status = 'ready'` guard — they keep their pre-edit test and are simply skipped.
- **Topic changes on edit:** added topics get tracker rows re-ensured for not-started students; removed topics keep their existing tracker data (harmless — trackers are append-only per topic).
- **Backward compatibility:** existing AI assignments (no `authoring_mode`) parse as `'ai'`; no data migration needed.

---

## 14. Testing strategy

- **Schema/unit:** `manualQuestionInputSchema` per type (valid + each invalid case: MCQ correct not in options, numerical non-numeric, open-ended with empty key); manual config bounds; config router (`authoring_mode` absent → AI).
- **Query/integration:** `createPublishedManualAssignment` writes assignment + questions + submissions + jobs; `materializeManualAssignedTest` + RPC produce a `tests`/`questions` set byte-compatible with an AI test (snapshot the column set).
- **End-to-end:** author one of each type → publish → simulate a student submission → run grading → assert `student_answers.score_earned`, `test_reports`, and **`performance_tracker` updated for the tagged topics** (the core acceptance test).
- **Access control:** non-owning teacher cannot read/edit another teacher's `assignment_questions` (RLS); org teacher restricted to roster subject/grade.
- **Edit-after-publish:** publish to 3 students; move 1 to `in_progress`; edit the questions. Assert the 2 not-started students re-materialize with the new questions and the started student's test is unchanged. Race test: flip a `ready` submission to `in_progress` mid-edit and assert it is skipped (guard holds).
- **Regression:** existing AI flow unchanged (config router + worker fork don't alter AI behavior).

---

## 15. Phased rollout

1. **DB** — `assignment_questions` table + RLS + Drizzle; `authoring_mode` in config; verify/extend `question_type` CHECK.
2. **Schemas** — manual config, per-question union, per-type answer-key validation, config router.
3. **Server** — draft/publish/**edit-published** actions; `createPublishedManualAssignment` + draft helpers + **scoped re-materialization (§9.2)**.
4. **Materialization** — fork in `materializeAssignedPracticeTest`; `materializeManualAssignedTest`; `practice_create_manual_assigned_test` RPC.
5. **UI** — mode toggle, `TeacherManualAssignmentBuilder`, `ManualQuestionEditor` (×5), chapter-grouped topic picker, draft/publish, **edit-published mode with affected/frozen banner**, teacher-list badge.
6. **Verify & test** — the end-to-end acceptance test (§14), access-control, AI regression.

Grading, trackers, reports, PDFs, and the student test-taker require **no changes** — they are the reused foundation this feature stands on.

---

## 16. Open questions

- None blocking. Confirmed: marks = equal weight, types = all five, length/timing = teacher-set, and **edit-after-publish is in v1** (applies to not-yet-started submissions only).
