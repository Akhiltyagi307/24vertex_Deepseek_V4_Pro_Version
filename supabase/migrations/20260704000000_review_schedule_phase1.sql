-- Closed learning loop — Phase 1 foundation.
-- Persist a per-(student, topic) spaced-repetition review schedule, advanced on
-- every graded test. Idempotent; apply to BOTH Supabase projects via MCP
-- (canary ezxmjkvhrlqeimhnfvfd + EDU_AI suwakggcbxmmvqzeudmq), then capture here.
-- Spec: docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §5–§6.

-- 1. Schedule columns on the existing per-(student, topic) tracker row.
ALTER TABLE public.performance_tracker
	ADD COLUMN IF NOT EXISTS next_review_at timestamptz,
	ADD COLUMN IF NOT EXISTS review_interval_days integer,
	ADD COLUMN IF NOT EXISTS review_ease numeric(3,2),
	ADD COLUMN IF NOT EXISTS consecutive_good integer NOT NULL DEFAULT 0;

-- 2. Partial index so the Phase 2 nightly selector is a cheap lookup, not a scan.
CREATE INDEX IF NOT EXISTS idx_perf_next_review
	ON public.performance_tracker (next_review_at)
	WHERE next_review_at IS NOT NULL;

-- 3. Kill-switch / staged-rollout gate (mirrors streak_freeze_enabled()).
--    Flip with CREATE OR REPLACE returning false; no schema change.
CREATE OR REPLACE FUNCTION public.review_scheduler_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$ SELECT true $$;

-- 4. Extend the bulk tracker RPC to persist the TS-computed schedule fields.
--    Signature is UNCHANGED (jsonb payload); the schedule is written only when
--    the caller supplied the keys (guarded by `elem ? 'consecutive_good'`).
CREATE OR REPLACE FUNCTION public.practice_update_trackers_bulk(
	p_student_id uuid,
	p_subject_id uuid,
	p_current_test_id uuid,
	p_now timestamptz,
	p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	elem jsonb;
BEGIN
	IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
		RETURN;
	END IF;

	FOR elem IN SELECT t.x FROM jsonb_array_elements(p_items) AS t(x)
	LOOP
		IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
			CONTINUE;
		END IF;
		IF elem->>'topic_id' IS NULL OR elem->>'average_score' IS NULL THEN
			CONTINUE;
		END IF;

		PERFORM public.practice_update_tracker_running(
			p_student_id,
			p_subject_id,
			(elem->>'topic_id')::uuid,
			p_current_test_id,
			(elem->>'average_score')::numeric,
			COALESCE((elem->>'n_incorrect')::int, 0),
			p_now::timestamp
		);

		-- Closed-learning-loop: persist the spaced-repetition schedule computed in
		-- TS (src/lib/practice/review-schedule.ts). Only when the caller supplied
		-- the keys, so replay/admin callers without them leave the schedule intact.
		-- A JSON null for next_review_at/interval/ease clears the column (graduation).
		IF elem ? 'consecutive_good' THEN
			UPDATE public.performance_tracker
			SET next_review_at = (elem->>'next_review_at')::timestamptz,
			    review_interval_days = (elem->>'review_interval_days')::int,
			    review_ease = (elem->>'review_ease')::numeric,
			    consecutive_good = COALESCE((elem->>'consecutive_good')::int, 0),
			    updated_at = p_now
			WHERE student_id = p_student_id
			  AND topic_id = (elem->>'topic_id')::uuid;
		END IF;
	END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO service_role;
