-- Student subscription price update: ₹600/month, ₹6,000/year (2 months free vs monthly).
-- Mirrors src/lib/billing/plans.ts PLAN_CATALOG.

BEGIN;

UPDATE public.plans
SET price_paise = 60000, updated_at = NOW()
WHERE code = 'pro_monthly';

UPDATE public.plans
SET price_paise = 600000, updated_at = NOW()
WHERE code = 'pro_annual';

-- Admin MRR estimate: monthly subs at ₹600, annual subs at ₹500/mo (₹6,000 ÷ 12).
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
			(SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_monthly') * 600
			+ (SELECT COUNT(*)::bigint FROM public.subscriptions WHERE status = 'active' AND plan_code = 'pro_annual') * 500,
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
