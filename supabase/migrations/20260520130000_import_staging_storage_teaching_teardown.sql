-- Lock down _import_staging; reset storage.objects policies for avatars + student-test-reports to repo canonical rules;
-- idempotent teardown of teaching/assignment artifacts (aligns with 20260428203000 for envs where typmod reintroduced them).

-- ---------------------------------------------------------------------------
-- 1) public._import_staging: RLS on, no client policies, revoke API roles
-- ---------------------------------------------------------------------------
ALTER TABLE public._import_staging ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public._import_staging FROM PUBLIC;
REVOKE ALL ON TABLE public._import_staging FROM anon;
REVOKE ALL ON TABLE public._import_staging FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public._import_staging TO service_role;

-- ---------------------------------------------------------------------------
-- 2) storage.objects: drop bucket-specific policies (incl. dashboard names), recreate from canonical migrations
-- ---------------------------------------------------------------------------
DO $$
DECLARE
	r RECORD;
BEGIN
	FOR r IN
		SELECT policyname
		FROM pg_policies
		WHERE schemaname = 'storage'
			AND tablename = 'objects'
			AND (
				coalesce(qual::text, '') ILIKE '%avatars%'
				OR coalesce(with_check::text, '') ILIKE '%avatars%'
				OR coalesce(qual::text, '') ILIKE '%student-test-reports%'
				OR coalesce(with_check::text, '') ILIKE '%student-test-reports%'
			)
	LOOP
		EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
	END LOOP;
END $$;

-- Canonical: 20260414100000_student_avatars_storage.sql
CREATE POLICY "Avatars public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
	bucket_id = 'avatars'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
	bucket_id = 'avatars'
	AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
	bucket_id = 'avatars'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
	bucket_id = 'avatars'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Canonical: 20260419140000_student_test_reports_storage.sql
CREATE POLICY "Student test reports select own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
	bucket_id = 'student-test-reports'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
	bucket_id = 'student-test-reports'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
	bucket_id = 'student-test-reports'
	AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
	bucket_id = 'student-test-reports'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Student test reports delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
	bucket_id = 'student-test-reports'
	AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 3) Teaching / assignments teardown (idempotent; matches remove_teacher)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Teachers can view students in their grade/section" ON public.profiles;

DO $$
BEGIN
	IF to_regclass('public.performance_tracker') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers view students in their grade/section performance" ON public.performance_tracker';
	END IF;
	IF to_regclass('public.tests') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers view their students tests" ON public.tests';
	END IF;
	IF to_regclass('public.notifications') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers can insert notifications" ON public.notifications';
	END IF;
	IF to_regclass('public.assignments') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers select own assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers insert assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers update own assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers delete own assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Students view assignments for their grade/section" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Parents view child assignments" ON public.assignments';
	END IF;
	IF to_regclass('public.teacher_assignments') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers manage own assignments rows" ON public.teacher_assignments';
	END IF;
	IF to_regclass('public.questions') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers read questions for student tests in scope" ON public.questions';
	END IF;
	IF to_regclass('public.student_answers') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers read answers for in-scope tests" ON public.student_answers';
	END IF;
	IF to_regclass('public.test_reports') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers view test reports for in-scope students" ON public.test_reports';
	END IF;
	IF to_regclass('public.assignment_submissions') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Students manage own submissions" ON public.assignment_submissions';
		EXECUTE 'DROP POLICY IF EXISTS "Teachers view submissions for own assignments" ON public.assignment_submissions';
		EXECUTE 'DROP POLICY IF EXISTS "Parents view child submissions" ON public.assignment_submissions';
	END IF;
END $$;

DROP FUNCTION IF EXISTS public.auth_is_teacher();

UPDATE public.profiles
SET
	role = 'parent',
	subjects_taught = NULL,
	is_verified = COALESCE(is_verified, false)
WHERE role = 'teacher';

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'tests'
			AND column_name = 'assignment_id'
	) THEN
		UPDATE public.tests
		SET test_type = 'self', assignment_id = NULL
		WHERE test_type = 'assigned'
			OR assignment_id IS NOT NULL;
	END IF;
END $$;

UPDATE public.notifications
SET type = 'announcement'
WHERE type = 'assignment';

UPDATE public.user_preferences
SET notification_types = COALESCE(notification_types, '{}'::jsonb) - 'assignment'
WHERE notification_types ? 'assignment';

DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.teacher_assignments CASCADE;

DROP INDEX IF EXISTS public.idx_tests_assignment;
ALTER TABLE public.tests DROP COLUMN IF EXISTS assignment_id;

ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_test_type_check;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_test_type_check CHECK (test_type IN ('self'));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
	ADD CONSTRAINT notifications_type_check CHECK (
		type IN ('test_result', 'announcement', 'reminder', 'alert', 'system', 'encouragement')
	);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
	ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'parent', 'admin'));

DROP FUNCTION IF EXISTS public.register_teacher(text, text, uuid[], jsonb);
DROP FUNCTION IF EXISTS public.get_subjects_for_teacher_signup();

DELETE FROM public.retention_policies WHERE entity = 'assignment_submissions';
