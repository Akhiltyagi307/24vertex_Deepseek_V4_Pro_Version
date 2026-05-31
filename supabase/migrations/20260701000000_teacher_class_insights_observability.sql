-- Observability columns for the teacher class-insight cache.
--
-- served_count measures cache effectiveness: each serve is one avoided LLM call,
-- so sum(served_count) vs. the count of fresh generations in `ai_calls`
-- (feature = 'teacher.dashboard_insight') gives the hit rate. last_served_at
-- also feeds the prune's freshness check so a hot, frequently-served insight is
-- never deleted just because it hasn't been regenerated recently.

ALTER TABLE public.teacher_class_insights
	ADD COLUMN IF NOT EXISTS served_count integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS last_served_at timestamptz NULL;
