-- Admin list filter: students by grade + stream (Phase 2 acceptance EXPLAIN).

CREATE INDEX IF NOT EXISTS idx_profiles_grade_stream ON public.profiles (grade, stream)
	WHERE role = 'student' AND deleted_at IS NULL;
