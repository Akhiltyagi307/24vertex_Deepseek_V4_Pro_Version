-- Parent portal QnA logs: allow linked-parent read access to question and answer rows
-- through the linked child's tests.

BEGIN;

DROP POLICY IF EXISTS "Parents view linked child questions" ON public.questions;
CREATE POLICY "Parents view linked child questions"
ON public.questions
FOR SELECT
TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.tests t
		JOIN public.parent_student_links psl ON psl.student_id = t.student_id
		WHERE t.id = public.questions.test_id
			AND psl.parent_id = auth.uid()
			AND (psl.status)::text = 'active'::text
	)
);

DROP POLICY IF EXISTS "Parents view linked child student answers" ON public.student_answers;
CREATE POLICY "Parents view linked child student answers"
ON public.student_answers
FOR SELECT
TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.tests t
		JOIN public.parent_student_links psl ON psl.student_id = t.student_id
		WHERE t.id = public.student_answers.test_id
			AND psl.parent_id = auth.uid()
			AND (psl.status)::text = 'active'::text
	)
);

COMMIT;
