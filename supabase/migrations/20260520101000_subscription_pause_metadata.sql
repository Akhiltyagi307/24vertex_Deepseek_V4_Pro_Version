-- W4.2 — pause / resume support.
--
-- subscriptions.paused_at  records when we entered the paused state so the
-- 30-day auto-cancel cron knows when the grace period expires.
--
-- usage_periods.pre_pause_quota stashes (tests_quota, tokens_quota) at pause
-- time so resume can restore them. Without this, resume would have to
-- recompute quotas from the plan, which is wrong if the plan-change pipeline
-- ran while paused (the pre-pause quotas reflected the plan at pause time).
--
-- Plus a pg_cron job 'billing-pause-30day-cancel' that nightly hard-cancels
-- subscriptions stuck paused longer than 30 days.

ALTER TABLE public.subscriptions
	ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_at
	ON public.subscriptions (paused_at)
	WHERE paused_at IS NOT NULL;

ALTER TABLE public.usage_periods
	ADD COLUMN IF NOT EXISTS pre_pause_quota JSONB;

COMMENT ON COLUMN public.subscriptions.paused_at IS
	'When the subscription entered status=paused. Used by the W4.2 30-day auto-cancel cron.';

COMMENT ON COLUMN public.usage_periods.pre_pause_quota IS
	'Stash of {tests_quota, tokens_quota} at pause time so resume can restore. NULL when not paused.';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-pause-30day-cancel');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
	'billing-pause-30day-cancel',
	'10 3 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/pause-auto-cancel',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-pause-30day-cancel-', to_char(date_trunc('day', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD'))
			),
			body := '{}'::jsonb
		);
	$cron$
);
