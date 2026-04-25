-- Topic curriculum and exercise-style chunks for practice generation (vector search / grounding).
-- Authenticated users have no direct access; server uses service role after enrollment verification.

CREATE TABLE IF NOT EXISTS public.topic_context_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('context', 'exercise')),
    source_ref TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_context_chunks_topic_type
    ON public.topic_context_chunks (topic_id, chunk_type);

CREATE INDEX IF NOT EXISTS idx_topic_context_chunks_topic_created
    ON public.topic_context_chunks (topic_id, created_at);

ALTER TABLE public.topic_context_chunks ENABLE ROW LEVEL SECURITY;

-- RLS: no policy for `authenticated` (implicit deny). `service_role` bypasses RLS.
REVOKE ALL ON public.topic_context_chunks FROM PUBLIC;
GRANT ALL ON public.topic_context_chunks TO service_role;
