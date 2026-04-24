-- Phase 3: appending follow-up questions to an in-progress test for the
-- optional within-test adaptive difficulty feature.

BEGIN;

CREATE OR REPLACE FUNCTION public.practice_append_questions(
	p_test_id UUID,
	p_questions JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_caller UUID := auth.uid();
	v_student UUID;
	v_status TEXT;
	v_max_qn INT;
	v_row JSONB;
	v_added INT := 0;
BEGIN
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
		RAISE EXCEPTION 'Questions payload must be a JSON array';
	END IF;

	SELECT student_id, status INTO v_student, v_status FROM public.tests WHERE id = p_test_id;
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Test not found';
	END IF;
	IF v_status <> 'in_progress' THEN
		RAISE EXCEPTION 'Test is not in progress';
	END IF;
	-- Service-role callers (auth.uid() NULL) allowed; students must own the test.
	IF v_caller IS NOT NULL AND v_caller <> v_student THEN
		RAISE EXCEPTION 'Caller does not own test';
	END IF;

	SELECT COALESCE(MAX(question_number), 0) INTO v_max_qn
	FROM public.questions WHERE test_id = p_test_id;

	FOR v_row IN SELECT * FROM jsonb_array_elements(p_questions)
	LOOP
		v_max_qn := v_max_qn + 1;
		v_added := v_added + 1;
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
		) VALUES (
			p_test_id,
			(v_row->>'topic_id')::uuid,
			v_row->>'question_text',
			v_row->>'question_type',
			v_row->>'difficulty_level',
			v_row->'answer_key',
			CASE
				WHEN (v_row->>'question_type') = 'multiple_choice' THEN v_row->'options'
				ELSE NULL
			END,
			v_max_qn,
			COALESCE(v_row->'metadata', '{}'::jsonb) || jsonb_build_object('adaptive', true)
		);
	END LOOP;

	-- Keep tests.total_questions accurate for aggregates.
	UPDATE public.tests
	SET total_questions = COALESCE(total_questions, 0) + v_added,
	    question_count = COALESCE(question_count, 0) + v_added,
	    updated_at = NOW()
	WHERE id = p_test_id;

	RETURN v_added;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_append_questions(UUID, JSONB) TO authenticated;

COMMIT;
