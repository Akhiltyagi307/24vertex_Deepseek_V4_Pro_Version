-- practice_subject_progress returned `started_at` as TIMESTAMP; after
-- `20260612140000_fix_naive_timestamps_notifications_tests.sql`, `tests.started_at`
-- is TIMESTAMPTZ, so RETURN QUERY no longer matched RETURNS TABLE (42804).

BEGIN;

DROP FUNCTION IF EXISTS public.practice_subject_progress(uuid);

CREATE FUNCTION public.practice_subject_progress(p_student_id UUID DEFAULT NULL)
RETURNS TABLE (
	subject_id UUID,
	test_id UUID,
	answered_count INT,
	total_questions INT,
	time_limit_seconds INT,
	started_at TIMESTAMP WITH TIME ZONE,
	topics_covered INT,
	last_test_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_target UUID := COALESCE(p_student_id, auth.uid());
BEGIN
	IF v_target IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF auth.uid() IS NOT NULL AND auth.uid() <> v_target THEN
		RAISE EXCEPTION 'Cannot read another student';
	END IF;

	RETURN QUERY
	WITH in_progress AS (
		SELECT DISTINCT ON (t.subject_id)
			t.id AS test_id,
			t.subject_id,
			t.total_questions,
			t.time_limit_seconds,
			t.started_at
		FROM public.tests t
		WHERE t.student_id = v_target
		  AND t.test_type = 'self'
		  AND t.status = 'in_progress'
		ORDER BY t.subject_id, t.updated_at DESC
	),
	answer_counts AS (
		SELECT sa.test_id, COUNT(*)::int AS n
		FROM public.student_answers sa
		WHERE sa.test_id IN (SELECT p.test_id FROM in_progress p)
		  AND sa.student_answer ? 'value'
		  AND length(COALESCE(sa.student_answer->>'value', '')) > 0
		GROUP BY sa.test_id
	),
	question_counts AS (
		SELECT q.test_id,
		       COUNT(*)::int AS qn,
		       COUNT(DISTINCT q.topic_id)::int AS tn
		FROM public.questions q
		WHERE q.test_id IN (SELECT p.test_id FROM in_progress p)
		GROUP BY q.test_id
	),
	last_scores AS (
		SELECT DISTINCT ON (t.subject_id)
			t.subject_id,
			t.total_score
		FROM public.tests t
		WHERE t.student_id = v_target
		  AND t.test_type = 'self'
		  AND t.status = 'graded'
		ORDER BY t.subject_id, t.test_date DESC
	)
	SELECT
		ip.subject_id,
		ip.test_id,
		COALESCE(ac.n, 0) AS answered_count,
		COALESCE(NULLIF(ip.total_questions, 0), qc.qn, 0) AS total_questions,
		ip.time_limit_seconds,
		ip.started_at,
		qc.tn AS topics_covered,
		ls.total_score AS last_test_score
	FROM in_progress ip
	LEFT JOIN answer_counts ac ON ac.test_id = ip.test_id
	LEFT JOIN question_counts qc ON qc.test_id = ip.test_id
	LEFT JOIN last_scores ls ON ls.subject_id = ip.subject_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.practice_subject_progress(UUID) TO authenticated;

COMMIT;
