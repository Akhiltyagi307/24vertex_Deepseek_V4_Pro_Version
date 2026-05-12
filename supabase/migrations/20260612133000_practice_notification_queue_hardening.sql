-- Reliability hardening for practice report-ready notifications.
--
-- 1) Add a DB-level uniqueness guard for `test_report_ready` rows so retries
--    from concurrent workers cannot produce duplicate bell cards.
-- 2) Prioritize queue claims (`grade` -> `pdf` -> `email` -> `tracker_update`)
--    so a stale email backlog never delays freshly submitted tests.
--
-- Apply identically to both Supabase projects (dev + main).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_test_report_ready_recipient_ref
	ON public.notifications (recipient_id, reference_type, reference_id, category)
	WHERE category = 'test_report_ready'
	  AND reference_type = 'test'
	  AND reference_id IS NOT NULL;

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
	-- Service-role bypasses RLS; if this RPC is invoked under a student JWT
	-- (auth.uid() IS NOT NULL) we reject — this function is for workers only.
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
			pj.run_after ASC,
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
