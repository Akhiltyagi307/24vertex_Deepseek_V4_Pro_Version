-- Move high-frequency practice workers from Vercel Cron (Hobby-limited)
-- to Supabase pg_cron + pg_net.
--
-- Required vault secrets before these jobs can run successfully:
-- - app_base_url  (example: https://eduai.app)
-- - cron_secret   (must match app CRON_SECRET env)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('practice-run-jobs-every-minute');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('practice-auto-submit-expired-every-minute');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'practice-run-jobs-every-minute',
	'* * * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/practice/run-jobs',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'practice-auto-submit-expired-every-minute',
	'* * * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/practice/auto-submit-expired',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
