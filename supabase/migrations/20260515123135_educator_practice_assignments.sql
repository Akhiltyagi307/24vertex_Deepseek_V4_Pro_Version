-- Educator-assigned practice tests.
-- Recreates the assignment spine removed during the teacher teardown, but keeps
-- the new organization/link-code teacher model as the authorization source.

BEGIN;

-- ---------------------------------------------------------------------------
-- Assignments: one parent row per teacher-created batch.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
	assignment_kind TEXT NOT NULL DEFAULT 'practice_test',
	title VARCHAR(300) NOT NULL,
	instructions TEXT,
	config JSONB NOT NULL DEFAULT '{}'::jsonb,
	due_at TIMESTAMPTZ,
	status VARCHAR(20) NOT NULL DEFAULT 'draft',
	published_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If a legacy `assignments` table survived in any environment, add the new
-- columns and loosen legacy targeting columns that v1 no longer writes.
ALTER TABLE public.assignments
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS assignment_kind TEXT NOT NULL DEFAULT 'practice_test',
	ADD COLUMN IF NOT EXISTS instructions TEXT,
	ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
	ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'due_date'
	) THEN
		ALTER TABLE public.assignments ALTER COLUMN due_date DROP NOT NULL;
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'target_grades'
	) THEN
		ALTER TABLE public.assignments ALTER COLUMN target_grades DROP NOT NULL;
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'target_sections'
	) THEN
		ALTER TABLE public.assignments ALTER COLUMN target_sections DROP NOT NULL;
	END IF;
END $$;

ALTER TABLE public.assignments
	DROP CONSTRAINT IF EXISTS assignments_assignment_kind_check,
	DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.assignments
	ADD CONSTRAINT assignments_assignment_kind_check
		CHECK (assignment_kind IN ('practice_test')),
	ADD CONSTRAINT assignments_status_check
		CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_created
	ON public.assignments (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_status_due
	ON public.assignments (status, due_at);
CREATE INDEX IF NOT EXISTS idx_assignments_org_created
	ON public.assignments (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Assignment submissions: one lifecycle row per selected student.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
	student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
	lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'pending_materialize',
	score NUMERIC(5,2),
	submitted_at TIMESTAMPTZ,
	graded_at TIMESTAMPTZ,
	is_late BOOLEAN NOT NULL DEFAULT FALSE,
	penalty_applied NUMERIC(5,2) NOT NULL DEFAULT 0,
	error TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT assignment_submissions_assignment_student_uq UNIQUE (assignment_id, student_id)
);

ALTER TABLE public.assignment_submissions
	ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'pending_materialize',
	ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS error TEXT;

ALTER TABLE public.assignment_submissions
	DROP CONSTRAINT IF EXISTS assignment_submissions_lifecycle_status_check;
ALTER TABLE public.assignment_submissions
	ADD CONSTRAINT assignment_submissions_lifecycle_status_check
	CHECK (
		lifecycle_status IN (
			'pending_materialize',
			'ready',
			'in_progress',
			'submitted',
			'grading',
			'graded',
			'failed_generation',
			'late',
			'excused'
		)
	);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_student_uq
	ON public.assignment_submissions (assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_status
	ON public.assignment_submissions (student_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_status
	ON public.assignment_submissions (assignment_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_test
	ON public.assignment_submissions (test_id);

-- ---------------------------------------------------------------------------
-- Tests: allow assigned practice attempts and link them back to submissions.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tests
	ADD COLUMN IF NOT EXISTS assignment_submission_id UUID;

ALTER TABLE public.tests
	DROP CONSTRAINT IF EXISTS tests_assignment_submission_id_fkey;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_assignment_submission_id_fkey
	FOREIGN KEY (assignment_submission_id)
	REFERENCES public.assignment_submissions(id)
	ON DELETE SET NULL;

ALTER TABLE public.tests
	DROP CONSTRAINT IF EXISTS tests_test_type_check;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_test_type_check CHECK (test_type IN ('self', 'assigned'));

CREATE INDEX IF NOT EXISTS idx_tests_assignment_submission
	ON public.tests (assignment_submission_id);

-- ---------------------------------------------------------------------------
-- Practice jobs: assignment materialization jobs run before a test row exists.
-- ---------------------------------------------------------------------------
ALTER TABLE public.practice_jobs
	ALTER COLUMN test_id DROP NOT NULL,
	ADD COLUMN IF NOT EXISTS assignment_submission_id UUID REFERENCES public.assignment_submissions(id) ON DELETE CASCADE;

ALTER TABLE public.practice_jobs
	DROP CONSTRAINT IF EXISTS practice_jobs_job_type_check;
ALTER TABLE public.practice_jobs
	ADD CONSTRAINT practice_jobs_job_type_check
	CHECK (job_type IN ('grade', 'pdf', 'auto_submit', 'email', 'tracker_update', 'assign_generate_test'));

CREATE INDEX IF NOT EXISTS idx_practice_jobs_assignment_submission
	ON public.practice_jobs (assignment_submission_id);

DROP FUNCTION IF EXISTS public.practice_claim_jobs(TEXT, TEXT[], INT);
CREATE OR REPLACE FUNCTION public.practice_claim_jobs(
	p_worker_id TEXT,
	p_job_types TEXT[],
	p_limit INT DEFAULT 5
)
RETURNS TABLE(
	id uuid,
	job_type text,
	test_id uuid,
	student_id uuid,
	assignment_submission_id uuid,
	attempts integer,
	max_attempts integer,
	payload jsonb
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
				WHEN 'assign_generate_test' THEN 2
				WHEN 'pdf' THEN 3
				WHEN 'email' THEN 4
				WHEN 'tracker_update' THEN 5
				ELSE 9
			END,
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
	RETURNING pj.id, pj.job_type, pj.test_id, pj.student_id, pj.assignment_submission_id,
	          pj.attempts, pj.max_attempts, pj.payload;
END;
$$;

-- Authenticated users still enqueue jobs only through RPCs; add a dedicated
-- assignment materialization RPC for trusted server actions/workers.
CREATE OR REPLACE FUNCTION public.assignment_enqueue_generate_test(
	p_assignment_submission_id UUID,
	p_run_after TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_teacher UUID;
	v_student UUID;
	v_job_id UUID;
BEGIN
	SELECT a.teacher_id, s.student_id
	INTO v_teacher, v_student
	FROM public.assignment_submissions s
	JOIN public.assignments a ON a.id = s.assignment_id
	WHERE s.id = p_assignment_submission_id;

	IF v_teacher IS NULL OR v_student IS NULL THEN
		RAISE EXCEPTION 'Assignment submission not found';
	END IF;

	IF auth.uid() IS NOT NULL AND auth.uid() <> v_teacher THEN
		RAISE EXCEPTION 'Only the assignment teacher can enqueue generation';
	END IF;

	IF auth.uid() IS NOT NULL AND NOT public.teacher_can_access_student(auth.uid(), v_student) THEN
		RAISE EXCEPTION 'Teacher cannot access this student';
	END IF;

	INSERT INTO public.practice_jobs (
		job_type,
		test_id,
		student_id,
		assignment_submission_id,
		payload,
		run_after
	) VALUES (
		'assign_generate_test',
		NULL,
		v_student,
		p_assignment_submission_id,
		jsonb_build_object('assignment_submission_id', p_assignment_submission_id),
		COALESCE(p_run_after, NOW())
	)
	RETURNING id INTO v_job_id;

	RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assignment_enqueue_generate_test(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assignment_enqueue_generate_test(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_enqueue_generate_test(UUID, TIMESTAMPTZ) TO service_role;

-- Keep self-practice isolation: self-generated tests only abandon other self
-- practice rows, not educator-assigned attempts for the same subject.
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
	  AND COALESCE(test_type, 'self') = 'self'
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

	RETURN v_test_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_generate_test(UUID, TEXT, INT, INT, JSONB, JSONB) TO authenticated;

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
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF p_student_id IS NULL THEN
		RAISE EXCEPTION 'Student required';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
		RAISE EXCEPTION 'Assigned tests require a student profile';
	END IF;
	SELECT s.assignment_id, a.teacher_id
	INTO v_assignment_id, v_teacher_id
	FROM public.assignment_submissions s
	JOIN public.assignments a ON a.id = s.assignment_id
	WHERE s.id = p_assignment_submission_id
		AND s.student_id = p_student_id;
	IF v_assignment_id IS NULL OR v_teacher_id IS NULL THEN
		RAISE EXCEPTION 'Assignment submission not found';
	END IF;
	IF auth.uid() IS NOT NULL AND auth.uid() <> v_teacher_id THEN
		RAISE EXCEPTION 'Only the assignment teacher can generate assigned tests';
	END IF;
	IF auth.uid() IS NOT NULL AND NOT public.teacher_can_access_student(auth.uid(), p_student_id) THEN
		RAISE EXCEPTION 'Teacher cannot access this student';
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
GRANT EXECUTE ON FUNCTION public.practice_generate_assigned_test(UUID, UUID, UUID, TEXT, INT, INT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_generate_assigned_test(UUID, UUID, UUID, TEXT, INT, INT, JSONB, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: explicit, role-scoped read/write paths.
-- ---------------------------------------------------------------------------
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own assignments" ON public.assignments;
CREATE POLICY "Teachers manage own assignments"
ON public.assignments FOR ALL TO authenticated
USING (teacher_id = auth.uid() AND public.auth_is_verified_teacher(auth.uid()))
WITH CHECK (teacher_id = auth.uid() AND public.auth_is_verified_teacher(auth.uid()));

DROP POLICY IF EXISTS "Students read targeted assignments" ON public.assignments;
CREATE POLICY "Students read targeted assignments"
ON public.assignments FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.assignment_submissions s
		WHERE s.assignment_id = assignments.id
			AND s.student_id = auth.uid()
	)
);

DROP POLICY IF EXISTS "Parents read linked child assignments" ON public.assignments;
CREATE POLICY "Parents read linked child assignments"
ON public.assignments FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.assignment_submissions s
		JOIN public.parent_student_links psl ON psl.student_id = s.student_id
		WHERE s.assignment_id = assignments.id
			AND psl.parent_id = auth.uid()
			AND psl.status = 'active'
	)
);

DROP POLICY IF EXISTS "Teachers read own assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Teachers read own assignment submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.assignments a
		WHERE a.id = assignment_submissions.assignment_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);

DROP POLICY IF EXISTS "Students read own assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Students read own assignment submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Parents read linked child assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Parents read linked child assignment submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.parent_student_links psl
		WHERE psl.student_id = assignment_submissions.student_id
			AND psl.parent_id = auth.uid()
			AND psl.status = 'active'
	)
);

DROP POLICY IF EXISTS "Teachers insert assignment submissions for accessible students" ON public.assignment_submissions;
CREATE POLICY "Teachers insert assignment submissions for accessible students"
ON public.assignment_submissions FOR INSERT TO authenticated
WITH CHECK (
	EXISTS (
		SELECT 1
		FROM public.assignments a
		WHERE a.id = assignment_submissions.assignment_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
			AND public.teacher_can_access_student(auth.uid(), assignment_submissions.student_id)
	)
);

COMMIT;
