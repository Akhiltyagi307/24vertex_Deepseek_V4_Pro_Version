-- After tests.started_at was migrated to timestamptz (and matches live column
-- typing), RETURNS TABLE(... started_at timestamp without time zone) makes
-- RETURN QUERY ... RETURNING t.started_at fail with:
-- "structure of query does not match function result type".
-- Align the composite return type so PostgREST can invoke practice_start_grading.

BEGIN;

-- Replacing ROWS-returning composite type: OUT column type change is not reliably
-- applied with CREATE OR REPLACE across PostgreSQL versions.
DROP FUNCTION IF EXISTS public.practice_start_grading(uuid, integer);

CREATE FUNCTION public.practice_start_grading(
	p_test_id UUID,
	p_client_elapsed_seconds INT
)
RETURNS TABLE (
	test_id UUID,
	subject_id UUID,
	status TEXT,
	duration_seconds INT,
	time_limit_seconds INT,
	started_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $function$
DECLARE
	v_student UUID := auth.uid();
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	RETURN QUERY
	UPDATE public.tests t
	SET status = 'grading',
	    test_date = NOW(),
	    duration_seconds = LEAST(
	      COALESCE(t.time_limit_seconds, 86400),
	      GREATEST(
	        1,
	        CASE
	          WHEN t.started_at IS NOT NULL THEN GREATEST(
	            COALESCE(p_client_elapsed_seconds, 0),
	            GREATEST(
	              1,
	              CAST(EXTRACT(EPOCH FROM (NOW() - t.started_at)) AS INT)
	                - COALESCE(t.accumulated_pause_seconds, 0)
	            )
	          )
	          ELSE COALESCE(p_client_elapsed_seconds, 0)
	        END
	      )
	    ),
	    updated_at = NOW()
	WHERE t.id = p_test_id
	  AND t.student_id = v_student
	  AND t.status = 'in_progress'
	RETURNING t.id, t.subject_id, (t.status)::text, t.duration_seconds, t.time_limit_seconds, t.started_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.practice_start_grading(UUID, INTEGER) TO authenticated;

COMMIT;
