-- W3.1 — billing expiry pg_cron jobs.
--
-- Two scheduled tasks:
--   1. billing-expire-coupons      daily 00:05 UTC (05:35 IST)
--      → POST /api/internal/billing/expire-coupons
--      Disables coupons whose expires_at is past so they stop showing as
--      redeemable in the admin UI and can't be applied at checkout.
--
--   2. billing-expire-coupon-subs  hourly :15
--      → POST /api/internal/billing/expire-coupon-subscriptions
--      Flips subscriptions with status='coupon' AND current_period_end<now()
--      to status='expired'. Without this, a 30-day coupon-granted access
--      never auto-revokes; the student keeps Pro entitlements past the
--      coupon period until an admin manually intervenes.
--
-- Reuses vault secrets `app_base_url` and `cron_secret` set up by
-- 20260516100000_internal_http_routes_pg_cron.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-expire-coupons');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-expire-coupon-subs');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
	'billing-expire-coupons',
	'5 0 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/expire-coupons',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-expire-coupons-', to_char(date_trunc('day', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD'))
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'billing-expire-coupon-subs',
	'15 * * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/expire-coupon-subscriptions',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-expire-coupon-subs-', to_char(date_trunc('hour', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD-HH24'))
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
