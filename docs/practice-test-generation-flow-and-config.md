# Practice test generation: flow, model configuration, and prompt contract

This document describes how **self-practice test generation** works in EduAI: the step-by-step server flow, environment and API settings, and the **system + user message** structure the model sees. Use it as handoff context when authoring or refining generation system prompts (for example in an external Claude session).

Implementation sources of truth (this repo):

- Pipeline: `src/lib/practice/practice-generation-pipeline.ts`
- System prompt assembly: `src/lib/practice/system-prompt.ts`, `src/lib/practice/generation-prompt-registry.ts`
- User message JSON: `src/lib/practice/user-message.ts`
- Post-generation validation: `src/lib/practice/generation-schema.ts`
- Duration → counts: `src/lib/practice/constants.ts`
- Topic grounding limits: `src/lib/practice/topic-context-chunks.ts`
- Retries: `src/lib/practice/ai-retry.ts`
- Model id: `src/lib/env.ts` (`getOpenAIChatModel`)

---

## 1. What gets generated

- A **single practice test** as **structured JSON**: questions grouped by type (`questions_by_type`), then **flattened** to a linear `questions` array for storage and student UI.
- Students receive **questions without answer keys** from this channel; keys stay server-side for grading.
- Curriculum alignment is driven by **`topic_grounding`** (per-topic `content_chunks` and `exercise_chunks` from `topic_context_chunks`), not by free-form invention.

---

## 2. System prompt: historical single block vs today’s two-part assembly

### Previous generator (before the subject/grade preamble split)

The earlier **single** `buildPracticeSystemPrompt` output was mostly a **template**: **fixed** wording plus **many values** interpolated from `userMessageSummary` — primarily **`test_parameters`** — and the **schema marker** from **`intent`** / **`schema_version`**.

**Opening lines that were static in that old version:** The generic educator framing (e.g. expert educator, Indian K–12, NCERT-aligned) and the “your task: generate …” style copy did **not** embed **subject name** or **grade** in the system prompt; those lived only in the **user** JSON (e.g. `subject`, `student.grade`) unless you consider the user turn part of “the prompt” end-to-end.

**Already dynamic in that shared block (still true today in `buildPracticeGenerationSharedSystemInstructions`):**

| Source (conceptual) | Fields woven into the rules / type-count line |
|---------------------|-----------------------------------------------|
| `test_parameters` | `estimated_question_count` |
| | Per-type counts — `multiple_choice`, `fill_in_blank`, `short_answer`, `long_answer` — in the “Fill `questions_by_type` with exactly …” line |
| | `difficulty` |
| | `time_limit_seconds` |
| | `topic_count`, `coverage_mode`, `coverage_instruction` |
| Summary line | `intent`, `schema_version` (schema marker at the end of the shared block) |

**Note:** `UserMessageSummary` includes **`constraints`** for the `buildPracticeSystemPrompt` call shape, but **`buildPracticeGenerationSharedSystemInstructions` does not interpolate `constraints.pedagogy` into the system string** — it only substitutes from **`test_parameters`** and ends with **`intent` / `schema_version`**. Longer pedagogy copy lives on the **user** JSON (`constraints.pedagogy`, etc.) alongside the same request.

### Today: same dynamic core + new front matter

`buildPracticeSystemPrompt` now **concatenates**:

1. **`getPracticeGenerationSubjectPreamble`** (`generation-prompt-registry.ts`) — **additive** section with:
   - **`subjectName`** and **`subjectGrade`** (or a fallback when grade is missing) in the lead line
   - **Band** (`6_10` vs `11_12`) and **category** (e.g. science vs physics) choosing the **CBSE/NCERT** subject preamble string
   - A line that the task is one practice test as **strict JSON** matching the contract below

2. **`buildPracticeGenerationSharedSystemInstructions`** (`system-prompt.ts`) — the **same template-style block** as above: fixed rules plus the **test_parameters** (and schema marker) dynamics; this is the direct successor to the old monolithic shared instructions.

**Takeaway for prompt work:** Anything that depended on **counts, difficulty, time, coverage, intent, schema_version** was always **system-interpolated**. **Subject-specific** tone and **explicit subject/grade in the system string** are the **new** layer; the user JSON still carries full subject, topics, and grounding.

---

## 3. Entry points (same pipeline)

| Path | Notes |
|------|--------|
| Server action `generatePracticeTest` | `app/student/practice/actions/generate-practice-test.ts` — calls `runPracticeGenerationAfterResolve` with `useStreamObject: false`. |
| `POST /api/student/practice/generate-stream` | `app/api/student/practice/generate-stream/route.ts` — only active when `PRACTICE_STREAM=true`; same pipeline with `useStreamObject: true` and NDJSON partials. |

Both run **one** generation pass through `runPracticeGenerationAfterResolve` (no duplicate model charge between action and stream).

---

## 4. Step-by-step server flow

1. **Parse input** — `finalizePracticeConfigSchema`: `subjectId`, `trackerIds` (topic tracker UUIDs), `difficulty` (`easy` \| `medium` \| `hard`), `durationSeconds` (`3600` or `10800` only).

2. **Preflight** — `preflightPracticeGeneration`:
   - Generation **rate limit** (`consumeGenerationRateLimit`).
   - **Billing / quota** (`preflightPracticeTestQuota`) for authenticated user.
   - **Resolve config** — `resolvePracticeConfigForStudent`: enrollment, subject row (name, **curriculum grade** `subjectGrade`, **`subjectGroup`** for prompt routing), canonical topics + performance, optional **`recentErrors`** (missed concepts).

3. **Plan questions from duration** — `getPracticeQuestionPlan(durationSeconds)` → fixed **total** and **per-type counts** (see §6).

4. **Load topic context** — `fetchTopicContextChunksByTopicIds` (service role) → per-topic `content` / `exercise` chunk lines, with **char/chunk limits** and optional `truncated` / empty-chunk analytics.

5. **Build user payload** — `buildPracticeUserMessage` → `PracticeUserMessagePayload` (`schema_version: 3`, `intent: "generate_practice_test"`), then **`stringifyPracticeUserMessageForModel`** (drops internal `grounding_meta.fetch_error` if present).

6. **Build system prompt** — `buildPracticeSystemPrompt`:
   - **Subject routing** from `resolvePracticeGenerationSubjectRouting(subjectGrade, studentGrade, subjectGroup, subjectName)` → **band** `6_10` vs `11_12` and **category** (e.g. `science`, `physics`, `default`).
   - **Preamble** — `getPracticeGenerationSubjectPreamble` (CBSE/NCERT role + subject line + “strict JSON” task).
   - **Shared rules** — `buildPracticeGenerationSharedSystemInstructions` (grounding, counts, Bloom, coverage, safety, **illustrative** JSON shape, schema marker line).

7. **Call model (structured output)** — `runModelOnce`:
   - Vercel AI SDK: **`generateObject`** or **`streamObject`** with a **Zod** schema from `createPracticeGenerationOutputSchema(expectedTypeCounts)` (exact array **lengths** per bucket).
   - **No explicit `temperature`** in code — model default applies.

8. **Transform** — `flattenPracticeGenerationOutput` — round-robins MCQ → fill → short → long to assign `question_number` and a flat `questions[]`.

9. **Validate and strip** — `validateAndStripGeneration`:
   - Exact question count, **allowed `topic_id` set**, MCQ A–D + letter answer, non-MCQ must not carry options, **≥2 distinct question types**, optional **per-type** and **time budget** checks, strips answer keys for the public return path used downstream for student-facing data (see function — it returns questions **without** answer keys in the public shape; full keys remain on the object used for DB insert in the pipeline).

10. **Retries** — `repeatPracticeAiResultUntilSuccessOrExhausted` — up to **`PRACTICE_AI_MAX_ATTEMPTS`** (1 + 5 user-facing retries) with exponential backoff (see §5).

11. **Optional dedup** — if embeddings find duplicates against the student, may **regenerate once** (bounded by `PRACTICE_DEDUP_MAX_REGENS`).

12. **Persist** — `practice_generate_test` RPC with questions + keys; then billing `consumeTest`; optional **embedding persistence** for future dedup.

---

## 5. Model API configuration (actual code)

| Setting | Value |
|--------|--------|
| Provider | `getOpenAIProvider()` from `@/lib/ai/openai-provider` (OpenAI via `@ai-sdk/openai`) |
| Model id | `getOpenAIChatModel()` → env **`OPENAI_CHAT_MODEL`**, or in non-production dev **`gpt-5.4-mini`** if unset; **production requires** `OPENAI_CHAT_MODEL` |
| API key | **`OPENAI_API_KEY`** (server-only) |
| Method | `generateObject` / `streamObject` from **`ai`** (Vercel AI SDK) |
| System | `system: systemPrompt` |
| User | `prompt: userPrompt` (stringified JSON + newline) |
| Schema | Zod from `createPracticeGenerationOutputSchema` — **enforces exact counts per `questions_by_type` bucket** |
| `maxOutputTokens` | `min(32000, max(6000, estimatedQuestionCount * 900))` |
| `maxRetries` | `2` (SDK-level retries on the API call) |
| `providerOptions.openai.strictJsonSchema` | `false` |

**Not set in code:** `temperature`, `top_p`, or penalties — if you need fixed sampling for reproducibility, that would be an explicit product/engineering change.

---

## 6. Duration → question counts (fixed)

| `durationSeconds` | Total questions | MCQ | Fill-in-blank | Short | Long |
|-------------------|-----------------|-----|----------------|------|------|
| 3600 (1h) | 15 | 5 | 5 | 3 | 2 |
| 10800 (3h) | 30 | 10 | 10 | 6 | 4 |

From `getPracticeQuestionPlan` in `src/lib/practice/constants.ts`. There are **no** “numerical”-only or other mix variants in the current self-practice generator.

---

## 7. Subject prompt routing (preambles)

**Band:**

- `11_12` if **curriculum** grade (`subjectGrade`) or **student** grade is 11–12; else `6_10`.

**Category** is resolved from `subject_group` (normalized) and fallbacks on **subject display name** (see `resolvePracticeGenerationSubjectRouting` in `generation-prompt-registry.ts`).

- **6–10:** e.g. `english`, `science`, `social_science`, `mathematics`, or **`default`**.
- **11–12:** e.g. `english`, `physics`, `chemistry`, `biology`, `mathematics`, `accountancy`, `business_studies`, `economics_statistics`, or **`default`**.

The **preamble** strings are the `PREAMBLES_6_10` / `PREAMBLES_11_12` records (Indian **CBSE/NCERT** framing). The closing line of the composed preamble states that the task is to output **one** practice test as **strict JSON** matching the contract in the instructions below.

---

## 8. User message payload (what the “user” turn contains)

High-level shape (`PracticeUserMessagePayload`):

- `schema_version`: **`3`**
- `intent`: **`"generate_practice_test"`**
- `student`: `grade`, optional `recent_errors` (topic-scoped missed concepts)
- `subject`: `id`, `name`
- `topic_grounding[]`: per topic: `topic_id`, `topic_name`, `curriculum_hint` (unit/chapter/grade), `content_chunks[]`, `exercise_chunks[]` (each line: `text`, `source_ref`)
- `grounding_meta`: counts, char totals, `truncated` (and `fetch_error` may exist server-side but is **stripped** for the model)
- `test_parameters`: difficulty, time limit, estimated count, topic count, **coverage_mode** + **coverage_instruction** (from `coverageModeAndInstruction` in `user-message.ts`), **question_type_counts**, `note`, **`generation_instruction`**
- `topics[]`: per-topic **performance** only (status, scores, trend, etc.)
- `constraints`: allowed question types; **`pedagogy`** (long string of instructional constraints)

**Coverage modes** (derived from `topicCount` vs `estimated_question_count`):

- **`few_topics`**: more questions than topics — reuse `topic_id`s, escalate demand within a topic.
- **`many_topics`**: more topics than questions — prioritize weaker areas; some topics may get zero items; explain in `adaptation_rationale`.
- **`balanced`**: align counts — fair spread with weakness weighting when data exists.

**Default directive** (`GENERATION_DIRECTIVE_INSTRUCTION`): generate **original** practice aligned to curriculum + exercise-style refs; **do not copy** exercise chunk wording verbatim.

The user turn is **pretty-printed JSON** with a trailing newline via `stringifyPracticeUserMessageForModel`.

---

## 9. Shared system instructions (summary)

`buildPracticeGenerationSharedSystemInstructions` encodes (non-exhaustive):

- Use **`topic_grounding`** as primary factual basis; do not invent off-curriculum except for coherent items.
- **Exact** total questions and **exact** per-type counts; buckets must match; **no** extra buckets.
- **Difficulty** calibration; **time limit** guidance for **sum** of `estimated_time_seconds`.
- **Bloom**-style levels; **progression** within the test when possible.
- **Topic coverage** rules from `coverage_mode` / `coverage_instruction`; every `topic_id` must be from the user message; rules for `recent_errors` biasing.
- **MCQ**: options **A–D** only; `correct_answer` a single letter.
- **fill_in_blank** / **short_answer** / **long_answer** shape expectations.
- **Explanations** in `answer_key` should teach (steps, mistakes, related concept).
- **Safety**: no PII, profanity, stereotypes.
- **Output**: JSON only — **no** markdown fences, no extra commentary.
- Ends with: `Schema marker: intent=…, schema_version=…`

The full text including the **illustrative** JSON example lives in `system-prompt.ts`.

---

## 10. Validation rules the code enforces (must align with any prompt change)

After flattening, `validateAndStripGeneration` (see `generation-schema.ts`):

- **Question count** equals expected.
- **`topic_id`** must be in the allowed set (UUID normalization: IDs compared lowercased, then **canonical** id restored).
- **MCQ**: options must include **A–D**; `correct_answer` must be a **single letter** A–D matching an option (normalized to uppercase).
- **Non-MCQ** must not include option maps.
- At least **two** distinct **question** types in the test.
- If `expectedTypeCounts` passed: per-type tallies must match.
- **Time sum**: if `expectedDurationSeconds > 0` and `totalTime > 0`, sum must fall in **\[0.6 × target, 1.2 × target\]** (i.e. **60%–120%** of the configured duration seconds).

**Note:** The shared system text asks the model to keep the sum **within ±20%** of the time limit, which would imply **roughly 80%–100%** if read literally as a symmetric band around 100%. The **validator** uses **60%** as the lower bound. If you edit prompts, consider aligning the **wording** with this **60%–120%** window (or change the code) to avoid unnecessary retries.

---

## 11. Environment variables (generation-related)

| Variable | Role |
|----------|------|
| `OPENAI_API_KEY` | Required; OpenAI key |
| `OPENAI_CHAT_MODEL` | Required in **production**; dev fallback `gpt-5.4-mini` if unset |
| `PRACTICE_STREAM` | `true` enables `generate-stream` route |
| `PRACTICE_DEDUP_MAX_REGENS` | Max regeneration attempts when near-duplicate questions detected (default from code: `1`) |
| `PRACTICE_TOPIC_CONTEXT_*` | Optional overrides for chunk/char limits (see `getTopicContextLimitsFromEnv` and `.env.example`) |

Other practice-related flags in `.env.example` (e.g. `PRACTICE_PROMPT_PREVIEW`, `PRACTICE_SYNC_GRADING`) affect **UI or grading**, not the core **generation** model call.

---

## 12. Checklist for external prompt authoring (e.g. Claude)

When rewriting **preambles** or **shared system instructions**, preserve or explicitly reconcile:

1. **Output contract**: grouped `questions_by_type` with **exact** lengths per `getPracticeQuestionPlan` for 1h/3h; then downstream flatten/numbering.
2. **Topic IDs**: only UUIDs from the user payload; no invented topic ids.
3. **MCQ** letter and option shape; **non-MCQ** without options.
4. **Grounding** priority vs **recent_errors** biasing.
5. **Time sum** band as **enforced in code** (60%–120% of `time_limit_seconds` when validation applies).
6. **JSON only** — no markdown wrapping.
7. **Safety** and **non-copy** of exercise text verbatim.
8. **Schema marker** line if downstream tooling depends on it (currently encodes `intent` and `schema_version`).
9. **Historical clarity:** The **shared** block has long interpolated **counts, difficulty, time, coverage, intent, schema_version** (see §2). The **preamble** layer adds **subject/grade/band** in the **system** string — do not drop those dynamics when editing one half in isolation.

This document is descriptive only; change **code** if you need behavior that differs from what is written here.
