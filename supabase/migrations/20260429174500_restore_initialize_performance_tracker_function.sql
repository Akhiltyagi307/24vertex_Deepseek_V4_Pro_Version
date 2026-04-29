-- Restore initialize_performance_tracker on environments where it is missing.

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
