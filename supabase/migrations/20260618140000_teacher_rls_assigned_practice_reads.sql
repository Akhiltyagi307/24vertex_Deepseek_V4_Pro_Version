-- Verified teachers: read assignment-linked tests, reports, and stored grading PDFs
-- via the same JWT/session Supabase client paths used by the teacher PDF route.
-- Legacy grade/section teacher policies were removed during teardown and never
-- replaced for the educator-assigned-practice model.

BEGIN;

DROP POLICY IF EXISTS "Verified teachers select assignment-linked tests" ON public.tests;
CREATE POLICY "Verified teachers select assignment-linked tests"
ON public.tests
FOR SELECT
TO authenticated
USING (
	EXISTS (
		SELECT 1
		FROM public.assignment_submissions s
		JOIN public.assignments a ON a.id = s.assignment_id
		WHERE a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
			AND s.student_id = tests.student_id
			AND (
				s.test_id = tests.id
				OR tests.assignment_submission_id = s.id
			)
	)
);

DROP POLICY IF EXISTS "Verified teachers select reports for assigned tests" ON public.test_reports;
CREATE POLICY "Verified teachers select reports for assigned tests"
ON public.test_reports
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
		WHERE t.id = test_reports.test_id
			AND test_reports.student_id = t.student_id
			AND a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
	)
);

DROP POLICY IF EXISTS "Teachers select assigned student test report PDFs" ON storage.objects;
CREATE POLICY "Teachers select assigned student test report PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
	bucket_id = 'student-test-reports'
	AND EXISTS (
		SELECT 1
		FROM public.tests t
		JOIN public.assignment_submissions s ON s.student_id = t.student_id
			AND (
				s.test_id = t.id
				OR t.assignment_submission_id = s.id
			)
		JOIN public.assignments a ON a.id = s.assignment_id
		WHERE a.teacher_id = auth.uid()
			AND public.auth_is_verified_teacher(auth.uid())
			AND (storage.foldername(name))[1] = s.student_id::text
			AND (storage.foldername(name))[2] = (t.id::text || '.pdf')
	)
);

COMMIT;
