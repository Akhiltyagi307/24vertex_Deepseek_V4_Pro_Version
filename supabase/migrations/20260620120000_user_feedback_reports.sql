-- User feedback reports: bugs, crashes, stuck flows, and suggestions from student/teacher/parent portals.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_feedback_reports (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
	portal VARCHAR(20) NOT NULL,
	category VARCHAR(30) NOT NULL,
	impact VARCHAR(20),
	title VARCHAR(200),
	description TEXT NOT NULL,
	page_path TEXT NOT NULL,
	sentry_event_id VARCHAR(64),
	error_digest VARCHAR(64),
	context JSONB NOT NULL DEFAULT '{}'::jsonb,
	status VARCHAR(20) NOT NULL DEFAULT 'open',
	admin_notes TEXT,
	resolved_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT user_feedback_reports_portal_chk CHECK (portal IN ('student', 'teacher', 'parent')),
	CONSTRAINT user_feedback_reports_category_chk CHECK (
		category IN ('bug', 'crash', 'stuck', 'suggestion', 'other')
	),
	CONSTRAINT user_feedback_reports_impact_chk CHECK (
		impact IS NULL OR impact IN ('blocked', 'major', 'minor')
	),
	CONSTRAINT user_feedback_reports_status_chk CHECK (
		status IN ('open', 'triaged', 'resolved', 'closed')
	)
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_reports_status_created
	ON public.user_feedback_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_feedback_reports_user_created
	ON public.user_feedback_reports (user_id, created_at DESC);

ALTER TABLE public.user_feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback reports"
	ON public.user_feedback_reports FOR INSERT TO authenticated
	WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_feedback_reports FROM PUBLIC;
GRANT INSERT ON TABLE public.user_feedback_reports TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.user_feedback_reports TO service_role;

COMMIT;
