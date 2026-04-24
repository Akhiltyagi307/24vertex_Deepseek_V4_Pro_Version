-- practice_start_grading: RETURN QUERY failed with
-- "structure of query does not match function result type" because
-- tests.status is varchar while RETURNS TABLE declared status as text.
-- Cast the RETURNING row so PostgREST can invoke the RPC successfully.

BEGIN;

CREATE OR REPLACE FUNCTION public.practice_start_grading(
	p_test_id UUID,
	p_client_elapsed_seconds INT
)
RETURNS TABLE (
	test_id UUID,
	subject_id UUID,
	status TEXT,
	duration_seconds INT,
	time_limit_seconds INT,
	started_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student UUID := auth.uid();
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	RETURN QUERY
	UPDATE public.tests t
	SET status = 'grading',
	    duration_seconds = LEAST(
	        COALESCE(p_client_elapsed_seconds, t.time_limit_seconds),
	        COALESCE(t.time_limit_seconds, p_client_elapsed_seconds),
	        CASE
	            WHEN t.started_at IS NOT NULL THEN GREATEST(1, CAST(EXTRACT(EPOCH FROM (NOW() - t.started_at)) AS INT))
	            ELSE COALESCE(p_client_elapsed_seconds, t.time_limit_seconds)
	        END
	    ),
	    updated_at = NOW()
	WHERE t.id = p_test_id
	  AND t.student_id = v_student
	  AND t.status = 'in_progress'
	RETURNING t.id, t.subject_id, (t.status)::text, t.duration_seconds, t.time_limit_seconds, t.started_at;
END;
$$;

COMMIT;
