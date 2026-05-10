-- Drop the practice prompt eval-run history tables.
--
-- Why this migration exists:
--   The compact prompt rework + two-tier eval system shipped in #57
--   (`20260601000000_eval_runs.sql`) was reverted in PR #57+#59 because
--   the change set is being rolled back. The two tables created by that
--   migration (`eval_runs`, `eval_run_results`) are now orphaned in dev
--   and production Supabase — the code that wrote to them no longer
--   exists. This migration removes them so the database matches the
--   reverted code state.
--
-- Idempotency:
--   `drop ... if exists` so this is safe to apply on:
--     - dev + production Supabase, where the tables currently exist
--     - any fresh bootstrap, where the create migration is absent (also
--       deleted by the revert) and the tables were never made
--
-- Cascade behaviour:
--   `eval_run_results` has a FK to `eval_runs` with `on delete cascade`,
--   so we drop it first to be explicit. `eval_runs` itself has a FK to
--   `ai_prompts` (set null on delete) — `ai_prompts` is unaffected by
--   this drop.
--
-- RLS / policies:
--   The original migration only ran `enable row level security` and did
--   not create any policies, so there is nothing extra to clean up
--   beyond the tables themselves; their indexes drop automatically.

drop table if exists public.eval_run_results;
drop table if exists public.eval_runs;
