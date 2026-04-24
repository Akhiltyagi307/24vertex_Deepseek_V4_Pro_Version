-- One saved answer row per question per test (enables upsert on autosave).
CREATE UNIQUE INDEX IF NOT EXISTS student_answers_test_question_uidx
ON public.student_answers (test_id, question_id);
