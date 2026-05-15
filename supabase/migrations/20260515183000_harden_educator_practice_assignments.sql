-- Hardening for educator-assigned practice tests after initial rollout.
-- Keeps assigned generation worker-only, lets self-practice coexist with
-- assigned tests, and exposes a narrow student RPC for lifecycle progress.

BEGIN;

DROP INDEX IF EXISTS public.tests_one_active_per_subject_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS tests_one_active_per_subject_uidx
	ON public.tests (student_id, subject_id)
	WHERE status IN ('in_progress', 'grading')
		AND COALESCE(test_type, 'self') = 'self';

CREATE OR REPLACE FUNCTION public.practice_generate_assigned_test(
	p_student_id UUID,
	p_assignment_submission_id UUID,
	p_subject_id UUID,
	p_difficulty TEXT,
	p_duration_seconds INT,
	p_question_count INT,
	p_question_mix JSONB,
	p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_assignment_id UUID;
	v_teacher_id UUID;
	v_config JSONB;
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF auth.uid() IS NOT NULL THEN
		RAISE EXCEPTION 'Workers only';
	END IF;
	IF p_student_id IS NULL THEN
		RAISE EXCEPTION 'Student required';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Assigned tests require a student profile';
	END IF;
	SELECT s.assignment_id, a.teacher_id, a.config
	INTO v_assignment_id, v_teacher_id, v_config
	FROM public.assignment_submissions s
	JOIN public.assignments a ON a.id = s.assignment_id
	WHERE s.id = p_assignment_submission_id
		AND s.student_id = p_student_id
		AND s.lifecycle_status IN ('pending_materialize', 'failed_generation');
	IF v_assignment_id IS NULL OR v_teacher_id IS NULL THEN
		RAISE EXCEPTION 'Assignment submission not found';
	END IF;
	IF NOT public.teacher_can_access_student(v_teacher_id, p_student_id) THEN
		RAISE EXCEPTION 'Teacher cannot access this student';
	END IF;
	IF v_config->>'kind' <> 'practice_test' THEN
		RAISE EXCEPTION 'Unsupported assignment kind';
	END IF;
	IF v_config->>'subject_id' <> p_subject_id::TEXT THEN
		RAISE EXCEPTION 'Assigned test subject does not match assignment config';
	END IF;
	IF v_config->>'difficulty' <> p_difficulty THEN
		RAISE EXCEPTION 'Assigned test difficulty does not match assignment config';
	END IF;
	IF (v_config->>'time_limit_seconds')::INT <> p_duration_seconds THEN
		RAISE EXCEPTION 'Assigned test duration does not match assignment config';
	END IF;
	IF (v_config->>'question_count')::INT <> p_question_count THEN
		RAISE EXCEPTION 'Assigned test question count does not match assignment config';
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
	IF EXISTS (
		SELECT 1
		FROM jsonb_array_elements(p_questions) AS q(elem)
		WHERE NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements_text(v_config->'topic_ids') AS allowed(topic_id)
			WHERE allowed.topic_id = q.elem->>'topic_id'
		)
	) THEN
		RAISE EXCEPTION 'Generated question topics do not match assignment config';
	END IF;

	INSERT INTO public.tests (
		student_id,
		subject_id,
		assignment_submission_id,
		test_type,
		status,
		is_draft,
		time_limit_seconds,
		total_questions,
		difficulty,
		question_count,
		question_mix
	) VALUES (
		p_student_id,
		p_subject_id,
		p_assignment_submission_id,
		'assigned',
		'in_progress',
		TRUE,
		p_duration_seconds,
		p_question_count,
		p_difficulty,
		p_question_count,
		p_question_mix
	) RETURNING id INTO v_test_id;

	INSERT INTO public.questions (
		test_id,
		topic_id,
		question_text,
		question_type,
		difficulty_level,
		answer_key,
		options,
		question_number,
		metadata
	)
	SELECT
		v_test_id,
		(elem->>'topic_id')::uuid,
		elem->>'question_text',
		elem->>'question_type',
		elem->>'difficulty_level',
		elem->'answer_key',
		CASE
			WHEN (elem->>'question_type') = 'multiple_choice' THEN elem->'options'
			ELSE NULL
		END,
		ord::int,
		COALESCE(elem->'metadata', '{}'::jsonb)
	FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord);

	UPDATE public.assignment_submissions
	SET test_id = v_test_id,
		lifecycle_status = 'ready',
		error = NULL,
		updated_at = NOW()
	WHERE id = p_assignment_submission_id;

	RETURN v_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_generate_assigned_test(UUID, UUID, UUID, TEXT, INT, INT, JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.practice_generate_assigned_test(UUID, UUID, UUID, TEXT, INT, INT, JSONB, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.practice_generate_assigned_test(UUID, UUID, UUID, TEXT, INT, INT, JSONB, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.assignment_mark_submission_in_progress(
	p_test_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student UUID := auth.uid();
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	UPDATE public.assignment_submissions s
	SET lifecycle_status = 'in_progress',
		updated_at = NOW()
	FROM public.tests t
	WHERE t.id = p_test_id
		AND t.assignment_submission_id = s.id
		AND t.student_id = v_student
		AND s.student_id = v_student
		AND s.lifecycle_status = 'ready';
END;
$$;

REVOKE ALL ON FUNCTION public.assignment_mark_submission_in_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assignment_mark_submission_in_progress(UUID) TO authenticated;

COMMIT;
