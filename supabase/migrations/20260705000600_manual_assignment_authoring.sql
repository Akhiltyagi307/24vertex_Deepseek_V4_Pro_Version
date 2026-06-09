-- Manual (teacher-authored) assignments.
-- Adds the authored-question template table and a no-LLM materialization RPC.
-- AI assignments are unaffected: authoring_mode lives in config JSONB and defaults to 'ai'.

BEGIN;

-- 1. Authored question template (one set per assignment; copied per student at materialization).
CREATE TABLE IF NOT EXISTS public.assignment_questions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
	question_number INT NOT NULL,
	topic_id UUID NOT NULL REFERENCES public.topics(id),
	question_type VARCHAR(20) NOT NULL,
	question_text TEXT NOT NULL,
	options JSONB,
	answer_key JSONB NOT NULL,
	difficulty_level VARCHAR(10) NOT NULL DEFAULT 'medium',
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT assignment_questions_question_type_check CHECK (
		question_type IN ('multiple_choice', 'short_answer', 'numerical', 'fill_in_blank', 'long_answer')
	),
	CONSTRAINT assignment_questions_number_uq UNIQUE (assignment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment
	ON public.assignment_questions (assignment_id, question_number);

ALTER TABLE public.assignment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read own assignment questions" ON public.assignment_questions;
CREATE POLICY "Teachers read own assignment questions"
ON public.assignment_questions FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1 FROM public.assignments a
		WHERE a.id = assignment_questions.assignment_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);
-- Writes happen server-side via the Drizzle connection (bypasses RLS), mirroring assignments.

-- 2. Manual materialization: copy the authored template into a per-student assigned test. No LLM.
CREATE OR REPLACE FUNCTION public.practice_create_manual_assigned_test(
	p_assignment_submission_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id UUID;
	v_assignment_id UUID;
	v_assignment_status TEXT;
	v_teacher_id UUID;
	v_config JSONB;
	v_lifecycle_status TEXT;
	v_existing_test_id UUID;
	v_subject_id UUID;
	v_difficulty TEXT;
	v_duration INT;
	v_count INT;
	v_question_mix JSONB;
	v_test_id UUID;
BEGIN
	IF auth.role() <> 'service_role' THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	SELECT s.student_id, s.assignment_id, a.status, a.teacher_id, a.config, s.lifecycle_status, s.test_id
	INTO v_student_id, v_assignment_id, v_assignment_status, v_teacher_id, v_config, v_lifecycle_status, v_existing_test_id
	FROM public.assignment_submissions s
	JOIN public.assignments a ON a.id = s.assignment_id
	WHERE s.id = p_assignment_submission_id
	FOR UPDATE OF s;

	IF v_assignment_id IS NULL OR v_teacher_id IS NULL THEN
		RAISE EXCEPTION 'Assignment submission not found';
	END IF;
	IF v_existing_test_id IS NOT NULL THEN
		RETURN v_existing_test_id;
	END IF;
	IF v_assignment_status <> 'published' THEN
		RAISE EXCEPTION 'Assignment is not published';
	END IF;
	IF v_lifecycle_status NOT IN ('pending_materialize', 'failed_generation') THEN
		RAISE EXCEPTION 'Assignment submission is not awaiting materialization';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Assigned tests require a student profile';
	END IF;
	IF NOT public.teacher_can_access_student(v_teacher_id, v_student_id) THEN
		RAISE EXCEPTION 'Teacher cannot access this student';
	END IF;
	IF v_config->>'kind' <> 'practice_test' THEN
		RAISE EXCEPTION 'Unsupported assignment kind';
	END IF;
	IF v_config->>'authoring_mode' <> 'manual' THEN
		RAISE EXCEPTION 'Not a manual assignment';
	END IF;

	v_subject_id := (v_config->>'subject_id')::uuid;
	v_difficulty := COALESCE(v_config->>'difficulty', 'medium');
	v_duration := COALESCE((v_config->>'time_limit_seconds')::int, 3600);
	IF v_difficulty NOT IN ('easy', 'medium', 'hard') THEN
		v_difficulty := 'medium';
	END IF;
	IF v_duration <= 0 OR v_duration > 14400 THEN
		RAISE EXCEPTION 'Invalid manual assignment duration';
	END IF;

	SELECT count(*) INTO v_count FROM public.assignment_questions WHERE assignment_id = v_assignment_id;
	IF v_count <= 0 OR v_count > 200 THEN
		RAISE EXCEPTION 'Manual assignment has no questions or too many';
	END IF;

	SELECT jsonb_object_agg(qt, c)
	INTO v_question_mix
	FROM (
		SELECT question_type AS qt, count(*) AS c
		FROM public.assignment_questions
		WHERE assignment_id = v_assignment_id
		GROUP BY question_type
	) mix;

	INSERT INTO public.tests (
		student_id, subject_id, assignment_submission_id, test_type, status, is_draft,
		time_limit_seconds, total_questions, difficulty, question_count, question_mix
	) VALUES (
		v_student_id, v_subject_id, p_assignment_submission_id, 'assigned', 'in_progress', TRUE,
		v_duration, v_count, v_difficulty, v_count, COALESCE(v_question_mix, '{}'::jsonb)
	) RETURNING id INTO v_test_id;

	INSERT INTO public.questions (
		test_id, topic_id, question_text, question_type, difficulty_level, answer_key, options, question_number, metadata
	)
	SELECT
		v_test_id,
		aq.topic_id,
		aq.question_text,
		aq.question_type,
		aq.difficulty_level,
		aq.answer_key,
		CASE WHEN aq.question_type = 'multiple_choice' THEN aq.options ELSE NULL END,
		aq.question_number,
		COALESCE(aq.metadata, '{}'::jsonb)
	FROM public.assignment_questions aq
	WHERE aq.assignment_id = v_assignment_id
	ORDER BY aq.question_number;

	UPDATE public.assignment_submissions
	SET test_id = v_test_id,
		lifecycle_status = 'ready',
		error = NULL,
		updated_at = NOW()
	WHERE id = p_assignment_submission_id;

	RETURN v_test_id;
END;
$$;

REVOKE ALL ON FUNCTION public.practice_create_manual_assigned_test(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_create_manual_assigned_test(UUID) TO service_role;

COMMIT;
