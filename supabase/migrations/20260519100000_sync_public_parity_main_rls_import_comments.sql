-- RLS parity with main (tables have no policies: client roles blocked), _import_staging.content nullable, comments.
-- DDL only: no drops, no TRUNCATE, no data rewrites.

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_runtime_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_rate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public._import_staging ALTER COLUMN content DROP NOT NULL;

COMMENT ON TABLE public.topic_context_chunks IS $tc$Stores text chunks (NCERT content, exercises, and question-bank questions) linked to topics. Queried by topic_id to build AI prompt context when a user selects topics in the test configuration form.$tc$;

COMMENT ON COLUMN public.topic_context_chunks.id IS $tc$Primary key. Auto-generated UUID (gen_random_uuid()).$tc$;
COMMENT ON COLUMN public.topic_context_chunks.topic_id IS $tc$Foreign key to topics.id. ON DELETE CASCADE — deleting a topic removes all of its chunks. Indexed for fast lookup.$tc$;
COMMENT ON COLUMN public.topic_context_chunks.content IS $tc$The actual text of the chunk: an NCERT paragraph, an exercise, or a question from an external question bank.$tc$;
COMMENT ON COLUMN public.topic_context_chunks.source_ref IS $tc$Human-readable citation reference, e.g. "NCERT Class 10 Science Ch 3, pg 45" or "CBSE 2023 Board Paper Q12". Useful for UI citations and debugging.$tc$;
COMMENT ON COLUMN public.topic_context_chunks.chunk_type IS $tc$Categorizes the chunk so queries can filter by type. Values emitted by the topic_context_creator skill: 'context' (NCERT subsection body), 'exercise' (NCERT chapter-end exercises), 'question_bank' (external question-bank items). Indexed (partial index where not null).$tc$;
COMMENT ON COLUMN public.topic_context_chunks.embedding IS $tc$Reserved for future semantic search features (pgvector). Currently unused — leave NULL. If you later enable similarity search, pin the dimension (e.g. vector(1536)) and add an HNSW index.$tc$;
COMMENT ON COLUMN public.topic_context_chunks.metadata IS $tc$Flexible JSONB for chunk-specific fields that do not fit a fixed column. Example for a question: {"answer":"...","difficulty":"medium","marks":3,"options":["A","B","C","D"]}. Defaults to empty object.$tc$;
COMMENT ON COLUMN public.topic_context_chunks.created_at IS $tc$Timestamp when the chunk was inserted. Defaults to now().$tc$;

COMMENT ON COLUMN public.student_answers.ai_user_answer_summary IS $sa$Grader: concise student-facing summary of the learner response for reports/PDF.$sa$;
COMMENT ON COLUMN public.student_answers.ai_reference_answer_summary IS $sa$Grader: concise summary of the correct or model answer for reports/PDF.$sa$;
