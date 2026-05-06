-- W4.5 — weekly Razorpay offer validity check.
-- Sundays 04:00 UTC = 09:30 IST.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-validate-offers-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
	'billing-validate-offers-weekly',
	'0 4 * * 0',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/validate-razorpay-offers',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-validate-offers-', to_char(date_trunc('week', now() AT TIME ZONE 'UTC'), 'YYYY-WW'))
			),
			body := '{}'::jsonb
		);
	$cron$
);
