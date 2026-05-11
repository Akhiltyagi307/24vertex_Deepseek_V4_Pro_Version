# Visuals eval fixtures

Drop JSON files of the shape `PracticeGenerationOutput["questions"][number]`
into `<subject>/` directories here. The eval script (`pnpm eval:visuals`, runs
`tsx scripts/eval-visuals.ts`) scores every fixture using `stemNeedsVisualHint`
from `src/lib/practice/visuals/stem-visual-hints.ts` — **keep that module aligned
with** `practice-generation-quality-gates.ts` when changing deictic rules.

Criteria:

1. **visual_when_needed** — stem mentions a figure/diagram/etc. ⇔ visual is non-null.
2. **spec_valid** — visual envelope (when present) parses against the schema.
3. **renders** — spec passes the renderer's preconditions (range > 0, at
   least one primitive, valid SMILES/mhchem etc.).
4. **stem_self_contained** — when visual is null, the stem must **not** match
   `stemNeedsVisualHint` (explicit stimulus cues such as “the diagram”, “shown below”, etc.,
   but **not** bare MCQ boilerplate like “options below”).
5. **caption_alt_substantial** — when visual is non-null, `caption` and
   `altText` each have at least three words.
6. **visual_anti_spoiler** — `caption`/`altText` must not use banned answer
   phrases or repeat the keyed answer / correct option text unless it also
   appears in the stem.

## Folder layout

```
tests/eval-visuals/fixtures/
├── mathematics/
│   ├── slope_of_segment_AB.json
│   └── parabola_x_squared_minus_4.json
├── physics/
├── chemistry/
├── accountancy/
├── economics_statistics/
└── science/
```

Each JSON file should be the JSON representation of one element of
`PracticeGenerationOutput["questions"]`, ie an object with `question_text`,
`question_type`, `topic_id`, `topic_name`, `difficulty_level`,
`estimated_time_seconds`, `answer_key`, `options` (or `null`), and
`visual` (envelope or `null`).

## Threshold

`pnpm eval:visuals` exits non-zero when any subject's pass rate drops
below `PRACTICE_VISUALS_EVAL_THRESHOLD` (default `0.9`). Set the env var
to tune locally, e.g.:

```sh
PRACTICE_VISUALS_EVAL_THRESHOLD=0.85 pnpm eval:visuals
```

## How to populate

The intended workflow:

1. Run a `PRACTICE_VISUALS=true` generation against each subject (~30 questions).
2. Save the validated `PracticeGenerationOutput.questions` array.
3. Save each element as a separate JSON file under the matching
   subject directory.
4. Rerun `pnpm eval:visuals`.
5. Tune the discipline section / preamble / exemplars until each
   subject sits above 90%.

Once the per-subject rate clears 90%, flip `PRACTICE_VISUALS=true` in
production for that subject in `PRACTICE_VISUALS_SUBJECTS` (or in the
single boolean once we move past the gate, per the delivery plan §A1).
