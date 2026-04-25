-- Reset practice_jobs left in `running` after a worker crash, timeout, or deploy.
-- claim_jobs only selects `pending`, so stale `running` rows would otherwise never run again.

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
			AND updated_at < NOW() - INTERVAL '12 minutes'
		RETURNING id
	)
	SELECT count(*)::integer INTO n FROM reclaimed;

	RETURN COALESCE(n, 0);
END;
$$;

COMMENT ON FUNCTION public.practice_reclaim_stale_running_jobs() IS
	'Requeues stale running jobs so practice_claim_jobs can process them again. Service-role / workers only.';

COMMIT;
