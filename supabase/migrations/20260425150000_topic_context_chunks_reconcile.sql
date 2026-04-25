-- Idempotent reconciliation when public.topic_context_chunks already existed in production
-- before 20260425120000. Safe to re-run: indexes, RLS, grants only; no DROP or column changes.

CREATE INDEX IF NOT EXISTS idx_topic_context_chunks_topic_type
    ON public.topic_context_chunks (topic_id, chunk_type);

CREATE INDEX IF NOT EXISTS idx_topic_context_chunks_topic_created
    ON public.topic_context_chunks (topic_id, created_at);

ALTER TABLE public.topic_context_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.topic_context_chunks FROM PUBLIC;
GRANT ALL ON public.topic_context_chunks TO service_role;
