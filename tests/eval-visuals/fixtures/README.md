# Visuals eval fixtures

Drop JSON files of the shape `PracticeGenerationOutput["questions"][number]`
into `<subject>/` directories here. The eval script
(`pnpm eval:visuals`) scores every fixture against the four-criterion
gate from §6 of the v2 visuals guide:

1. **visual_when_needed** — stem mentions a figure/diagram/etc. ⇔ visual is non-null.
2. **spec_valid** — visual envelope (when present) parses against the schema.
3. **renders** — spec passes the renderer's preconditions (range > 0, at
   least one primitive, valid SMILES/mhchem etc.).
4. **stem_self_contained** — when visual is null, the stem doesn't
   reference "above/below/shown" without a figure.

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
