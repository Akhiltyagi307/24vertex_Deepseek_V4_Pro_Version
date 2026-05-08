# Practice prompt evaluator (Tier 2)

This directory holds the **opt-in, LLM-based** eval runner for the
practice-generation prompts. It's the counterpart to the **Tier 1** CI fixture
runner at [`src/lib/practice/__tests__/fixture-tier1.test.ts`](../__tests__/fixture-tier1.test.ts).

| Tier | Where | LLM cost | Runs in CI? | Catches |
|------|-------|----------|-------------|---------|
| 1 — structural | `__tests__/fixture-tier1.test.ts` | Free | Yes | Prompt-source drift (worked example removed, count interpolation broken, persona regressed, load-bearing rule deleted) |
| 2 — behavioural | `__evals__/runner.ts` | Real `$$` | No | Model-output regressions (counts off, topic_id hallucination, schema invalid, MCQ option imbalance, time-budget violations, missing distractor anchors) |

## Running

The runner reads `OPENAI_API_KEY` and `OPENAI_CHAT_MODEL` from env. Load
`.env.local` manually:

```bash
# All fixtures (≈12 calls — cost depends on configured model)
tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts

# One subject (any of the kebab-case subject keys)
tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts physics-11-12

# One specific fixture by id
tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts math-6-10-grade-8-medium-12q

# Prefix match — runs all fixtures whose id starts with the prefix
tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts english-
```

Exit code: `0` if every fixture passes, `1` if any fail, `2` on usage error.

## Output

Each fixture prints:

```
✓ [PASS] math-6-10-grade-8-medium-12q  (2841ms; in=2,103 out=1,824 tokens)
    ✓ totalCountMatches
    ✓ perBucketCountsMatch
    ✓ topicIdsFromList
    ✓ noEmptyQuestions
    ✓ respectsTimeBudget
    ✓ hasAdaptationRationale
    ✓ mcqOptionsParity
```

A failing fixture shows the assertion + reason:

```
✗ [FAIL] biology-11-12-grade-12-with-dihybrid  (3214ms; in=2,490 out=2,103 tokens)
    ✓ totalCountMatches
    ✗ topicIdsFromList — 1 question(s) have topic_id outside the supplied list. First offender: "(missing)". Hallucinated topic_ids are a hard contract violation.
```

A schema-invalid fixture (model returned malformed JSON) shows:

```
✗ [INVALID] physics-11-12-grade-12-with-derivation  (4102ms; in=0 out=0 tokens)
    error: Model returned no structured output (schema validation failed).
```

## Adding fixtures

Fixtures live in [`src/lib/practice/__fixtures__/index.ts`](../__fixtures__/index.ts).
Each fixture declares:

- **input** — `userMessageSummary` + `generationSubject` (fed to `buildPracticeSystemPrompt`)
- **promptAssertions** — Tier 1 structural checks (substring, regex, length bounds, count interpolation)
- **outputAssertions** — Tier 2 behavioural checks (counts, topic_id provenance, time budget, MCQ parity, content keywords)

The minimum useful fixture has at least one assertion of each kind. Tier 1 also
validates this in [`fixture-tier1.test.ts`](../__tests__/fixture-tier1.test.ts).

## What this catches that the existing tests don't

The existing 170+ unit tests check:
- Prompt builders return strings containing certain substrings
- Routing maps subject names to the right builder

What they don't check:
- That a real model, fed a realistic input, produces output that satisfies
  the prompt's load-bearing rules. The Tier 2 runner catches:
  - **MCQ count drift** — model produces 5 MCQs when 6 were requested
  - **topic_id hallucination** — model invents a UUID not in `topics[]`
  - **MCQ option-length tells** — three short distractors + one long correct
    answer (the audit's distractor-parity rule)
  - **Time budget violations** — model assigns implausible
    `estimated_time_seconds` per question
  - **Empty `adaptation_rationale`** — under-specified output field
  - **Distractor anchor absence** — when a fixture asserts the output should
    mention a canonical misconception (via `outputMentions`), this catches
    drift in the worked-example anchoring

## When to run

- Before activating a new `ai_prompts` row in production (manual A/B comparison
  via the [admin /test endpoint](../../../app/api/admin/ai/prompts/[id]/test/route.ts)
  doesn't run output assertions; this does)
- After a substantive prompt edit (rule wording change, worked-example
  replacement, distractor-anchor list update)
- On a schedule (e.g. weekly) to detect upstream model drift

## Future work

- **Style-mirroring assertion** — compute vocabulary overlap between
  generated `question_text` and the supplied `topic_grounding` chunks.
  Currently the fixtures pass empty grounding, so this assertion type doesn't
  exist yet. When real-grounding fixtures are authored, add a `styleOverlap`
  assertion.
- **Sensitivity flagging** — for Social Science, scan output for
  inflammatory framing on Partition / Kashmir / Emergency topics. Requires a
  labelled keyword list.
- **Cost telemetry roll-up** — emit a JSON results file the admin can ingest
  into the existing `ai_calls` analytics.
