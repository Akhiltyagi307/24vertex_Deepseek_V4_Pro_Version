-- Remove teacher portal, assignment tables, and related RLS/RPCs (product no longer includes teachers or school assignments).

-- --- RLS: drop policies that reference teacher_assignments or teacher role ---
DROP POLICY IF EXISTS "Teachers can view students in their grade/section" ON public.profiles;
DROP POLICY IF EXISTS "Teachers view students in their grade/section performance" ON public.performance_tracker;
DROP POLICY IF EXISTS "Teachers view their students tests" ON public.tests;
DROP POLICY IF EXISTS "Verified teachers can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers select own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Verified teachers insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "Verified teachers update own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Verified teachers delete own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students view assignments for their grade/section" ON public.assignments;
DROP POLICY IF EXISTS "Parents view child assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers manage own assignments rows" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Teachers read questions for student tests in scope" ON public.questions;
DROP POLICY IF EXISTS "Teachers read answers for in-scope tests" ON public.student_answers;
DROP POLICY IF EXISTS "Teachers view test reports for in-scope students" ON public.test_reports;
DROP POLICY IF EXISTS "Students manage own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Teachers view submissions for own assignments" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Parents view child submissions" ON public.assignment_submissions;

DROP FUNCTION IF EXISTS public.auth_is_teacher();

-- --- Data migration before structural drops ---
UPDATE public.profiles
SET
    role = 'parent',
    subjects_taught = NULL,
    is_verified = COALESCE(is_verified, false)
WHERE role = 'teacher';

UPDATE public.tests
SET test_type = 'self', assignment_id = NULL
WHERE test_type = 'assigned' OR assignment_id IS NOT NULL;

UPDATE public.notifications
SET type = 'announcement'
WHERE type = 'assignment';

UPDATE public.user_preferences
SET notification_types = COALESCE(notification_types, '{}'::jsonb) - 'assignment';

-- --- Drop assignment-related tables (FK order) ---
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

-- --- Remove teacher registration RPCs ---
DROP FUNCTION IF EXISTS public.register_teacher(text, text, uuid[], jsonb);
DROP FUNCTION IF EXISTS public.get_subjects_for_teacher_signup();
