-- Closed learning loop — Phase 2: nightly review scheduler cron (02:30 UTC).
-- Mirrors the operator health-pings schedule. Idempotent.
--
-- GO-LIVE NOTE: scheduling this on a project makes the prescriptive review loop
-- fire nightly for ALL students with due topics (subject to review_scheduler_enabled()
-- and the per-student caps). There is no cohort filter in v1, so enabling = full
-- launch. Apply to canary for validation; apply to EDU_AI only as a deliberate
-- go-live. To keep a project dark after scheduling, redefine review_scheduler_enabled()
-- to return false (see Phase 1 migration) until you are ready.

SELECT cron.schedule(
	'practice-review-scheduler-nightly',
	'30 2 * * *',
	$cron$
		SELECT net.http_post(
			url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_base_url')
				|| '/api/internal/practice/review-scheduler',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
			),
			body := '{}'::jsonb
		);
	$cron$
);
