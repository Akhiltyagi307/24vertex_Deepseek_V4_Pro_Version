-- Closed learning loop — Phase 2 staged-rollout cohort gate. Idempotent; apply
-- to BOTH projects (canary ezxmjkvhrlqeimhnfvfd + EDU_AI suwakggcbxmmvqzeudmq).
--
-- Two tunable knobs under the global review_scheduler_enabled() kill-switch.
-- Flip with CREATE OR REPLACE (no schema change), mirroring the kill-switch.
-- Defaults = NOBODY, so the loop stays dormant even if enabled() is true, until
-- a cohort is deliberately populated (defense in depth for the staged go-live).
--
-- Go-live sequence:
--   1. (optional) add a pilot org:  CREATE OR REPLACE ... review_scheduler_cohort_org_ids() ... SELECT ARRAY['<org-uuid>']::uuid[]
--   2. or set a small percentage:   CREATE OR REPLACE ... review_scheduler_rollout_pct() ... SELECT 10
--   3. ensure review_scheduler_enabled() returns true + schedule the nightly cron
--   4. widen the percentage 10 -> 50 -> 100 as confidence grows

-- Rollout percentage (0–100); 0 = no percentage-based rollout.
CREATE OR REPLACE FUNCTION public.review_scheduler_rollout_pct()
RETURNS integer LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$ SELECT 0 $$;

-- Explicit org allowlist (pilot schools always included). Default empty.
CREATE OR REPLACE FUNCTION public.review_scheduler_cohort_org_ids()
RETURNS uuid[] LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$ SELECT ARRAY[]::uuid[] $$;
