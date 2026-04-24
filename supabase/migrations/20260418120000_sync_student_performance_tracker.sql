-- Harden bulk inserts for performance_tracker; expose idempotent sync for students.

CREATE OR REPLACE FUNCTION public.initialize_performance_tracker(
    p_student_id UUID,
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.performance_tracker (student_id, topic_id, subject_id, status)
    SELECT
        p_student_id,
        t.id,
        t.subject_id,
        'not_tested'
    FROM public.topics t
    INNER JOIN public.get_student_subjects(p_grade, p_stream, p_elective_id) s
        ON t.subject_id = s.id
    WHERE t.grade = p_grade AND t.is_active = TRUE
    ON CONFLICT (student_id, topic_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_performance_tracker(UUID, INT, VARCHAR, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_student_performance_tracker(p_reset_curriculum BOOLEAN DEFAULT FALSE)
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT p.grade, p.stream, p.elective_subject_id
    INTO v_grade, v_stream, v_elective
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'student';

    IF v_grade IS NULL THEN
        RAISE EXCEPTION 'Student profile not found';
    END IF;

    IF p_reset_curriculum THEN
        DELETE FROM public.performance_tracker WHERE student_id = auth.uid();
    END IF;

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        v_grade,
        CASE WHEN v_grade IN (11, 12) THEN v_stream ELSE NULL END,
        CASE WHEN v_grade IN (11, 12) THEN v_elective ELSE NULL END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_performance_tracker(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_student_performance_tracker(BOOLEAN) TO authenticated;
