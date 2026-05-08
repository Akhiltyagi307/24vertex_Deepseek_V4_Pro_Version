-- Eval-run history for the practice prompt fixture system.
--
-- Why this table exists:
--   The Tier 2 LLM eval runner (`src/lib/practice/__evals__/runner.ts`) runs
--   real model calls against canonical fixtures and produces a pass/fail
--   summary. Today the runner is invokable via CLI (`pnpm run evals:practice`)
--   and writes JSON files to `evals/runs/`. To surface results in the admin
--   dashboard and persist history beyond the local filesystem, we record each
--   run + per-fixture results here.
--
-- Two-table layout:
--   `eval_runs`         — one row per run (the summary the dashboard list page
--                          shows, plus enough metadata to reproduce: model,
--                          filter, prompt version exercised).
--   `eval_run_results`  — one row per fixture in that run (drilldown content).
--
-- Why two tables vs. one with JSONB results:
--   - The dashboard list page reads only the summary columns; pulling the
--     per-assertion JSON for every list-page paint would be wasteful.
--   - We want indexes on fixture_id (cross-run trend lookups) and a fast
--     "regressions vs the previous run" diff query, both of which need a
--     normalised row per fixture.
--
-- RLS: service-role-only. Admin routes go through service-role; this table
-- is not student-facing. (Same pattern as cron_run_log.)
--
-- Retention: not auto-pruned. Each run is ~10–30 KB of JSONB; weekly cron
-- gives ~1.5 MB/year. Add a periodic prune later if/when this becomes
-- meaningful.

create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),

  -- Who/what triggered the run. Free-form text since admin auth uses
  -- session JTIs (not profiles.id):
  --   'cron'        — scheduled GitHub Actions weekly run
  --   'admin:<jti>' — manually triggered via /admin/ai/evals dashboard
  --   'cli'         — local pnpm run evals:practice (only when persisted)
  -- NULL = unknown / legacy.
  triggered_by text,
  triggered_at timestamptz not null default now(),
  completed_at timestamptz,

  -- Lifecycle status:
  --   'running'   — row inserted, runner has not yet finished.
  --   'complete'  — runner finished (regardless of pass-rate; check `failed`).
  --   'failed'    — runner errored out before producing a summary
  --                 (e.g. OPENAI_API_KEY missing, network failure).
  status text not null
    check (status in ('running', 'complete', 'failed'))
    default 'running',

  -- The fixture filter used (subject key, fixture id, prefix, or 'all').
  -- Free-form to match the runner's loose filter semantics.
  filter text not null default 'all',

  -- Snapshot of the model used. Stored so historical comparisons stay
  -- meaningful even when env changes upstream.
  model text not null,

  -- Optional: the ai_prompts row this run exercised. NULL when running
  -- against the file-default / active prompts.
  prompt_id uuid references public.ai_prompts(id) on delete set null,

  -- Denormalised summary (matches the EvalRunSummary shape in
  -- src/lib/practice/__evals__/runner.ts). Lets the list page render
  -- without joining eval_run_results.
  total_fixtures integer,
  passed integer,
  failed integer,
  schema_invalid integer,
  total_assertions integer,
  passed_assertions integer,
  total_input_tokens integer,
  total_output_tokens integer,
  total_latency_ms integer,

  -- Free-form note from the operator who triggered the run (e.g.
  -- "before activating prompt v7", "weekly cron", etc.)
  notes text,

  -- Top-level error string when status='failed'.
  error text,

  created_at timestamptz not null default now()
);

create index if not exists eval_runs_triggered_at_idx
  on public.eval_runs (triggered_at desc);

create index if not exists eval_runs_prompt_id_idx
  on public.eval_runs (prompt_id)
  where prompt_id is not null;

create index if not exists eval_runs_status_idx
  on public.eval_runs (status, triggered_at desc)
  where status <> 'complete';

alter table public.eval_runs enable row level security;

comment on table public.eval_runs is
  'Practice prompt eval-run summary. Service-role only; populated by the admin /api/admin/ai/evals/run route and the GitHub Actions weekly cron.';

create table if not exists public.eval_run_results (
  id uuid primary key default gen_random_uuid(),
  eval_run_id uuid not null
    references public.eval_runs(id) on delete cascade,

  -- Fixture id is kebab-case authored in code (e.g.
  -- "math-6-10-grade-8-medium-12q"), not a UUID. text not uuid.
  fixture_id text not null
    check (char_length(fixture_id) between 1 and 200),
  subject text not null
    check (char_length(subject) between 1 and 64),

  pass boolean not null,
  schema_valid boolean not null,

  latency_ms integer,
  input_tokens integer,
  output_tokens integer,

  -- Per-assertion results: array of
  --   { pass: boolean, assertion: { type: string, ...params }, reason?: string }
  -- Stored as JSONB so the assertion-type taxonomy can evolve without a
  -- migration each time we add a new check.
  output_results jsonb not null,

  -- Top-level error from runner (e.g. "Model output is not parseable JSON").
  error text,

  created_at timestamptz not null default now()
);

create index if not exists eval_run_results_run_idx
  on public.eval_run_results (eval_run_id);

create index if not exists eval_run_results_fixture_idx
  on public.eval_run_results (fixture_id, created_at desc);

alter table public.eval_run_results enable row level security;

comment on table public.eval_run_results is
  'Per-fixture results within an eval run. Service-role only; populated alongside eval_runs.';
