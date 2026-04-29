-- Ensure performance tracker rows always match student curriculum lifecycle.
-- 1) Keep rows ready immediately after student profile creation.
-- 2) Reset + rebuild rows when grade/stream/elective changes.

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
        CASE WHEN v_grade IN (11, 12) THEN v_stream ELSE NULL END,
        CASE WHEN v_grade IN (11, 12) THEN v_elective ELSE NULL END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_performance_tracker_for_student(UUID, BOOLEAN) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_student_performance_tracker(p_reset_curriculum BOOLEAN DEFAULT FALSE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    PERFORM public.sync_student_performance_tracker_for_student(auth.uid(), p_reset_curriculum);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_student_performance_tracker(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_student_performance_tracker(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.profiles_sync_performance_tracker_on_curriculum_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.role = 'student' AND NEW.grade IS NOT NULL THEN
            PERFORM public.sync_student_performance_tracker_for_student(NEW.id, FALSE);
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.role = 'student'
        AND (
            OLD.role IS DISTINCT FROM NEW.role
            OR OLD.grade IS DISTINCT FROM NEW.grade
            OR OLD.stream IS DISTINCT FROM NEW.stream
            OR OLD.elective_subject_id IS DISTINCT FROM NEW.elective_subject_id
        )
    THEN
        PERFORM public.sync_student_performance_tracker_for_student(NEW.id, TRUE);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_performance_tracker_curriculum ON public.profiles;
CREATE TRIGGER trg_profiles_sync_performance_tracker_curriculum
    AFTER INSERT OR UPDATE OF role, grade, stream, elective_subject_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_sync_performance_tracker_on_curriculum_change();
