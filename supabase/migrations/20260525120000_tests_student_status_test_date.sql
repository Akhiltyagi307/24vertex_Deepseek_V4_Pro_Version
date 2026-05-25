-- Dashboard and reports list: filter by student + status + test_date ordering.
CREATE INDEX IF NOT EXISTS idx_tests_student_status_test_date
  ON public.tests (student_id, status, test_date DESC NULLS LAST)
  WHERE is_draft = false;
