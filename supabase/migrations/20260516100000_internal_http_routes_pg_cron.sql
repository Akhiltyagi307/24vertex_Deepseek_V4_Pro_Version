-- Standard: schedule internal Next.js routes via Supabase pg_cron + pg_net (not Vercel crons).
-- Reuses vault secrets from `20260429123000_practice_jobs_pg_cron.sql`:
--   app_base_url  (no trailing slash), cron_secret (must match app CRON_SECRET).
--
-- Schedules (UTC) match former vercel.json entries:
--   Operator job drain every 5 minutes
--   Health pings at minute 15 every 2 hours
--   Integrity checks daily at 04:00
--   Practice metrics rollup daily at 02:15
--   Admin weekly digest Mondays at 03:30

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('operator-process-jobs-every-5m');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('operator-health-pings-every-2h');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('operator-integrity-checks-daily');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('practice-metrics-daily');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

DO $$
BEGIN
	PERFORM cron.unschedule('admin-weekly-digest-monday');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'operator-process-jobs-every-5m',
	'*/5 * * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/admin/process-operator-jobs',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'operator-health-pings-every-2h',
	'15 */2 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/admin/health-pings',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'operator-integrity-checks-daily',
	'0 4 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/admin/integrity-checks',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'practice-metrics-daily',
	'15 2 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/practice/metrics',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

SELECT cron.schedule(
	'admin-weekly-digest-monday',
	'30 3 * * 1',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/admin/weekly-digest',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
