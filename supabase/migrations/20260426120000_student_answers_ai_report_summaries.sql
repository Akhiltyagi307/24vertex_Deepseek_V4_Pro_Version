-- Per-question AI summaries for practice test PDFs (from grading; distinct from student_answer JSON / ai_feedback text).

ALTER TABLE public.student_answers
	ADD COLUMN IF NOT EXISTS ai_user_answer_summary TEXT,
	ADD COLUMN IF NOT EXISTS ai_reference_answer_summary TEXT;

COMMENT ON COLUMN public.student_answers.ai_user_answer_summary IS
	'Grader: concise student-facing summary of the learner response for reports/PDF.';

COMMENT ON COLUMN public.student_answers.ai_reference_answer_summary IS
	'Grader: concise summary of the correct or model answer for reports/PDF.';
