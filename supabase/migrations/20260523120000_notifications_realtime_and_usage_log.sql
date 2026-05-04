-- In-app notifications MVP: add `notifications` to Supabase Realtime publication
-- and create `usage_notification_log` for strict 80% / 100% threshold idempotency.
--
-- Applied to both Supabase dev and main (see .cursor/rules/supabase-dev-main-sync.mdc).
-- DDL only: no data rewrites.

-- 1) Enable Realtime for the notifications table so the student shell can
--    subscribe via supabase-js postgres_changes. RLS on notifications already
--    limits row visibility to `auth.uid() = recipient_id`, so the channel
--    filter below cannot leak rows between users.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_publication_tables
		WHERE pubname = 'supabase_realtime'
			AND schemaname = 'public'
			AND tablename = 'notifications'
	) THEN
		EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
	END IF;
END $$;

-- 2) Threshold log: one row per (profile, usage_period, meter, threshold).
--    Writers INSERT ... ON CONFLICT DO NOTHING; only the winner emits the
--    notification + email. Prevents duplicate 80% / 100% alerts when
--    `billing_consume_test` / `billing_consume_tokens` run concurrently or
--    when the billing-period row is re-read at the same threshold.
CREATE TABLE IF NOT EXISTS public.usage_notification_log (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	usage_period_id UUID NOT NULL REFERENCES public.usage_periods(id) ON DELETE CASCADE,
	meter VARCHAR(16) NOT NULL CHECK (meter IN ('tests', 'tokens')),
	threshold SMALLINT NOT NULL CHECK (threshold IN (80, 100)),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (profile_id, usage_period_id, meter, threshold)
);

CREATE INDEX IF NOT EXISTS idx_usage_notif_log_profile_created
	ON public.usage_notification_log (profile_id, created_at DESC);

COMMENT ON TABLE public.usage_notification_log IS
	'Idempotency ledger for usage-threshold notifications (80% / 100% of tests and tokens quota).';

-- 3) RLS: server-only writes (Drizzle via postgres-js runs as the app DB role,
--    or service_role). Deny authenticated/anon by default. `notifications`
--    carries the user-visible row; this table never needs to be read from the
--    browser.
ALTER TABLE public.usage_notification_log ENABLE ROW LEVEL SECURITY;

-- No policies = client roles (authenticated/anon) get no access. service_role
-- and the app DB role bypass RLS via superuser-ish grants.
REVOKE ALL ON TABLE public.usage_notification_log FROM authenticated, anon;

-- 4) Retention: align with `notifications` (365 days, see admin_phase7_compliance).
INSERT INTO public.retention_policies (entity, ttl_days, enabled)
VALUES ('usage_notification_log', 365, FALSE)
ON CONFLICT (entity) DO NOTHING;
