# Practice test generation: AI system prompt vs user prompt

This document describes **exactly** what the practice test generator sends to the model: the **system** message and the **user** message. It reflects the implementation in:

- [`src/lib/practice/system-prompt.ts`](../src/lib/practice/system-prompt.ts) — system prompt assembly
- [`src/lib/practice/generation-prompt-registry.ts`](../src/lib/practice/generation-prompt-registry.ts) — subject/grade preamble templates
- [`src/lib/practice/user-message.ts`](../src/lib/practice/user-message.ts) — user payload shape and JSON serialization
- [`src/lib/practice/practice-generation-pipeline.ts`](../src/lib/practice/practice-generation-pipeline.ts) — `generateObject` / `streamObject` with `system` + `prompt` (user)

---

## How the SDK call is wired

The generation step passes:

| SDK field   | Source in code |
|------------|----------------|
| `system`   | `buildPracticeSystemPrompt({ userMessageSummary, generationSubject })` |
| `prompt`   | `stringifyPracticeUserMessageForModel(userPayload)` — **one string**: pretty-printed JSON + trailing newline |
| `schema`   | Zod-derived structured output schema (`createPracticeGenerationOutputSchema`) — not part of the text prompts but constrains the model output |

So the model sees **two text channels**: a long system string and a long user string. The **user** string is not natural language; it is the full request payload as JSON.

---

## System prompt (full structure)

The final system string is:

```text
{subject preamble}

{shared rules + JSON contract + schema marker}
```

Built in `buildPracticeSystemPrompt`: preamble first, then `buildPracticeGenerationSharedSystemInstructions`, joined with `\n\n`.

### Part A — Subject / grade preamble (`getPracticeGenerationSubjectPreamble`)

**Purpose:** Steer role, curriculum stance, and subject depth using the student’s **subject row** (`subjects.grade`, `subjects.subject_group`, `subjects.name`).

**Always included (dynamic lines):**

1. **Subject line** — Embeds `subjectName` and `subjectGrade` (from DB subject row), e.g.  
   `You are generating practice for subject "…" (Grade N).`  
   If grade were ever missing, copy would say `the student’s grade` (unlikely for normal subjects).

2. **Body** — One paragraph chosen from **`PREAMBLES_6_10`** or **`PREAMBLES_11_12`** in [`generation-prompt-registry.ts`](../src/lib/practice/generation-prompt-registry.ts), keyed by:
   - **Band:** `6_10` vs `11_12` from `subjects.grade` (fallback: profile grade).
   - **Category:** resolved from `subject_group`, else heuristics on `subject.name` (English, Science, Physics, Financial Accounting → accountancy, etc.).

   You can replace **only** those preamble strings; routing logic stays in code.

3. **Bridge line** — Fixed:  
   `Your task: generate a single practice test as strict JSON matching the contract in the instructions below.`

**Not in the preamble:** Topic text, performance tables, or chunk content — those live in the **user** JSON.

### Part B — Shared instructions (`buildPracticeGenerationSharedSystemInstructions`)

**Purpose:** Global rules, output shape description, and **mirrored** numeric/test parameters (also present in user JSON).

**Static (same every call except where noted):**

- Bullet rules on using `topic_grounding`, Bloom levels, MCQ A–D, fill-in/short/long definitions, safety, JSON-only output.
- A full **illustrative** JSON example for `questions_by_type` and `generation_metadata` (placeholders like `<uuid from user message>`).

**Dynamic (interpolated from `userMessageSummary`, which is derived from the same payload as the user message):**

| Value | Source field |
|-------|----------------|
| Total question count | `test_parameters.estimated_question_count` |
| Per-type counts line | `test_parameters.question_type_counts` (MC, FiB, short, long) |
| Difficulty | `test_parameters.difficulty` |
| Time limit | `test_parameters.time_limit_seconds` |
| Topic count | `test_parameters.topic_count` |
| Coverage mode + instruction | `test_parameters.coverage_mode`, `coverage_instruction` |
| Schema marker line | `intent`, `schema_version` |

**Note:** `constraints.pedagogy` is **not** repeated in the system prompt’s shared block; it appears only in the **user** JSON (see below). The system rules still reference pedagogy conceptually (Bloom, topic_grounding, recent_errors).

---

## User prompt (what the `prompt` string contains)

The user message is **`JSON.stringify(payload, null, 2)`** plus a newline, after stripping **`grounding_meta.fetch_error`** so operational errors are not sent to the model.

Defined by `PracticeUserMessagePayload` / `PracticeUserMessageForModel` in [`user-message.ts`](../src/lib/practice/user-message.ts).

### Top-level fields

| Field | Meaning |
|-------|--------|
| `schema_version` | Always `3` (contract version for the payload). |
| `intent` | Always `"generate_practice_test"`. |
| `student` | `grade` (profile; nullable), optional `recent_errors` (up to 8 items from graded tests). |
| `subject` | `id` (UUID), `name` (display name from resolved subject row). |
| `topic_grounding` | Array of per-topic curriculum grounding (see below). |
| `grounding_meta` | Counts/size/truncation flags for chunks (no `fetch_error` in the model-facing copy). |
| `test_parameters` | Difficulty, duration, counts, coverage mode/instruction, notes, `generation_instruction`. |
| `topics` | Same `topic_id`s as in grounding, with **performance** only (status, scores, trend, etc.). |
| `constraints` | Allowed question types + long **pedagogy** paragraph. |

### `student.recent_errors` (when present)

Each item: `topic_id`, `topic_name`, `concept` (short line from feedback or question), `verdict`, `last_seen_at`. Used to bias generation toward weak areas; system rules remind the model that `topic_id` must still come from allowed lists.

### `topic_grounding[]` (largest variable part)

Per selected topic:

- `topic_id`, `topic_name`
- `curriculum_hint`: `unit_name`, `chapter_name`, `grade` (from topic/tracker resolution)
- `content_chunks`: `{ text, source_ref }[]` — NCERT-style context lines from DB
- `exercise_chunks`: `{ text, source_ref }[]` — exercise-style references

Server fills chunks via `fetchTopicContextChunksByTopicIds` (service role). Size is bounded by topic-context limits (truncation reflected in `grounding_meta`).

### `grounding_meta` (model-facing)

- `topic_count`, `context_chunk_count`, `exercise_chunk_count`
- `context_char_total`, `exercise_char_total`, `truncated`  
`fetch_error` is **removed** before stringify.

### `test_parameters`

| Field | Notes |
|-------|--------|
| `difficulty` | Student-selected (easy / medium / hard). |
| `time_limit_seconds` | From session duration choice. |
| `estimated_question_count` | From duration plan (`getPracticeQuestionPlan`). |
| `topic_count` | Number of selected topics. |
| `coverage_mode` | `few_topics` \| `balanced` \| `many_topics` (derived from topic vs question counts). |
| `coverage_instruction` | Long instruction string for that mode. |
| `question_type_counts` | Counts per bucket matching the plan. |
| `note` | Fixed explanation that counts are fixed by duration. |
| `generation_instruction` | Fixed directive: original questions aligned to grounding; do not copy exercise chunks verbatim. |

### `topics[]` (performance parallel to grounding)

For each selected topic: `topic_id` + `performance` (`status`, `average_score_percent`, `tests_taken`, `trend`, `last_test_date`). Curriculum names are **not** duplicated here; they live under `topic_grounding`.

### `constraints`

- `question_types`: fixed four-type array.
- `pedagogy`: long static paragraph (NCERT/Bloom/coverage/recent_errors/fill-in vs long answer, etc.).

---

## Overlap and division of responsibility

| Concern | System prompt | User prompt |
|--------|----------------|------------|
| Subject/grade **persona** and syllabus depth | Preamble (`PREAMBLES_*`) + subject line | `subject`, `topic_grounding`, `student.grade` |
| **Rules** and **JSON shape** | Yes (explicit bullets + example) | Implicit in structured schema + payload |
| **Counts, difficulty, time, coverage** | Repeated in rule bullets (dynamic) | `test_parameters` (authoritative numbers) |
| **Curriculum text** | “Use topic_grounding” | Actual chunks in `topic_grounding` |
| **Performance + errors** | Instructions to use them | `topics[]`, `student.recent_errors` |
| **Pedagogy paragraph** | Partially overlapping bullets | `constraints.pedagogy` (full text) |

The model receives **redundant** numeric/test metadata in both places on purpose: the system message states hard constraints in prose; the user JSON is the structured source of truth for grounding and analytics-friendly fields.

---

## Editing prompts safely

- **Subject-specific copy:** Edit `PREAMBLES_6_10` and `PREAMBLES_11_12` in [`generation-prompt-registry.ts`](../src/lib/practice/generation-prompt-registry.ts).
- **Global rules / JSON example / schema marker:** Edit `buildPracticeGenerationSharedSystemInstructions` in [`system-prompt.ts`](../src/lib/practice/system-prompt.ts).
- **User JSON shape or pedagogy string:** Edit `buildPracticeUserMessage` and related types in [`user-message.ts`](../src/lib/practice/user-message.ts).

Changing `schema_version` or the output schema in code may require aligned updates in both the system “Schema marker” line and any consumer expectations.

---

## Related docs

- [`docs/practice-test-generation-flow-and-config.md`](practice-test-generation-flow-and-config.md) — broader product/flow documentation (if present).
