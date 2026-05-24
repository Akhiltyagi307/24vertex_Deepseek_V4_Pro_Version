-- Drop tables and RPCs with no application usage (verified 2026-06).
--   resources: PDR placeholder, never wired in app
--   practice_rate_limits + practice_rate_limit_consume: superseded by rate_limit_buckets + rl_consume
--   _import_staging + assemble_and_insert: retired; scripts write topic_context_chunks directly

DROP FUNCTION IF EXISTS public.practice_rate_limit_consume(text, integer, integer);

DROP FUNCTION IF EXISTS public.assemble_and_insert(text, uuid, text, text, jsonb);

DROP POLICY IF EXISTS "Resources readable by authenticated users" ON public.resources;

DROP TABLE IF EXISTS public.practice_rate_limits;
DROP TABLE IF EXISTS public._import_staging;
DROP TABLE IF EXISTS public.resources;
