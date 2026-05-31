-- Weekly prune of the teacher class-insight cache: drop rows neither served nor
-- regenerated in 90 days. This also clears rows from a superseded prompt_version
-- lazily — a PROMPT_VERSION bump stops touching the old rows, so they age out and
-- get pruned 90 days later. pg_cron pattern matches the repo's other scheduled
-- jobs (e.g. the doubt-chat cleanup). Sunday 03:00 UTC.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
	PERFORM cron.unschedule('teacher-class-insight-prune-weekly');
EXCEPTION
	WHEN OTHERS THEN
		NULL;
END;
$$;

SELECT cron.schedule(
	'teacher-class-insight-prune-weekly',
	'0 3 * * 0',
	$cron$
		DELETE FROM public.teacher_class_insights
		WHERE coalesce(last_served_at, updated_at) < now() - interval '90 days';
	$cron$
);

COMMIT;
