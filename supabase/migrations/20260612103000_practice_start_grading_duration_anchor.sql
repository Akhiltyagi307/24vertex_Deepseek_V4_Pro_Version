-- practice_start_grading used LEAST(client, limit, server_wall), which lets an
-- under-reported client elapsed (timer bug, clock skew) overwrite the real
-- session length. Merge with GREATEST(client, wall_minus_pause), then cap by
-- time_limit. Stamp test_date at submit so report lists show submission time,
-- not async grading/PDF completion.

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

COMMIT;
