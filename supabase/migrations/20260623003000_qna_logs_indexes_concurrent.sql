-- Re-create the QnA-logs partial indexes on `public.tests` using
-- `CREATE INDEX CONCURRENTLY`. The originals
-- (`20260619200000_qna_logs_list_performance_indexes.sql`) took
-- ACCESS EXCLUSIVE during the build, which blocks writes on a hot OLTP
-- table for the duration. Concurrent build uses SHARE UPDATE EXCLUSIVE
-- and lets normal writes continue.
--
-- IMPORTANT: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction
-- block. No BEGIN/COMMIT here — each statement must execute on its own.
-- Drizzle migrate / supabase migration runs each .sql file with a single
-- top-level `BEGIN` only if the file contains transaction control;
-- without explicit BEGIN/COMMIT the statements run autocommit, which is
-- what we need.
--
-- Same definitions as the original migration; DROP first so we don't end
-- up with two duplicate indexes (the original CREATE INDEX IF NOT EXISTS
-- was idempotent, so on re-runs the second CREATE was a no-op). Naming
-- stays identical so query planner's existing usage statistics carry over.
-- The CONCURRENTLY DROP is the same lock-friendly story.

DROP INDEX CONCURRENTLY IF EXISTS public.idx_tests_student_qna_logs;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_student_qna_logs
ON public.tests (student_id, test_date DESC NULLS LAST, created_at DESC)
WHERE is_draft IS NOT TRUE AND status IN ('submitted', 'graded');

DROP INDEX CONCURRENTLY IF EXISTS public.idx_tests_student_subject_qna_logs;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tests_student_subject_qna_logs
ON public.tests (student_id, subject_id, test_date DESC NULLS LAST, created_at DESC)
WHERE is_draft IS NOT TRUE AND status IN ('submitted', 'graded');
