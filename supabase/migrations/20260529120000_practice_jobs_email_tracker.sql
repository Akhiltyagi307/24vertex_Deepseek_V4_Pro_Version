-- Extend `practice_jobs.job_type` to allow `email` and `tracker_update`.
--
-- `email`: PDF-ready report emails (per-recipient row in payload). Replaces
-- the previous one-shot send from the PDF handler so transient Resend
-- failures get retried via the same backoff machinery as grade/pdf.
--
-- `tracker_update`: enqueued from the grading pipeline when
-- `practice_update_trackers_bulk` fails — previously the failure was logged
-- and forgotten, leaving tracker rows permanently stale.
--
-- Apply identically to both Supabase projects (suwakgg…, ezxmjk…).

BEGIN;

-- 1. Loosen the CHECK on the table.
ALTER TABLE public.practice_jobs
	DROP CONSTRAINT IF EXISTS practice_jobs_job_type_check;
ALTER TABLE public.practice_jobs
	ADD CONSTRAINT practice_jobs_job_type_check
	CHECK (job_type IN ('grade', 'pdf', 'auto_submit', 'email', 'tracker_update'));

-- 2. Update the enqueue RPC's allow-list mirror.
CREATE OR REPLACE FUNCTION public.practice_enqueue_job(
	p_job_type TEXT,
	p_test_id UUID,
	p_payload JSONB DEFAULT '{}'::jsonb,
	p_run_after TIMESTAMP DEFAULT NOW()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_test_owner UUID;
	v_job_id UUID;
BEGIN
	IF p_job_type NOT IN ('grade', 'pdf', 'auto_submit', 'email', 'tracker_update') THEN
		RAISE EXCEPTION 'Invalid job_type %', p_job_type;
	END IF;

	SELECT student_id INTO v_test_owner FROM public.tests WHERE id = p_test_id;
	IF v_test_owner IS NULL THEN
		RAISE EXCEPTION 'Test % does not exist', p_test_id;
	END IF;

	INSERT INTO public.practice_jobs (
		job_type, test_id, student_id, payload, run_after
	) VALUES (
		p_job_type, p_test_id, v_test_owner, COALESCE(p_payload, '{}'::jsonb), p_run_after
	)
	RETURNING id INTO v_job_id;

	RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO service_role;

COMMIT;
