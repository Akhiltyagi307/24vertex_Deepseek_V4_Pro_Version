-- Phase 4: wizard 'Regenerate' button drops the current test and creates a new one.

BEGIN;

CREATE OR REPLACE FUNCTION public.practice_abandon_test(p_test_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_caller UUID := auth.uid();
BEGIN
	IF v_caller IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	UPDATE public.tests
	SET status = 'abandoned',
	    abandoned_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_test_id
	  AND student_id = v_caller
	  AND status = 'in_progress';

	RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_abandon_test(UUID) TO authenticated;

COMMIT;
