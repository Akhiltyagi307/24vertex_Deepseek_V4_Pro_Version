-- One RPC round-trip for multiple topic tracker updates (delegates to practice_update_tracker_running).

CREATE OR REPLACE FUNCTION public.practice_update_trackers_bulk(
	p_student_id uuid,
	p_subject_id uuid,
	p_current_test_id uuid,
	p_now timestamptz,
	p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	elem jsonb;
BEGIN
	IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
		RETURN;
	END IF;

	FOR elem IN SELECT t.x FROM jsonb_array_elements(p_items) AS t(x)
	LOOP
		IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
			CONTINUE;
		END IF;
		IF elem->>'topic_id' IS NULL OR elem->>'average_score' IS NULL THEN
			CONTINUE;
		END IF;

		PERFORM public.practice_update_tracker_running(
			p_student_id,
			p_subject_id,
			(elem->>'topic_id')::uuid,
			p_current_test_id,
			(elem->>'average_score')::numeric,
			COALESCE((elem->>'n_incorrect')::int, 0),
			p_now::timestamp
		);
	END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_update_trackers_bulk(uuid, uuid, uuid, timestamptz, jsonb) TO service_role;
