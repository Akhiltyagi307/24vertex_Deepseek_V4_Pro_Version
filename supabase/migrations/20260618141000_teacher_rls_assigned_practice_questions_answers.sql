-- Verified teachers: read questions and answers for tests tied to their assignments
-- (JWT/session Supabase paths). Mirrors educator-assigned practice linkage used on
-- public.tests / public.test_reports.

BEGIN;

DROP POLICY IF EXISTS "Verified teachers select questions for assigned tests" ON public.questions;
CREATE POLICY "Verified teachers select questions for assigned tests"
ON public.questions
FOR SELECT
TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.tests t
		JOIN public.assignment_submissions s ON s.student_id = t.student_id
			AND (
				s.test_id = t.id
				OR t.assignment_submission_id = s.id
			)
		JOIN public.assignments a ON a.id = s.assignment_id
		WHERE t.id = public.questions.test_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);

DROP POLICY IF EXISTS "Verified teachers select answers for assigned tests" ON public.student_answers;
CREATE POLICY "Verified teachers select answers for assigned tests"
ON public.student_answers
FOR SELECT
TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.tests t
		JOIN public.assignment_submissions s ON s.student_id = t.student_id
			AND (
				s.test_id = t.id
				OR t.assignment_submission_id = s.id
			)
		JOIN public.assignments a ON a.id = s.assignment_id
		WHERE t.id = public.student_answers.test_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);

COMMIT;
