-- Daily trial-ending email cron (was orphaned: route exists but nothing called it).
-- Reuses vault secrets `app_base_url` and `cron_secret` set up by
-- `20260429123000_practice_jobs_pg_cron.sql`.
--
-- Schedule: 03:00 UTC = 08:30 IST. Runs once a day; the route itself dedupes
-- via subscriptions.metadata.trial_emails_sent so re-runs are safe.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('billing-trial-emails-daily');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'billing-trial-emails-daily',
	'0 3 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/billing/trial-emails',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
