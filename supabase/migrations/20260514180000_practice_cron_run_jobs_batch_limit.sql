-- Bump pg_cron worker batch limit so each minute drains more pending grade/pdf/email jobs.
-- Apply identically to Supabase dev + main (vault secrets app_base_url + cron_secret required).

BEGIN;

DO $$
BEGIN
	PERFORM cron.unschedule('practice-run-jobs-every-minute');
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
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/practice/run-jobs?limit=10',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
