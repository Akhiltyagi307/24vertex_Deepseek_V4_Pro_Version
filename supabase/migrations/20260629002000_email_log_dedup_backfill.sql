-- M-8 fix: 20260527120000_email_log_dedup_unique.sql created a partial UNIQUE
-- index on (template, provider_payload->>'dedup_key') WHERE status in
-- ('sent','queued') WITHOUT first removing pre-existing duplicates. On any
-- project ledger that already had two such rows sharing a key, that
-- `CREATE UNIQUE INDEX` would abort and the migration would fail to apply.
--
-- This migration is the missing backfill: collapse existing duplicates first,
-- then (re)assert the index. It is idempotent and safe to run on both Supabase
-- projects (dev + prod):
--   - If the index already applied cleanly, there are no dups to delete and the
--     index already exists — both statements are no-ops.
--   - If the index never applied (dups present), this removes the dups so the
--     index can finally be created.

-- Keep the earliest in-flight/sent row per (template, dedup_key); delete the rest.
DELETE FROM public.email_log e
USING (
	SELECT id,
		row_number() OVER (
			PARTITION BY template, (provider_payload->>'dedup_key')
			ORDER BY created_at ASC, id ASC
		) AS rn
	FROM public.email_log
	WHERE status IN ('sent', 'queued')
		AND (provider_payload->>'dedup_key') IS NOT NULL
) dups
WHERE e.id = dups.id
	AND dups.rn > 1;

-- (Re)assert the partial unique index now that duplicates are gone. Mirrors the
-- exact shape from 20260527120000 so a fresh project converges to the same state.
CREATE UNIQUE INDEX IF NOT EXISTS email_log_dedup_unique_idx
	ON public.email_log (template, ((provider_payload->>'dedup_key')))
	WHERE status IN ('sent', 'queued')
		AND (provider_payload->>'dedup_key') IS NOT NULL;
