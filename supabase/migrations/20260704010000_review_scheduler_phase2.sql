-- Closed learning loop — Phase 2 (loop live). Idempotent; apply to BOTH projects
-- (canary ezxmjkvhrlqeimhnfvfd + EDU_AI suwakggcbxmmvqzeudmq) via MCP.
-- Spec: docs/superpowers/specs/2026-06-01-closed-learning-loop-design.md §7–§9.

-- 1. Allow review tests.
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_test_type_check;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_test_type_check CHECK (test_type IN ('self', 'assigned', 'review'));

-- 2. Allow a review_generate job (no test_id, no submission, student_id required).
ALTER TABLE public.practice_jobs
	DROP CONSTRAINT IF EXISTS practice_jobs_job_type_check,
	DROP CONSTRAINT IF EXISTS practice_jobs_required_ids_check;
ALTER TABLE public.practice_jobs
	ADD CONSTRAINT practice_jobs_job_type_check
	CHECK (job_type IN ('grade','pdf','auto_submit','email','tracker_update','assign_generate_test','review_generate')),
	ADD CONSTRAINT practice_jobs_required_ids_check
	CHECK (
		(job_type = 'assign_generate_test' AND test_id IS NULL AND assignment_submission_id IS NOT NULL)
		OR (job_type = 'review_generate' AND test_id IS NULL AND assignment_submission_id IS NULL AND student_id IS NOT NULL)
		OR (job_type NOT IN ('assign_generate_test','review_generate') AND test_id IS NOT NULL AND assignment_submission_id IS NULL)
	);

-- 3. One active review_generate per (student, topic) — dedup / ≤1-per-day support.
CREATE UNIQUE INDEX IF NOT EXISTS practice_jobs_review_generate_active_uq
	ON public.practice_jobs (student_id, (payload->>'topic_id'))
	WHERE job_type = 'review_generate' AND status IN ('pending','running');

-- 4. Claim ordering: include review_generate (after assignment gen).
CREATE OR REPLACE FUNCTION public.practice_claim_jobs(
	p_worker_id TEXT, p_job_types TEXT[], p_limit INT DEFAULT 5
)
RETURNS TABLE(
	id uuid, job_type text, test_id uuid, student_id uuid,
	assignment_submission_id uuid, attempts integer, max_attempts integer, payload jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.role() <> 'service_role' THEN
		RAISE EXCEPTION 'Workers only';
	END IF;
	RETURN QUERY
	WITH claimed AS (
		SELECT pj.id FROM public.practice_jobs pj
		WHERE pj.status = 'pending' AND pj.job_type = ANY(p_job_types) AND pj.run_after <= NOW()
		ORDER BY CASE pj.job_type
			WHEN 'grade' THEN 1 WHEN 'assign_generate_test' THEN 2 WHEN 'review_generate' THEN 3
			WHEN 'pdf' THEN 4 WHEN 'email' THEN 5 WHEN 'tracker_update' THEN 6 WHEN 'auto_submit' THEN 7
			ELSE 99 END ASC,
			CASE WHEN pj.job_type = 'email' THEN pj.created_at END DESC NULLS LAST,
			CASE WHEN pj.job_type <> 'email' THEN pj.run_after END ASC NULLS LAST,
			pj.created_at ASC
		LIMIT p_limit FOR UPDATE SKIP LOCKED
	)
	UPDATE public.practice_jobs pj
	SET status = 'running', attempts = pj.attempts + 1, claimed_at = NOW(), claimed_by = p_worker_id, updated_at = NOW()
	FROM claimed WHERE pj.id = claimed.id
	RETURNING pj.id, pj.job_type, pj.test_id, pj.student_id, pj.assignment_submission_id, pj.attempts, pj.max_attempts, pj.payload;
END;
$$;
REVOKE ALL ON FUNCTION public.practice_claim_jobs(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_claim_jobs(TEXT, TEXT[], INT) TO service_role;

-- 5. Review generator RPC (mirror of practice_generate_assigned_test; test_type='review').
CREATE OR REPLACE FUNCTION public.practice_generate_review_test(
	p_student_id UUID, p_subject_id UUID, p_difficulty TEXT, p_duration_seconds INT,
	p_question_count INT, p_question_mix JSONB, p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Workers only'; END IF;
	IF p_student_id IS NULL THEN RAISE EXCEPTION 'Student required'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Review tests require a student profile';
	END IF;
	IF p_difficulty NOT IN ('easy','medium','hard') THEN RAISE EXCEPTION 'Invalid difficulty'; END IF;
	IF p_duration_seconds NOT IN (3600, 10800) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
	IF p_question_count <= 0 OR p_question_count > 200 THEN RAISE EXCEPTION 'Invalid question count'; END IF;
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'Questions payload must be a JSON array'; END IF;
	v_expected_count := jsonb_array_length(p_questions);
	IF v_expected_count <> p_question_count THEN
		RAISE EXCEPTION 'question_count % does not match payload length %', p_question_count, v_expected_count;
	END IF;

	INSERT INTO public.tests (
		student_id, subject_id, test_type, status, is_draft,
		time_limit_seconds, total_questions, difficulty, question_count, question_mix
	) VALUES (
		p_student_id, p_subject_id, 'review', 'in_progress', TRUE,
		p_duration_seconds, p_question_count, p_difficulty, p_question_count, p_question_mix
	) RETURNING id INTO v_test_id;

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
REVOKE ALL ON FUNCTION public.practice_generate_review_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_generate_review_test(UUID, UUID, TEXT, INT, INT, JSONB, JSONB) TO service_role;
