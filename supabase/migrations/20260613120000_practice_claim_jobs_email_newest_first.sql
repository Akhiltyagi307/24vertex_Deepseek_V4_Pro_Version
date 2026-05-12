-- Report-ready email jobs were claimed FIFO (oldest `run_after` / `created_at` first).
-- A backlog meant students received emails for *older* tests long after a newer submit,
-- which feels like "wrong subject" even though each row matched its own test_id.
-- Claim **email** jobs newest-first; other job types keep stable FIFO by `run_after`.
--
-- Apply identically to both Supabase projects (dev + main).

BEGIN;

CREATE OR REPLACE FUNCTION public.practice_claim_jobs(
	p_worker_id TEXT,
	p_job_types TEXT[],
	p_limit INT DEFAULT 5
)
RETURNS TABLE (
	id UUID,
	job_type TEXT,
	test_id UUID,
	student_id UUID,
	attempts INT,
	max_attempts INT,
	payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.uid() IS NOT NULL THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	RETURN QUERY
	WITH claimed AS (
		SELECT pj.id
		FROM public.practice_jobs pj
		WHERE pj.status = 'pending'
		  AND pj.job_type = ANY(p_job_types)
		  AND pj.run_after <= NOW()
		ORDER BY
			CASE pj.job_type
				WHEN 'grade' THEN 1
				WHEN 'pdf' THEN 2
				WHEN 'email' THEN 3
				WHEN 'tracker_update' THEN 4
				WHEN 'auto_submit' THEN 5
				ELSE 99
			END ASC,
			CASE WHEN pj.job_type = 'email' THEN pj.created_at END DESC NULLS LAST,
			CASE WHEN pj.job_type <> 'email' THEN pj.run_after END ASC NULLS LAST,
			pj.created_at ASC
		LIMIT p_limit
		FOR UPDATE SKIP LOCKED
	)
	UPDATE public.practice_jobs pj
	SET status = 'running',
		attempts = pj.attempts + 1,
		claimed_at = NOW(),
		claimed_by = p_worker_id,
		updated_at = NOW()
	FROM claimed
	WHERE pj.id = claimed.id
	RETURNING pj.id, pj.job_type, pj.test_id, pj.student_id,
			  pj.attempts, pj.max_attempts, pj.payload;
END;
$$;

COMMIT;
