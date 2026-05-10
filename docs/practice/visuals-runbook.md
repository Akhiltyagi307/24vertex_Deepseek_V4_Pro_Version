# Practice visuals — operations runbook

Companion to `docs/EDU-AI-VISUALS-GUIDE-V2.md`. The guide is the design;
this file is the operational checklist for rolling out, tuning, and
rolling back the structured-visual feature.

## TL;DR

Three env vars, all default off:

| Env var | Default | Effect |
|---|---|---|
| `PRACTICE_VISUALS` | `false` | Master switch. When false, system prompt forces `visual: null` on every question. |
| `PRACTICE_VISUAL_VALIDATOR` | `false` | Pass-2 validator (OpenAI Skills + shell tool). Currently a placeholder; flipping is a no-op until the integration lands. |
| `PRACTICE_VISUAL_VALIDATOR_MODEL` | _(unset)_ | Optional explicit model for Pass 2. Falls back to `getOpenAIPracticeChatModel()`. |

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
   - **Visual emitted on a non-load-bearing stem** → strengthen the discipline section's T1/T2/T3 wording, or add a null-visual exemplar for that subject in `src/lib/practice/visuals/exemplars.ts`.
   - **Stem references "the figure" but visual is null** → quality gate already catches this. Failure surfaces in eval as `visual_when_needed`. Fix the per-subject preamble to push the right kind for that topic.
   - **Spec invalid (Zod parse fail)** → check `practice-generation-pipeline.ts` autofix; check schema in `src/lib/practice/visuals/schemas.ts`.
   - **Renders fail** → run `pnpm exec vitest run tests/components/practice/visuals-renderers.test.tsx` against the fixture; check the renderer for the spec's kind.
   - **Stem refers to "above/below" with no visual** → this is the Goal-A "self-contained stem" check; fix the preamble or the stem itself.
5. When every subject ≥ 90%, set `PRACTICE_VISUALS=true` in production env. Bump `PRACTICE_PROMPT_REVISION` if you also touched the prompt.

## Per-subject toggle (when needed)

The current implementation uses a single boolean (`PRACTICE_VISUALS=true|false`) per delivery plan §A1. If a subject is consistently lagging, you have three options:

1. **Stay off everywhere** until that subject clears 90%. (Default.)
2. **Patch the prompt** to bias that subject toward `visual: null` (so emission never triggers Goal-A failure modes there) without changing other subjects.
3. **Reverse §A1** and introduce a per-subject env list (`PRACTICE_VISUALS_SUBJECTS=mathematics,accountancy,…`). This is a real code change, not a config flip; document it in a follow-up PR.

## Pass 2 (validator) rollout

Pass 2 is best-effort polish — it never blocks Pass 1 from shipping. Recommended sequencing:

1. Set `PRACTICE_VISUAL_VALIDATOR_MODEL` to your chosen Pass-2 model id.
2. Wire the placeholder in `src/lib/practice/visuals/run-validator-pass.ts` to the actual `generateText({ model: openai.responses(...), providerOptions: { openai: { tools: [{ type: "shell", environment: { type: "container_auto", skills: VALIDATOR_SKILL_REFS } }] } } })` call (see v2 visuals guide §3.4).
3. Run `pnpm node scripts/sync-openai-skills.mjs` to verify the lockfile hashes match local files. Re-pin with `SKILLS_LOCK_PIN=true` if needed.
4. Push to staging with `PRACTICE_VISUAL_VALIDATOR=true` and watch Sentry for `runValidatorPass.invoke` errors. Pass 1 still ships even when Pass 2 throws.
5. Once stable, flip in production.

## Rollback

In order of preference (least disruptive first):

1. **Flip `PRACTICE_VISUAL_VALIDATOR=false`** — keeps the structured visuals but disables the (optional) Pass-2 polish.
2. **Flip `PRACTICE_VISUALS=false`** — system prompt forces `visual: null` on every new generation. Existing tests in the DB are unaffected; the renderer continues to serve their stored visuals through the `metadata.visual` read path. Set this when a renderer regression appears or when generation quality drops below threshold.
3. **Revert the renderer plumbing** — only needed if a renderer crashes the page despite the safe parser. The renderer dispatcher is at `src/components/student/practice/visuals/question-visual.tsx`. Replacing the renderer body with `return null` for the affected kind disables it without touching the schema.
4. **Revert the schema change** — `src/lib/practice/generation-schema.ts` `visual: questionVisualEnvelopeSchema.nullable()`. Removing the field requires re-deploying generation; legacy `metadata.visual` blobs are ignored by the safe parser, so it's safe.

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
