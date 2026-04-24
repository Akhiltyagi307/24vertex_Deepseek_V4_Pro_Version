-- Practice: allow fill_in_blank and long_answer on questions.question_type.
-- Self-practice generation uses fixed mixes; legacy numerical rows remain valid.

ALTER TABLE public.questions
	DROP CONSTRAINT IF EXISTS questions_question_type_check;

ALTER TABLE public.questions
	ADD CONSTRAINT questions_question_type_check CHECK (
		question_type IN (
			'multiple_choice',
			'short_answer',
			'numerical',
			'fill_in_blank',
			'long_answer'
		)
	);

-- Self-practice tests: only 1h (3600s) or 3h (10800s) durations.
CREATE OR REPLACE FUNCTION public.practice_generate_test(
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
	v_student UUID := auth.uid();
	v_test_id UUID;
	v_inserted INT := 0;
	v_row JSONB;
	v_expected_count INT;
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student AND role = 'student') THEN
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

	UPDATE public.tests
	SET status = 'abandoned',
	    abandoned_at = NOW(),
	    updated_at = NOW()
	WHERE student_id = v_student
	  AND subject_id = p_subject_id
	  AND status IN ('in_progress', 'grading');

	INSERT INTO public.tests (
		student_id,
		subject_id,
		test_type,
		status,
		is_draft,
		time_limit_seconds,
		total_questions,
		difficulty,
		question_count,
		question_mix
	) VALUES (
		v_student,
		p_subject_id,
		'self',
		'in_progress',
		TRUE,
		p_duration_seconds,
		p_question_count,
		p_difficulty,
		p_question_count,
		p_question_mix
	) RETURNING id INTO v_test_id;

	FOR v_row IN SELECT * FROM jsonb_array_elements(p_questions)
	LOOP
		v_inserted := v_inserted + 1;
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
			v_test_id,
			(v_row->>'topic_id')::uuid,
			v_row->>'question_text',
			v_row->>'question_type',
			v_row->>'difficulty_level',
			v_row->'answer_key',
			CASE
				WHEN (v_row->>'question_type') = 'multiple_choice' THEN v_row->'options'
				ELSE NULL
			END,
			v_inserted,
			COALESCE(v_row->'metadata', '{}'::jsonb)
		);
	END LOOP;

	RETURN v_test_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_generate_test(UUID, TEXT, INT, INT, JSONB, JSONB) TO authenticated;
