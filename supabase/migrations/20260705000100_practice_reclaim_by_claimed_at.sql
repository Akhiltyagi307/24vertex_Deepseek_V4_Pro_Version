-- Practice-jobs reclaim now measures the lease from claimed_at, not updated_at
-- (review finding M1, part 1).
--
-- The grader writes per-chunk progress ("Graded N of M") to the SAME row, which
-- bumps updated_at on every chunk. Because reclaim keyed off updated_at, a job
-- making slow forward progress kept refreshing its own lease and could evade
-- reclaim indefinitely. claimed_at is stamped once at claim time and never
-- touched by progress writes, so the 12-minute lease is now measured from the
-- claim — a wedged worker's row is always reclaimable 12 minutes after it was
-- claimed, regardless of progress chatter.
--
-- (Part 2 of M1 — fencing a stale worker's completion writes — is handled in
-- application code via the claimed_by worker id the worker already owns; it
-- needs no schema change.)
--
-- The claimed_at IS NULL branch is a safety net for any legacy `running` row
-- that predates claim stamping claimed_at; such a row falls back to updated_at
-- so it can still be reclaimed.
--
-- Apply identically to BOTH Supabase projects (canary + main).

BEGIN;

CREATE OR REPLACE FUNCTION public.practice_reclaim_stale_running_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	n integer;
BEGIN
	IF auth.uid() IS NOT NULL THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	WITH reclaimed AS (
		UPDATE public.practice_jobs
		SET
			status = 'pending',
			run_after = NOW(),
			error = NULL,
			updated_at = NOW()
		WHERE status = 'running'
			AND (
				(claimed_at IS NOT NULL AND claimed_at < NOW() - INTERVAL '12 minutes')
				OR (claimed_at IS NULL AND updated_at < NOW() - INTERVAL '12 minutes')
			)
		RETURNING id
	)
	SELECT count(*)::integer INTO n FROM reclaimed;

	RETURN COALESCE(n, 0);
END;
$$;

COMMENT ON FUNCTION public.practice_reclaim_stale_running_jobs() IS
	'Requeues stale running jobs (lease measured from claimed_at) so practice_claim_jobs can process them again. Service-role / workers only.';

COMMIT;
