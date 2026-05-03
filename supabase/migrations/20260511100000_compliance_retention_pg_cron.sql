-- Daily compliance retention purge: pg_cron + pg_net → Next.js internal route.
-- Reuses vault secrets from practice jobs migration:
--   app_base_url  (no trailing slash), cron_secret (must match CRON_SECRET on Vercel).
-- Schedule: 20:30 UTC daily = 02:00 IST (Asia/Kolkata; pg_cron uses UTC).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('compliance-retention-daily');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'compliance-retention-daily',
	'30 20 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/admin/compliance-retention',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
