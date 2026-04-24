-- Sync profiles.is_verified with auth email confirmation for students/parents only.
-- Teachers keep is_verified for manual admin approval (PDR).

-- When email is confirmed after the profile already exists.
CREATE OR REPLACE FUNCTION public.sync_profile_verified_on_email_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles
        SET is_verified = true
        WHERE id = NEW.id AND role IN ('student', 'parent');
    ELSIF OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
        UPDATE public.profiles
        SET is_verified = true
        WHERE id = NEW.id AND role IN ('student', 'parent');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_is_verified_after_auth_user_insert ON auth.users;
CREATE TRIGGER sync_profile_is_verified_after_auth_user_insert
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_verified_on_email_confirm();

DROP TRIGGER IF EXISTS sync_profile_is_verified_after_auth_user_email_update ON auth.users;
CREATE TRIGGER sync_profile_is_verified_after_auth_user_email_update
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_verified_on_email_confirm();

-- Profile is usually created after email confirmation; set is_verified on insert from auth.users.
CREATE OR REPLACE FUNCTION public.register_student(
    p_full_name text,
    p_grade int,
    p_section text,
    p_stream text DEFAULT NULL,
    p_elective_subject_id uuid DEFAULT NULL,
    p_parent_name text DEFAULT NULL,
    p_parent_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_email_confirmed boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;
    IF p_grade IS NULL OR p_grade NOT BETWEEN 6 AND 12 THEN
        RAISE EXCEPTION 'Invalid grade';
    END IF;
    IF p_section IS NULL OR length(trim(p_section)) = 0 THEN
        RAISE EXCEPTION 'Section required';
    END IF;
    IF p_grade IN (11, 12) AND (p_stream IS NULL OR p_stream NOT IN ('science', 'commerce', 'arts')) THEN
        RAISE EXCEPTION 'Stream required for grades 11-12';
    END IF;
    IF p_grade IN (11, 12) AND p_elective_subject_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.subjects s
            WHERE s.id = p_elective_subject_id AND s.grade = p_grade AND s.is_elective = true
        ) THEN
            RAISE EXCEPTION 'Invalid elective for grade';
        END IF;
    END IF;

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = auth.uid();

    INSERT INTO public.profiles (
        id, full_name, role, grade, section, stream, elective_subject_id,
        parent_name, parent_email, is_verified
    ) VALUES (
        auth.uid(), p_full_name, 'student', p_grade, p_section,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END,
        p_parent_name, p_parent_email,
        COALESCE(v_email_confirmed, false)
    );

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        p_grade,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_parent(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_email_confirmed boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = auth.uid();

    INSERT INTO public.profiles (id, full_name, role, is_verified)
    VALUES (auth.uid(), p_full_name, 'parent', COALESCE(v_email_confirmed, false));
END;
$$;

-- Backfill existing student/parent rows where auth email is already confirmed.
UPDATE public.profiles p
SET is_verified = true
FROM auth.users u
WHERE p.id = u.id
  AND p.role IN ('student', 'parent')
  AND u.email_confirmed_at IS NOT NULL
  AND p.is_verified IS NOT TRUE;
