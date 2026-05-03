-- Admin Phase 7: compliance_requests, parental_consents, retention_policies (PDR §4.23).

BEGIN;

CREATE TABLE IF NOT EXISTS public.compliance_requests (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	request_type VARCHAR(30) NOT NULL,
	subject_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
	subject_email VARCHAR(320),
	requester_email VARCHAR(320) NOT NULL,
	requester_relation VARCHAR(30) NOT NULL,
	legal_basis VARCHAR(50) NOT NULL,
	identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
	status VARCHAR(20) NOT NULL DEFAULT 'open',
	notes TEXT,
	fulfilled_at TIMESTAMPTZ,
	evidence_url TEXT,
	due_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_requests_status_due
	ON public.compliance_requests (status, due_at);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_subject_user
	ON public.compliance_requests (subject_user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_created
	ON public.compliance_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS public.parental_consents (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
	parent_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
	parent_email VARCHAR(320) NOT NULL,
	consent_method VARCHAR(30) NOT NULL,
	consent_text_v VARCHAR(20) NOT NULL,
	granted_at TIMESTAMPTZ,
	revoked_at TIMESTAMPTZ,
	evidence_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_parental_consents_student ON public.parental_consents (student_id);
CREATE INDEX IF NOT EXISTS idx_parental_consents_parent_email ON public.parental_consents (parent_email);
CREATE INDEX IF NOT EXISTS idx_parental_consents_revoked ON public.parental_consents (revoked_at)
	WHERE revoked_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.retention_policies (
	entity VARCHAR(100) PRIMARY KEY,
	ttl_days INTEGER NOT NULL,
	enabled BOOLEAN NOT NULL DEFAULT FALSE,
	last_purge TIMESTAMPTZ
);

INSERT INTO public.retention_policies (entity, ttl_days, enabled)
VALUES
	('tests', 730, FALSE),
	('questions', 730, FALSE),
	('student_answers', 730, FALSE),
	('test_reports', 730, FALSE),
	('notifications', 365, FALSE),
	('audit_logs', 2555, FALSE),
	('assignment_submissions', 730, FALSE),
	('performance_tracker', 730, FALSE),
	('user_preferences', 365, FALSE),
	('parent_student_links', 730, FALSE),
	('email_log', 365, FALSE),
	('doubt_conversations', 365, FALSE),
	('coupon_redemptions', 2555, FALSE),
	('payments', 2555, FALSE)
ON CONFLICT (entity) DO NOTHING;

REVOKE ALL ON TABLE public.compliance_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.parental_consents FROM PUBLIC;
REVOKE ALL ON TABLE public.retention_policies FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compliance_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.parental_consents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.retention_policies TO service_role;

COMMIT;
