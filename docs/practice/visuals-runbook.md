# Practice visuals — operations runbook

Companion to `docs/EDU-AI-VISUALS-GUIDE-V2.md`. The guide is the design;
this file is the operational checklist for rolling out, tuning, and
rolling back the structured-visual feature.

## TL;DR

Core env vars:

| Env var | Default | Effect |
|---|---|---|
| `PRACTICE_VISUALS` | `false` | Master switch. When false, system prompt forces `visual: null` on every question. |
| `PRACTICE_VISUAL_TEMPLATE_ENGINE` | `false` | Routes visual kind policy through the typed subject/topic template catalog. Keep off for shadow comparison; flip after eval and renderer checks pass. |
| `PRACTICE_VISUAL_VALIDATOR` | `false` | Pass-2 deterministic validator pass (schema/semantic/grounding checks) before persistence. |
| `PRACTICE_VISUAL_VALIDATOR_MODEL` | _(unset)_ | Optional explicit model for Pass 2. Falls back to `getOpenAIPracticeChatModel()`. |
| `PRACTICE_VISUAL_STEM_GROUNDING` | `off` | Stem↔visual literal grounding mode: `off`, `shadow` (log only), `enforce` (null mismatches). |
| `PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE` | `2` | Candidate count per enrichment call (`1..6`). Higher values can improve coverage at higher token cost. |

Always-on knobs (no flag):
- All 11 renderers ship in the bundle but load via `next/dynamic({ ssr: false })` per renderer file. A math-only session does NOT pull plotly / smiles-drawer / mermaid.
- `metadata.visual` is read on every practice page via `parseStoredQuestionVisualFromMetadata`. Bad envelopes log+drop instead of crashing.
- Visual quality gates run after autofix + Pass-1 validation. They only fire when the model emits a non-null visual, so they're harmless when `PRACTICE_VISUALS=false`.

## Phase-2 rollout (pre-flip)

1. Generate ~30 reference questions per subject with `PRACTICE_VISUALS=true` set in your local `.env.local`. Subjects:
   - Mathematics 6–10
   - Mathematics 11–12
   - Accountancy 11–12
   - Economics / Statistics 11–12
   - Science 6–10
2. Save each generated question's flat JSON under
   `tests/eval-visuals/fixtures/<subject>/<short_name>.json`.
3. `pnpm eval:visuals`. If any subject's pass rate is below 90%, **don't flip yet**.
4. Common fix paths:
   - **Visual density is too low** → check `src/lib/practice/generation-prompt-registry.ts` for subject preamble wording that still pushes broad `visual: null` defaults. The shared Visuals section is the source of truth when `preferred_kinds` is non-empty and `max_non_null_visuals` is non-zero.
   - **Visual is valid but noisy/decorative** → add or move up a cleaner exemplar in `src/lib/practice/visuals/exemplars.ts`, preferably a compact `data_table`, `number_line`, or renderer-specific stimulus that mirrors the subject's expected shape.
   - **Stem references "the figure" but visual is null** → quality gate already catches this. Failure surfaces in eval as `visual_when_needed`. Fix the per-subject preamble to push the right kind for that topic, or rewrite the stem so it does not imply a missing stimulus.
   - **Visual label mismatch / caption leaks answer** → keep minimal visuals sparse, remove answer-bearing text from `caption` / `altText`, and ensure every stem label appears in `visual.spec`.
   - **Spec invalid (Zod parse fail)** → check `practice-generation-pipeline.ts` autofix; check schema in `src/lib/practice/visuals/schemas.ts`.
   - **Renders fail** → run `pnpm exec vitest run tests/components/practice/visuals-renderers.test.tsx` against the fixture; check the renderer for the spec's kind.
5. For template-engine rollout, run the same fixtures twice: once with `PRACTICE_VISUAL_TEMPLATE_ENGINE=false` (legacy enrichment) and once with `PRACTICE_VISUAL_TEMPLATE_ENGINE=true` (template policy). Only flip the template engine when every subject stays ≥ 90%.
6. When every subject ≥ 90%, set `PRACTICE_VISUALS=true` in production env. Set `PRACTICE_VISUAL_TEMPLATE_ENGINE=true` only after the shadow comparison is clean. Bump `PRACTICE_PROMPT_REVISION` if you also touched the prompt.

## Schema additions (2026-05 overhaul)

When validating generated visuals or manually authoring fixtures, these fields are now available and expected in upgraded exemplars:

- `math_geometry`: `point.labelPosition`, `segment.tickMarks`, `segment.arrowEnd`, `polygon.vertexLabels`, `arc.radiusFraction`.
- `math_function_plot`: `xTickStep`, `yTickStep`.
- `number_line`: `axisLabel`, `minorTickStep`.
- `physics_diagram.free_body`: `forces[].unit`, `forces[].showMagnitude`, `forces[].componentArrows`, plus `inclineLabel`, `surfaceHatched`, `axisLegend`.
- `physics_diagram.ray_optics`: `axisUnit`, `axisTickStep`, `axisMajorTickStep`, `drawRays`, `objects[].label`, `lenses[].label`.
- `physics_diagram.circuit`: `components[].currentArrow`, `battery.polarityMarks`.
- `economics_curve`: `marks[].kind` (`point` or `vertical_line`).
- `chemistry_molecule`: `display` is constrained to `2d` (no `3d` fixture values).
- Template-engine families: `biology_diagram`, `flowchart`, `timeline`, `source_extract`, `map_visual`, `chemistry_cell_diagram`, `physics_field_diagram`, and `physics_wave_diagram`.

## Manual screenshot checklist (PR verification)

After `pnpm dev` with `PRACTICE_VISUALS=true`, capture at least one screenshot per renderer kind:

- `math_geometry`: labelled points + angle arc + tick-marked segment.
- `math_function_plot`: multi-item legend visible; tick-steped axes when configured.
- `number_line`: axis label and minor ticks visible.
- `physics_diagram/free_body`: force magnitudes+units, axis legend, incline hatch + angle.
- `physics_diagram/ray_optics`: axis unit labels, focal labels, and ray traces.
- `physics_diagram/circuit`: synthesized component values, polarity marks, current arrow.
- `chemistry_molecule` + `chemistry_reaction`: molecule/reaction labels readable.
- `statistics_chart`: bar value labels, line legend, pie percentages.
- `economics_curve`: point callout marks and vertical-line marks both represented.
- `accountancy_table`, `data_table`, `english_passage`, `india_map`: one representative each.
- Template families: biology pedigree/structure, business flowchart, history timeline, social-science source extract, geography map visual, chemistry cell, physics field lines, and physics wave.

## Per-subject toggle (when needed)

The current implementation uses a master boolean (`PRACTICE_VISUALS=true|false`) plus an optional CSV allowlist (`PRACTICE_VISUALS_SUBJECTS=Mathematics,Accountancy`). If a subject is consistently lagging, you have three options:

1. **Stay off everywhere** until that subject clears 90%. (Default.)
2. **Use `PRACTICE_VISUALS_SUBJECTS`** to roll out only subjects whose renderers and prompts are passing eval.
3. **Patch the prompt or exemplar mix** for the lagging subject. Keep the shared policy as "maximize faithful non-null visuals"; do not reintroduce broad null defaults except for hard renderer/safety facts.

## Stem-grounding rollout

Use staged rollout for literal grounding so coverage and fidelity stay balanced:

1. Keep `PRACTICE_VISUAL_STEM_GROUNDING=off` while shipping prompt changes.
2. Move to `shadow` in staging/limited prod and monitor `practice_generation_validator_pass` telemetry (`grounding_mismatched_visuals`).
3. Move to `enforce` once mismatch rate stabilizes and `pnpm eval:visuals` remains above threshold.
4. If density drops below target in enforce mode, increase `PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE` gradually (2 → 3 → 4) and re-run eval.

## Rollback

In order of preference (least disruptive first):

1. **Flip `PRACTICE_VISUAL_VALIDATOR=false`** — keeps the structured visuals but disables the (optional) Pass-2 polish.
2. **Flip `PRACTICE_VISUAL_TEMPLATE_ENGINE=false`** — returns generation to the legacy subject-kind policy while keeping the existing visuals feature enabled.
3. **Flip `PRACTICE_VISUALS=false`** — system prompt forces `visual: null` on every new generation. Existing tests in the DB are unaffected; the renderer continues to serve their stored visuals through the `metadata.visual` read path. Set this when a renderer regression appears or when generation quality drops below threshold.
4. **Revert the renderer plumbing** — only needed if a renderer crashes the page despite the safe parser. The renderer dispatcher is at `src/components/student/practice/visuals/question-visual.tsx`. Replacing the renderer body with `return null` for the affected kind disables it without touching the schema.
5. **Revert the schema change** — `src/lib/practice/generation-schema.ts` `visual: questionVisualEnvelopeSchema.nullable()`. Removing the field requires re-deploying generation; legacy `metadata.visual` blobs are ignored by the safe parser, so it's safe.

## Telemetry

Every visual-related step records a Sentry breadcrumb:

- `generatePracticeTest.qualityGate` — visual quality gate failure (offending question count + gate code).
- `runValidatorPass.invoke` — Pass-2 invocation error.
- `practice_generation_visual_patches_applied` — Pass-2 patches applied (with applied/candidates counts).
- `PracticeSessionPage.parseStoredVisual` — bad stored envelope dropped during render.

When debugging a single test, query `practice_generation` correlation IDs in Sentry and look for these breadcrumbs in the trail.

## DB notes (Supabase dev + main parity)

`questions.metadata` is a JSONB column already in production (see `supabase/migrations/20260412000001_eduai_pdr_v3_core.sql:189`). The visuals work uses `metadata->'visual'` and does NOT add a migration in v1.

When promoting `metadata.visual` to a typed column in Phase 4, the migration must apply to **both** Supabase dev AND main per the project rule. Reference: `.cursor/rules/supabase-dev-main-sync.mdc`.
