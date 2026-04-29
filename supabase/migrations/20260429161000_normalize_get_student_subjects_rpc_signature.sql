-- Normalize RPC argument names for PostgREST schema cache resolution.
-- Keeps the canonical function signature used by app code:
-- get_student_subjects(p_grade, p_stream, p_elective_id)

CREATE OR REPLACE FUNCTION public.get_student_subjects(
    p_grade INT,
    p_stream VARCHAR DEFAULT NULL,
    p_elective_id UUID DEFAULT NULL
)
RETURNS SETOF public.subjects
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_grade BETWEEN 6 AND 10 THEN
        RETURN QUERY
            SELECT * FROM public.subjects
            WHERE grade = p_grade AND is_elective = FALSE AND is_active = TRUE
            ORDER BY sort_order, name;
    ELSIF p_grade IN (11, 12) THEN
        RETURN QUERY
            SELECT * FROM public.subjects
            WHERE grade = p_grade AND is_active = TRUE
            AND (
                (stream IS NULL AND is_elective = FALSE)
                OR (stream = p_stream AND is_elective = FALSE)
                OR (id = p_elective_id)
            )
            ORDER BY sort_order, name;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_subjects(int, varchar, uuid) TO authenticated, anon;
