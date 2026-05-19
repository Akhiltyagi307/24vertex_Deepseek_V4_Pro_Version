-- QnA logs list: speed up student-scoped test scans and date-ordered pagination.

CREATE INDEX IF NOT EXISTS idx_tests_student_qna_logs
ON public.tests (student_id, test_date DESC NULLS LAST, created_at DESC)
WHERE is_draft IS NOT TRUE AND status IN ('submitted', 'graded');

CREATE INDEX IF NOT EXISTS idx_tests_student_subject_qna_logs
ON public.tests (student_id, subject_id, test_date DESC NULLS LAST, created_at DESC)
WHERE is_draft IS NOT TRUE AND status IN ('submitted', 'graded');
