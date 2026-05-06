-- Daily sweep of empty doubt-chat conversations: pg_cron + pg_net → Next.js internal route.
-- Reuses vault secrets:
--   app_base_url (no trailing slash), cron_secret (must match CRON_SECRET on Vercel).
-- Schedule: 19:30 UTC daily = 01:00 IST (Asia/Kolkata; pg_cron uses UTC).
-- Empty conversations younger than 24h are intentionally preserved so a student
-- who started a chat and stepped away can return to it the same day.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

DO $$
BEGIN
	PERFORM cron.unschedule('doubt-chat-cleanup-empty-daily');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'doubt-chat-cleanup-empty-daily',
	'30 19 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url') || '/api/internal/doubt-chat/cleanup-empty',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'),
				'Idempotency-Key', concat('doubt-chat-cleanup-empty-', to_char(date_trunc('day', now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD'))
			),
			body := '{}'::jsonb
		);
	$cron$
);

COMMIT;
