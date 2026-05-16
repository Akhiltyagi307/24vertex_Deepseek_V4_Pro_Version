-- Narrow support indexes for the teacher portal's roster and analytics paths.
-- These preserve behavior while reducing repeated scans on roster-filtered dashboard, topic, and assignment views.

CREATE INDEX IF NOT EXISTS idx_profiles_teacher_org_roster
	ON public.profiles (organization_id, grade, section, full_name)
	WHERE role = 'student' AND deleted_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_tracker_teacher_topic_scope
	ON public.performance_tracker (student_id, subject_id, topic_id)
	WHERE average_score IS NOT NULL AND tests_taken > 0;

CREATE INDEX IF NOT EXISTS idx_tests_teacher_recent_self_practice
	ON public.tests (student_id, subject_id, test_date DESC, created_at DESC)
	WHERE status = 'graded'
		AND total_score IS NOT NULL
		AND is_draft = FALSE
		AND assignment_submission_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_teacher_recent_graded
	ON public.assignment_submissions (student_id, graded_at DESC)
	WHERE lifecycle_status = 'graded'
		AND score IS NOT NULL
		AND graded_at IS NOT NULL;
