-- Admin Phase 8: operator jobs mirror, moderation, service health, integrity results,
-- extended admin_dashboard_metrics (PDR §4.25–§4.30).

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- 1) Operator jobs mirror (BullMQ / inline bulk jobs; not student practice_jobs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
	id VARCHAR(100) PRIMARY KEY,
	queue VARCHAR(100) NOT NULL,
	name VARCHAR(200) NOT NULL,
	payload JSONB,
	status VARCHAR(20) NOT NULL,
	progress INT NOT NULL DEFAULT 0,
	attempts INT NOT NULL DEFAULT 0,
	max_attempts INT NOT NULL DEFAULT 3,
	error TEXT,
	result JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	started_at TIMESTAMPTZ,
	finished_at TIMESTAMPTZ,
	triggered_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON public.jobs (queue, status);

-- ---------------------------------------------------------------------------
-- 2) Moderation (PDR §4.27)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_flags (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	entity_type VARCHAR(30) NOT NULL,
	entity_id UUID NOT NULL,
	reported_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
	source VARCHAR(30) NOT NULL,
	reason TEXT,
	severity VARCHAR(20) NOT NULL DEFAULT 'medium',
	status VARCHAR(20) NOT NULL DEFAULT 'open',
	resolution VARCHAR(30),
	resolution_notes TEXT,
	resolved_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT moderation_flags_severity_chk CHECK (severity IN ('low', 'medium', 'high', 'critical')),
	CONSTRAINT moderation_flags_status_chk CHECK (status IN ('open', 'reviewing', 'upheld', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON public.moderation_flags (status);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_entity ON public.moderation_flags (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_created ON public.moderation_flags (created_at DESC);

CREATE TABLE IF NOT EXISTS public.content_blacklist (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	pattern_type VARCHAR(20) NOT NULL,
	pattern TEXT NOT NULL,
	embedding vector(1536),
	reason TEXT NOT NULL,
	applies_to VARCHAR(30) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT content_blacklist_pattern_type_chk CHECK (pattern_type IN ('regex', 'embedding'))
);

CREATE INDEX IF NOT EXISTS idx_content_blacklist_applies ON public.content_blacklist (applies_to);

-- ---------------------------------------------------------------------------
-- 3) Service health pings (PDR §4.29)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_health_pings (
	id BIGSERIAL PRIMARY KEY,
	provider VARCHAR(30) NOT NULL,
	status VARCHAR(10) NOT NULL,
	latency_ms INT,
	error TEXT,
	checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT service_health_pings_status_chk CHECK (status IN ('ok', 'degraded', 'fail'))
);

CREATE INDEX IF NOT EXISTS idx_service_health_pings_provider_time
	ON public.service_health_pings (provider, checked_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Integrity check results (PDR §4.30)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integrity_check_results (
	id BIGSERIAL PRIMARY KEY,
	check_name VARCHAR(100) NOT NULL,
	rows_found INT NOT NULL,
	details JSONB,
	ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_check_results_name_time
	ON public.integrity_check_results (check_name, ran_at DESC);

-- ---------------------------------------------------------------------------
-- 5) RLS + grants (service_role only for app writes; students never touch these)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_check_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.moderation_flags FROM PUBLIC;
REVOKE ALL ON TABLE public.content_blacklist FROM PUBLIC;
REVOKE ALL ON TABLE public.service_health_pings FROM PUBLIC;
REVOKE ALL ON TABLE public.integrity_check_results FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.moderation_flags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_blacklist TO service_role;
GRANT SELECT, INSERT ON TABLE public.service_health_pings TO service_role;
GRANT SELECT, INSERT ON TABLE public.integrity_check_results TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.service_health_pings_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.integrity_check_results_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Dashboard materialized view: add open_dsrs, open_mod_flags, failed_jobs_24h
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.admin_dashboard_metrics;

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

COMMIT;
