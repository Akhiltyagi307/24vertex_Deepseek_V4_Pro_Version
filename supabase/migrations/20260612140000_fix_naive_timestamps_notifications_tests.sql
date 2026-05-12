-- notifications + tests: `timestamp without time zone` is returned by PostgREST without a UTC
-- offset. ECMAScript then parses values like `2026-05-12T10:30:00` as *local* wall time (e.g.
-- IST), shifting instants by ~5h30m vs the intended UTC instant. Use `timestamptz` so APIs emit
-- RFC3339 with a zone and `new Date()` is correct everywhere.
--
-- Naive values written via `NOW()` under Supabase default UTC session map to the same instants
-- when interpreted as UTC.

DROP MATERIALIZED VIEW IF EXISTS public.admin_dashboard_metrics;

ALTER TABLE public.notifications
	ALTER COLUMN created_at TYPE timestamptz USING (created_at AT TIME ZONE 'UTC'),
	ALTER COLUMN read_at TYPE timestamptz USING (read_at AT TIME ZONE 'UTC'),
	ALTER COLUMN email_sent_at TYPE timestamptz USING (email_sent_at AT TIME ZONE 'UTC');

ALTER TABLE public.tests
	ALTER COLUMN test_date TYPE timestamptz USING (test_date AT TIME ZONE 'UTC'),
	ALTER COLUMN started_at TYPE timestamptz USING (started_at AT TIME ZONE 'UTC'),
	ALTER COLUMN abandoned_at TYPE timestamptz USING (abandoned_at AT TIME ZONE 'UTC'),
	ALTER COLUMN created_at TYPE timestamptz USING (created_at AT TIME ZONE 'UTC'),
	ALTER COLUMN updated_at TYPE timestamptz USING (updated_at AT TIME ZONE 'UTC');

-- Same definition as 20260519120000_dev_sync_column_typmods_with_main.sql (admin phase 8).
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
