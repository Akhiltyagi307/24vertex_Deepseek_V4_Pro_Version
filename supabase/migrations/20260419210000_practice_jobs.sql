-- Phase 2: background jobs for grading, PDF rendering, and auto-submit.

BEGIN;

CREATE TABLE IF NOT EXISTS public.practice_jobs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	job_type TEXT NOT NULL CHECK (job_type IN ('grade', 'pdf', 'auto_submit')),
	test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
	student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	status TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'running', 'done', 'failed', 'dead')),
	attempts INT NOT NULL DEFAULT 0,
	max_attempts INT NOT NULL DEFAULT 3,
	payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	error TEXT,
	run_after TIMESTAMP NOT NULL DEFAULT NOW(),
	claimed_at TIMESTAMP,
	claimed_by TEXT,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_jobs_status_run_after
	ON public.practice_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_practice_jobs_test
	ON public.practice_jobs (test_id);
CREATE INDEX IF NOT EXISTS idx_practice_jobs_student
	ON public.practice_jobs (student_id, created_at DESC);

ALTER TABLE public.practice_jobs ENABLE ROW LEVEL SECURITY;

-- Students can see their own jobs (used by the grading-progress page).
CREATE POLICY "Students read own practice jobs"
	ON public.practice_jobs FOR SELECT TO authenticated
	USING (student_id = auth.uid());

-- Inserts/updates happen via SECURITY DEFINER RPC or service-role worker.

-- ============================================================
-- RPC: practice_enqueue_job
--   Inserts a job row for the caller's own test. SECURITY DEFINER so it
--   can write even when the authenticated role lacks INSERT on the table.
-- ============================================================

CREATE OR REPLACE FUNCTION public.practice_enqueue_job(
	p_job_type TEXT,
	p_test_id UUID,
	p_payload JSONB DEFAULT '{}'::jsonb,
	p_run_after TIMESTAMP DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_caller UUID := auth.uid();
	v_test_owner UUID;
	v_job_id UUID;
BEGIN
	IF p_job_type NOT IN ('grade', 'pdf', 'auto_submit') THEN
		RAISE EXCEPTION 'Invalid job_type %', p_job_type;
	END IF;

	SELECT student_id INTO v_test_owner FROM public.tests WHERE id = p_test_id;
	IF v_test_owner IS NULL THEN
		RAISE EXCEPTION 'Test not found';
	END IF;

	-- Allow student for their own test, or service-role callers (auth.uid() NULL).
	IF v_caller IS NOT NULL AND v_caller <> v_test_owner THEN
		RAISE EXCEPTION 'Cannot enqueue jobs for another student';
	END IF;

	INSERT INTO public.practice_jobs (
		job_type, test_id, student_id, payload, run_after
	) VALUES (
		p_job_type, p_test_id, v_test_owner, COALESCE(p_payload, '{}'::jsonb), p_run_after
	) RETURNING id INTO v_job_id;

	RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO authenticated;

-- ============================================================
-- RPC: practice_claim_jobs
--   Service-role only (returns empty for non-service callers). Uses
--   `FOR UPDATE SKIP LOCKED` so multiple workers can claim in parallel.
-- ============================================================

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
		ORDER BY pj.run_after ASC
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

-- Not granted to authenticated: only callable by service role.

COMMIT;
