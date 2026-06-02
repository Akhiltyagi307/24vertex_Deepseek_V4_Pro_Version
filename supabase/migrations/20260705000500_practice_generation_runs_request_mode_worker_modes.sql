-- Widen practice_generation_runs.request_mode CHECK to include the worker modes
-- the app already passes (review finding: telemetry-CHECK gap).
--
-- The constraint was IN ('server_action','stream') only, but the review/assignment
-- background generators pass requestMode 'review_worker' / 'assignment_worker'.
-- Those run-telemetry inserts therefore violated the CHECK and, because
-- startGenerationRun is best-effort (it swallows the error and returns null),
-- failed SILENTLY — so review- and assignment-generated tests produced no
-- practice_generation_runs / _steps telemetry at all. The new set is a strict
-- superset of the old, so no existing row is affected.
--
-- (The student durable-generation worker deliberately uses 'server_action' and
-- needs no new value here.)
--
-- Apply identically to BOTH Supabase projects (canary + main).

BEGIN;

ALTER TABLE public.practice_generation_runs
	DROP CONSTRAINT IF EXISTS practice_generation_runs_request_mode_chk;
ALTER TABLE public.practice_generation_runs
	ADD CONSTRAINT practice_generation_runs_request_mode_chk
	CHECK (request_mode IN ('server_action', 'stream', 'assignment_worker', 'review_worker'));

COMMIT;
