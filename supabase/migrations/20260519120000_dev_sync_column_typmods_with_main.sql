-- Align public column typmods on dev with main (format_type / typmod parity).
-- Includes DROP/CREATE RLS policies and DROP/CREATE triggers that reference altered columns.
-- Vector columns use USING casts so typmod is enforced; fails if stored dimension mismatches.
--
-- Policies that reference parent_student_links.status must be dropped before altering that column.
-- Assignment-related drops/ALTERs are skipped when teaching tables were removed (20260428203000).

DO $$
BEGIN
	IF to_regclass('public.assignment_submissions') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Parents view child submissions" ON public.assignment_submissions';
	END IF;
	IF to_regclass('public.assignments') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Parents view child assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Students view assignments for their grade/section" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Teachers select own assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers delete own assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers insert assignments" ON public.assignments';
		EXECUTE 'DROP POLICY IF EXISTS "Verified teachers update own assignments" ON public.assignments';
	END IF;
	IF to_regclass('public.teacher_assignments') IS NOT NULL THEN
		EXECUTE 'DROP POLICY IF EXISTS "Teachers manage own assignments rows" ON public.teacher_assignments';
	END IF;
END $$;

DROP POLICY IF EXISTS "Parents read linked student doubt conversations" ON public.doubt_conversations;
DROP POLICY IF EXISTS "Parents read linked student doubt messages" ON public.doubt_messages;
DROP POLICY IF EXISTS "payments_select_linked_student" ON public.payments;
DROP POLICY IF EXISTS "Parents view linked child performance" ON public.performance_tracker;
DROP POLICY IF EXISTS "Parents can view linked children profiles" ON public.profiles;
DROP POLICY IF EXISTS "subscriptions_select_linked_student" ON public.subscriptions;
DROP POLICY IF EXISTS "Parents view linked child test reports" ON public.test_reports;
DROP POLICY IF EXISTS "Parents view linked child tests" ON public.tests;
DROP POLICY IF EXISTS "usage_periods_select_linked_student" ON public.usage_periods;
DROP POLICY IF EXISTS "Verified teachers can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Teachers view students in their grade/section performance" ON public.performance_tracker;
DROP POLICY IF EXISTS "Teachers read questions for student tests in scope" ON public.questions;
DROP POLICY IF EXISTS "Teachers read answers for in-scope tests" ON public.student_answers;
DROP POLICY IF EXISTS "Teachers view test reports for in-scope students" ON public.test_reports;
DROP POLICY IF EXISTS "Teachers view their students tests" ON public.tests;

DO $$
BEGIN
	IF to_regclass('public.assignment_submissions') IS NOT NULL THEN
		ALTER TABLE public.assignment_submissions
			ALTER COLUMN penalty_applied SET DATA TYPE numeric(5,2),
			ALTER COLUMN score SET DATA TYPE numeric(5,2),
			ALTER COLUMN status SET DATA TYPE character varying(20);
	END IF;
	IF to_regclass('public.assignments') IS NOT NULL THEN
		ALTER TABLE public.assignments
			ALTER COLUMN assignment_type SET DATA TYPE character varying(20),
			ALTER COLUMN difficulty SET DATA TYPE character varying(10),
			ALTER COLUMN late_submission_policy SET DATA TYPE character varying(20),
			ALTER COLUMN status SET DATA TYPE character varying(20),
			ALTER COLUMN target_sections SET DATA TYPE character varying(5)[],
			ALTER COLUMN title SET DATA TYPE character varying(300),
			ALTER COLUMN unit_name SET DATA TYPE character varying(250);
	END IF;
END $$;

-- audit_logs
ALTER TABLE public.audit_logs
  ALTER COLUMN action SET DATA TYPE character varying(100),
  ALTER COLUMN entity_type SET DATA TYPE character varying(100);

-- email_log
ALTER TABLE public.email_log
  ALTER COLUMN provider_message_id SET DATA TYPE character varying(200),
  ALTER COLUMN recipient_email SET DATA TYPE character varying(320),
  ALTER COLUMN status SET DATA TYPE character varying(20),
  ALTER COLUMN subject SET DATA TYPE character varying(500),
  ALTER COLUMN template SET DATA TYPE character varying(100);

-- Materialized view references profiles.role and tests.status (typmod alters below).
DROP MATERIALIZED VIEW IF EXISTS public.admin_dashboard_metrics;

-- notifications
ALTER TABLE public.notifications
  ALTER COLUMN category SET DATA TYPE character varying(30),
  ALTER COLUMN priority SET DATA TYPE character varying(10),
  ALTER COLUMN reference_type SET DATA TYPE character varying(30),
  ALTER COLUMN title SET DATA TYPE character varying(300),
  ALTER COLUMN "type" SET DATA TYPE character varying(30);

-- parent_student_links (trigger references status)
DROP TRIGGER IF EXISTS trg_parent_student_links_student_guard ON public.parent_student_links;
ALTER TABLE public.parent_student_links
  ALTER COLUMN status SET DATA TYPE character varying(20);
CREATE TRIGGER trg_parent_student_links_student_guard
  BEFORE UPDATE ON public.parent_student_links
  FOR EACH ROW
  EXECUTE FUNCTION public.parent_student_links_enforce_student_updates();

-- performance_tracker
ALTER TABLE public.performance_tracker
  ALTER COLUMN average_score SET DATA TYPE numeric(5,2),
  ALTER COLUMN confidence_score SET DATA TYPE numeric(3,2),
  ALTER COLUMN status SET DATA TYPE character varying(20),
  ALTER COLUMN trend SET DATA TYPE character varying(20);

-- profiles (trigger references role / curriculum columns)
DROP TRIGGER IF EXISTS trg_profiles_sync_performance_tracker_curriculum ON public.profiles;
ALTER TABLE public.profiles
  ALTER COLUMN full_name SET DATA TYPE character varying(200),
  ALTER COLUMN parent_email SET DATA TYPE character varying(320),
  ALTER COLUMN parent_name SET DATA TYPE character varying(200),
  ALTER COLUMN role SET DATA TYPE character varying(20),
  ALTER COLUMN school_name SET DATA TYPE character varying(300),
  ALTER COLUMN section SET DATA TYPE character varying(5),
  ALTER COLUMN stream SET DATA TYPE character varying(50),
  ALTER COLUMN student_link_code SET DATA TYPE character varying(6);
CREATE TRIGGER trg_profiles_sync_performance_tracker_curriculum
  AFTER INSERT OR UPDATE OF role, grade, stream, elective_subject_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_sync_performance_tracker_on_curriculum_change();

-- questions
ALTER TABLE public.questions
  ALTER COLUMN difficulty_level SET DATA TYPE character varying(10),
  ALTER COLUMN question_type SET DATA TYPE character varying(20),
  ALTER COLUMN embedding SET DATA TYPE vector(1536) USING (embedding::vector(1536));

-- resources
ALTER TABLE public.resources
  ALTER COLUMN difficulty_level SET DATA TYPE character varying(20),
  ALTER COLUMN rating SET DATA TYPE numeric(3,2),
  ALTER COLUMN resource_type SET DATA TYPE character varying(20),
  ALTER COLUMN source SET DATA TYPE character varying(100),
  ALTER COLUMN title SET DATA TYPE character varying(255),
  ALTER COLUMN url SET DATA TYPE character varying(1000);

-- student_answers
ALTER TABLE public.student_answers
  ALTER COLUMN score_earned SET DATA TYPE numeric(5,2);

-- subjects
ALTER TABLE public.subjects
  ALTER COLUMN name SET DATA TYPE character varying(250),
  ALTER COLUMN stream SET DATA TYPE character varying(50),
  ALTER COLUMN subject_group SET DATA TYPE character varying(200);

ALTER TABLE public.subjects
  ALTER COLUMN subject_group SET DEFAULT NULL::character varying,
  ALTER COLUMN stream SET DEFAULT NULL::character varying;

-- teacher_assignments (skipped when table removed)
DO $$
BEGIN
	IF to_regclass('public.teacher_assignments') IS NOT NULL THEN
		ALTER TABLE public.teacher_assignments
			ALTER COLUMN section SET DATA TYPE character varying(5);
	END IF;
END $$;

-- tests
ALTER TABLE public.tests
  ALTER COLUMN difficulty SET DATA TYPE character varying(10),
  ALTER COLUMN status SET DATA TYPE character varying(20),
  ALTER COLUMN test_type SET DATA TYPE character varying(20),
  ALTER COLUMN total_score SET DATA TYPE numeric(5,2),
  ALTER COLUMN unit_name SET DATA TYPE character varying(250);

-- topic_context_chunks
ALTER TABLE public.topic_context_chunks
  ALTER COLUMN embedding SET DATA TYPE vector(1024) USING (embedding::vector(1024));

-- topics
ALTER TABLE public.topics
  ALTER COLUMN chapter_name SET DATA TYPE character varying(250),
  ALTER COLUMN topic_name SET DATA TYPE character varying(250),
  ALTER COLUMN unit_name SET DATA TYPE character varying(250);

-- user_preferences
ALTER TABLE public.user_preferences
  ALTER COLUMN preferred_difficulty SET DATA TYPE character varying(10),
  ALTER COLUMN preferred_language SET DATA TYPE character varying(5);

-- admin_dashboard_metrics (same definition as 20260515130000_admin_phase8_operational.sql)
CREATE MATERIALIZED VIEW public.admin_dashboard_metrics AS
SELECT
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE last_active_at > NOW() - INTERVAL '24 hours') AS active_24h,
	(SELECT COUNT(*)::bigint FROM public.tests WHERE status = 'submitted' AND (created_at::date = CURRENT_DATE)) AS tests_submitted_today,
	(SELECT COUNT(*)::bigint FROM public.tests WHERE status = 'in_progress') AS tests_in_progress,
	(SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active') AS active_subscriptions,
	(
		SELECT COALESCE(
			(SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_monthly') * 1000
			+ (SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_annual') * 833,
			0::bigint
		)
	) AS mrr_inr,
	(SELECT COUNT(*)::bigint FROM public.profiles WHERE role = 'teacher' AND COALESCE(is_verified, FALSE) = FALSE) AS pending_teacher_approvals,
	(
		SELECT COUNT(*)::bigint FROM public.billing_events
		WHERE processed_at IS NULL
		  AND created_at < NOW() - INTERVAL '5 minutes'
		  AND event_type NOT LIKE 'admin\_%' ESCAPE '\'
	) AS stuck_webhooks,
	(
		SELECT COUNT(*)::bigint FROM public.compliance_requests
		WHERE status IN ('open', 'in_progress')
	) AS open_dsrs,
	(
		SELECT COUNT(*)::bigint FROM public.moderation_flags
		WHERE status IN ('open', 'reviewing')
	) AS open_mod_flags,
	(
		SELECT COUNT(*)::bigint FROM public.jobs
		WHERE status = 'failed'
		  AND created_at > NOW() - INTERVAL '24 hours'
	) AS failed_jobs_24h,
	NOW() AS computed_at;

CREATE UNIQUE INDEX IF NOT EXISTS admin_dashboard_metrics_computed_at_key ON public.admin_dashboard_metrics (computed_at);

GRANT SELECT ON public.admin_dashboard_metrics TO service_role;

-- Recreate policies that reference parent_student_links.status (after all typmods).
-- Assignment / teacher-assignment policies are omitted — product no longer includes teaching tables (20260428203000).

CREATE POLICY "Parents read linked student doubt conversations" ON public.doubt_conversations
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = doubt_conversations.student_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "Parents read linked student doubt messages" ON public.doubt_messages
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM (doubt_conversations c
         JOIN parent_student_links psl ON ((psl.student_id = c.student_id)))
      WHERE ((c.id = doubt_messages.conversation_id) AND (psl.parent_id = auth.uid()) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "payments_select_linked_student" ON public.payments
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = payments.profile_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "Parents view linked child performance" ON public.performance_tracker
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = performance_tracker.student_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "Parents can view linked children profiles" ON public.profiles
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = profiles.id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "subscriptions_select_linked_student" ON public.subscriptions
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = subscriptions.profile_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "Parents view linked child test reports" ON public.test_reports
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = test_reports.student_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "Parents view linked child tests" ON public.tests
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = tests.student_id) AND ((psl.status)::text = 'active'::text))))
  );

CREATE POLICY "usage_periods_select_linked_student" ON public.usage_periods
  FOR SELECT USING (
    (EXISTS ( SELECT 1
       FROM parent_student_links psl
      WHERE ((psl.parent_id = auth.uid()) AND (psl.student_id = usage_periods.profile_id) AND ((psl.status)::text = 'active'::text))))
  );
