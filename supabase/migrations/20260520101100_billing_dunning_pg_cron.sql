-- W4.3 — daily dunning cron (day 3 / day 7 reminders + day 14 hard cancel).
-- 03:30 UTC = 09:00 IST. After the W4.2 pause-30day-cancel job (10/3) so we
-- don't hammer Razorpay with two cancellation passes simultaneously.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-run-dunning');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
	'billing-run-dunning',
	'30 3 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/run-dunning',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('billing-run-dunning-', to_char(date_trunc('day', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD'))
			),
			body := '{}'::jsonb
		);
	$cron$
);
