-- Speed up dedup lookups: filter by topic_id with embedding present.
CREATE INDEX IF NOT EXISTS idx_questions_topic_id_embedding_present
	ON public.questions (topic_id)
	WHERE embedding IS NOT NULL;
