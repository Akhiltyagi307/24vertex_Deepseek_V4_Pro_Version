-- Admin Panel Phase 1: profiles suspend/deleted, append-only audit log, admin sessions,
-- feature_flags seeds, reduced admin_dashboard_metrics (tables that exist today only), pg_cron refresh.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles augment (PDR §6 item 1)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
	ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles (is_suspended) WHERE is_suspended = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. admin_action_log append-only (PDR §6 item 2, immutability fix)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_action_log (
	id BIGSERIAL PRIMARY KEY,
	action VARCHAR(100) NOT NULL,
	target_type VARCHAR(100),
	target_id TEXT,
	payload JSONB,
	ip_address INET,
	user_agent TEXT,
	totp_used BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aal_created ON public.admin_action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_action ON public.admin_action_log (action);
CREATE INDEX IF NOT EXISTS idx_aal_target ON public.admin_action_log (target_type, target_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_action_log FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_action_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_action_log FROM service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_action_log FROM anon;

CREATE OR REPLACE FUNCTION public.block_admin_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'admin_action_log is append-only (op=%)', TG_OP USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS admin_log_no_update ON public.admin_action_log;
DROP TRIGGER IF EXISTS admin_log_no_delete ON public.admin_action_log;
DROP TRIGGER IF EXISTS admin_log_no_truncate ON public.admin_action_log;

CREATE TRIGGER admin_log_no_update
	BEFORE UPDATE ON public.admin_action_log
	FOR EACH ROW
	EXECUTE FUNCTION public.block_admin_log_mutation();

CREATE TRIGGER admin_log_no_delete
	BEFORE DELETE ON public.admin_action_log
	FOR EACH ROW
	EXECUTE FUNCTION public.block_admin_log_mutation();

CREATE TRIGGER admin_log_no_truncate
	BEFORE TRUNCATE ON public.admin_action_log
	FOR EACH STATEMENT
	EXECUTE FUNCTION public.block_admin_log_mutation();

GRANT SELECT, INSERT ON public.admin_action_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_action_log_id_seq TO service_role;

-- ---------------------------------------------------------------------------
-- 3. admin_sessions (PDR §6 item 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_sessions (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	jwt_id VARCHAR(100) NOT NULL UNIQUE,
	ip_address INET,
	user_agent TEXT,
	totp_used BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMPTZ DEFAULT NOW(),
	last_seen_at TIMESTAMPTZ DEFAULT NOW(),
	revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_jwt ON public.admin_sessions (jwt_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.admin_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- 5. feature_flags (PDR §6 item 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
	key VARCHAR(100) PRIMARY KEY,
	value JSONB NOT NULL,
	description TEXT,
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.feature_flags (key, value, description)
VALUES
	('SAAS_ENFORCEMENT', to_jsonb(true), 'Enforce SaaS quotas at server boundaries'),
	('MAINTENANCE_MODE', jsonb_build_object('enabled', false), 'Block all non-admin traffic'),
	('ENABLE_DOUBT_CHAT', to_jsonb(true), 'Allow doubt-chat feature'),
	('STRICT_TRIAL_IDENTITY', to_jsonb(true), 'Honor free_trial_claims uniqueness'),
	('ADMIN_TOTP_REQUIRED', to_jsonb(false), 'Require TOTP on admin login'),
	('MODERATION_PRE_CHECK', to_jsonb(true), 'Run moderation filter on AI output before delivery')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, UPDATE, INSERT ON public.feature_flags TO service_role;

-- ---------------------------------------------------------------------------
-- 18. Reduced dashboard materialized view (only existing tables)
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
	(SELECT COUNT(*)::bigint FROM public.billing_events WHERE processed_at IS NULL AND created_at < NOW() - INTERVAL '5 minutes') AS stuck_webhooks,
	NOW() AS computed_at;

CREATE UNIQUE INDEX IF NOT EXISTS admin_dashboard_metrics_computed_at_key ON public.admin_dashboard_metrics (computed_at);

GRANT SELECT ON public.admin_dashboard_metrics TO service_role;

-- ---------------------------------------------------------------------------
-- pg_cron: refresh mat view (idempotent schedule)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
	PERFORM cron.unschedule('refresh-admin-dashboard-metrics');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'refresh-admin-dashboard-metrics',
	'* * * * *',
	$refresh$
		REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_dashboard_metrics;
	$refresh$
);

COMMIT;
