-- Durable student-initiated generation (review H2, increment 2 — schema + RPC).
--
-- Adds a `student_generate_test` practice_jobs type so a student's "Generate"
-- runs in the background worker (durable, resumable, survives the 300s function
-- ceiling and client disconnects) instead of inside one streaming HTTP request.
-- This mirrors the existing `review_generate` precedent (20260704010000) exactly:
--   - a job with no test_id and no submission, student_id required;
--   - a SECURITY DEFINER persist RPC that takes p_student_id explicitly (the
--     worker runs as service_role and has no auth.uid()), modeled on the live
--     practice_generate_test body so worker-generated self-tests are identical to
--     synchronously-generated ones;
--   - the persist RPC is IDEMPOTENT on client_request_id (the column added in
--     20260705000300), so a reclaimed/re-run job resolves to the original test
--     instead of creating a duplicate or double-charging.
-- A partial unique index dedups concurrent active jobs per (student, key).
--
-- This migration is inert until the worker handler + enqueue endpoint land
-- (next increment) — nothing enqueues `student_generate_test` yet.
--
-- Apply identically to BOTH Supabase projects (canary + main).

BEGIN;

-- 1. Allow the new job type (no test_id, no submission, student_id required).
ALTER TABLE public.practice_jobs
	DROP CONSTRAINT IF EXISTS practice_jobs_job_type_check,
	DROP CONSTRAINT IF EXISTS practice_jobs_required_ids_check;
ALTER TABLE public.practice_jobs
	ADD CONSTRAINT practice_jobs_job_type_check
	CHECK (job_type IN ('grade','pdf','auto_submit','email','tracker_update','assign_generate_test','review_generate','student_generate_test')),
	ADD CONSTRAINT practice_jobs_required_ids_check
	CHECK (
		(job_type = 'assign_generate_test' AND test_id IS NULL AND assignment_submission_id IS NOT NULL)
		OR (job_type = 'review_generate' AND test_id IS NULL AND assignment_submission_id IS NULL AND student_id IS NOT NULL)
		OR (job_type = 'student_generate_test' AND test_id IS NULL AND assignment_submission_id IS NULL AND student_id IS NOT NULL)
		OR (job_type NOT IN ('assign_generate_test','review_generate','student_generate_test') AND test_id IS NOT NULL AND assignment_submission_id IS NULL)
	);

-- 2. One active student_generate_test per (student, client_request_id) — dedups a
--    double-submit / retry before the worker even claims it.
CREATE UNIQUE INDEX IF NOT EXISTS practice_jobs_student_generate_active_uq
	ON public.practice_jobs (student_id, (payload->>'client_request_id'))
	WHERE job_type = 'student_generate_test' AND status IN ('pending','running');

-- 3. Service-role, idempotent self-test persist. Mirrors practice_generate_test
--    (20260428100000) but takes p_student_id (worker context) and p_client_request_id.
CREATE OR REPLACE FUNCTION public.practice_generate_self_test(
	p_student_id UUID,
	p_subject_id UUID,
	p_difficulty TEXT,
	p_duration_seconds INT,
	p_question_count INT,
	p_question_mix JSONB,
	p_questions JSONB,
	p_client_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF auth.role() <> 'service_role' THEN
		RAISE EXCEPTION 'Workers only';
	END IF;
	IF p_student_id IS NULL THEN
		RAISE EXCEPTION 'Student required';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Only students can generate practice tests';
	END IF;
	IF p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
		RAISE EXCEPTION 'Invalid difficulty';
	END IF;
	IF p_duration_seconds NOT IN (3600, 10800) THEN
		RAISE EXCEPTION 'Invalid duration';
	END IF;
	IF p_question_count <= 0 OR p_question_count > 200 THEN
		RAISE EXCEPTION 'Invalid question count';
	END IF;
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
		RAISE EXCEPTION 'Questions payload must be a JSON array';
	END IF;
	v_expected_count := jsonb_array_length(p_questions);
	IF v_expected_count <> p_question_count THEN
		RAISE EXCEPTION 'question_count % does not match payload length %', p_question_count, v_expected_count;
	END IF;

	-- Idempotency: a reclaimed/re-run job for the same key returns the test the
	-- first run already created (no second test, no abandon, no double-charge).
	IF p_client_request_id IS NOT NULL THEN
		SELECT id INTO v_test_id
		FROM public.tests
		WHERE student_id = p_student_id AND client_request_id = p_client_request_id
		LIMIT 1;
		IF v_test_id IS NOT NULL THEN
			RETURN v_test_id;
		END IF;
	END IF;

	UPDATE public.tests
	SET status = 'abandoned',
	    abandoned_at = NOW(),
	    updated_at = NOW()
	WHERE student_id = p_student_id
	  AND subject_id = p_subject_id
	  AND status IN ('in_progress', 'grading');

	INSERT INTO public.tests (
		student_id, subject_id, test_type, status, is_draft,
		time_limit_seconds, total_questions, difficulty, question_count, question_mix,
		client_request_id
	) VALUES (
		p_student_id, p_subject_id, 'self', 'in_progress', TRUE,
		p_duration_seconds, p_question_count, p_difficulty, p_question_count, p_question_mix,
		p_client_request_id
	)
	ON CONFLICT (student_id, client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
	RETURNING id INTO v_test_id;

	-- Lost the race to a concurrent run carrying the same key: return its test
	-- (questions were inserted by the winner).
	IF v_test_id IS NULL THEN
		SELECT id INTO v_test_id
		FROM public.tests
		WHERE student_id = p_student_id AND client_request_id = p_client_request_id
		LIMIT 1;
		RETURN v_test_id;
	END IF;

	INSERT INTO public.questions (
		test_id, topic_id, question_text, question_type, difficulty_level,
		answer_key, options, question_number, metadata
	)
	SELECT v_test_id, (elem->>'topic_id')::uuid, elem->>'question_text', elem->>'question_type',
		elem->>'difficulty_level', elem->'answer_key',
		CASE WHEN (elem->>'question_type') = 'multiple_choice' THEN elem->'options' ELSE NULL END,
		ord::int, COALESCE(elem->'metadata', '{}'::jsonb)
	FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord);

	RETURN v_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_generate_self_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_generate_self_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB, UUID) TO service_role;

COMMIT;
