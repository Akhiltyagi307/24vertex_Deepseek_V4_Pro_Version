-- Migration: align_a_b_drop_orphan_topic_context_backup
-- Drops the empty mirror of public.topic_context_chunks left over only on
-- Project B (ezxmjkvhrlqeimhnfvfd) so that Project A (suwakggcbxmmvqzeudmq)
-- and Project B match exactly on schema, RLS, indexes, RPCs, triggers,
-- extensions, storage policies, and cron jobs.
--
-- Verified before drop:
--   * 0 rows
--   * No foreign keys (in or out)
--   * No RLS policies
--   * No triggers
--   * No code references in this repo
--
-- IF EXISTS makes this a no-op on Project A (table absent there) and on
-- re-run.

DROP TABLE IF EXISTS public.topic_context_chunks_duplicate_backup CASCADE;
