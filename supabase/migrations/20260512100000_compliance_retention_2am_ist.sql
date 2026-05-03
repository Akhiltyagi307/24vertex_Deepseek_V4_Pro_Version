-- Reschedule compliance retention to 02:00 IST (20:30 UTC daily).
-- Safe if a project already applied 20260511100000_compliance_retention_pg_cron.sql with the old 21:30 UTC slot.

BEGIN;

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
