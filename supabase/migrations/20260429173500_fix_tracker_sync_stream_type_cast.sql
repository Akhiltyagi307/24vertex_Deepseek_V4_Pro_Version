-- Fix helper function call type mismatch (TEXT -> VARCHAR) for initialize_performance_tracker.

CREATE OR REPLACE FUNCTION public.sync_student_performance_tracker_for_student(
    p_student_id UUID,
    p_reset_curriculum BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_grade INT;
    v_stream TEXT;
    v_elective UUID;
BEGIN
    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'Student id is required';
    END IF;

    SELECT p.grade, p.stream, p.elective_subject_id
    INTO v_grade, v_stream, v_elective
    FROM public.profiles p
    WHERE p.id = p_student_id AND p.role = 'student';

    IF v_grade IS NULL THEN
        RAISE EXCEPTION 'Student profile not found';
    END IF;

    IF p_reset_curriculum THEN
        DELETE FROM public.performance_tracker WHERE student_id = p_student_id;
    END IF;

    PERFORM public.initialize_performance_tracker(
        p_student_id,
        v_grade,
        CASE WHEN v_grade IN (11, 12) THEN v_stream::VARCHAR ELSE NULL END,
        CASE WHEN v_grade IN (11, 12) THEN v_elective ELSE NULL END
    );
END;
$$;
