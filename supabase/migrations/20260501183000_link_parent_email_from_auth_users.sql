-- Parent linking compared guardian email to auth.jwt() ->> 'email' only.
-- Some sessions/JWT shapes omit `email` while auth.users.email is set, causing false
-- mismatches or empty parent_email writes. Prefer auth.users (same source as getUser()).

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_student_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_trim text := trim(p_student_ref);
    v_student_id uuid;
    v_parent_auth_email text;
    v_student_parent_email text;
    v_parent_display_name text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent') THEN
        RAISE EXCEPTION 'Caller must be a parent';
    END IF;
    IF v_trim = '' THEN
        RAISE EXCEPTION 'Student reference required';
    END IF;

    SELECT lower(trim(coalesce(u.email, ''))) INTO v_parent_auth_email
    FROM auth.users u
    WHERE u.id = auth.uid();

    IF v_parent_auth_email IS NULL OR v_parent_auth_email = '' THEN
        v_parent_auth_email := lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')));
    END IF;

    BEGIN
        v_student_id := v_trim::uuid;
    EXCEPTION
        WHEN invalid_text_representation THEN
            v_student_id := NULL;
    END;

    IF v_student_id IS NULL THEN
        SELECT id INTO v_student_id
        FROM public.profiles
        WHERE role = 'student' AND student_link_code = upper(v_trim);
    END IF;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_student_id AND p.role = 'student') THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    SELECT nullif(trim(lower(coalesce(parent_email, ''))), '')
    INTO v_student_parent_email
    FROM public.profiles
    WHERE id = v_student_id AND role = 'student';

    SELECT full_name INTO v_parent_display_name
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'parent';

    IF v_parent_display_name IS NULL THEN
        RAISE EXCEPTION 'Parent profile missing';
    END IF;

    IF v_student_parent_email IS NULL THEN
        PERFORM set_config('eduai.bypass_profile_update_guard', 'on', true);
        UPDATE public.profiles SET
            parent_email = v_parent_auth_email,
            parent_name = v_parent_display_name
        WHERE id = v_student_id AND role = 'student';
    ELSE
        IF v_student_parent_email IS DISTINCT FROM v_parent_auth_email THEN
            RAISE EXCEPTION 'Parent email does not match student record';
        END IF;
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
    VALUES (auth.uid(), v_student_id, 'active', now())
    ON CONFLICT (parent_id, student_id) DO UPDATE
    SET status = 'active', linked_at = now();
END;
$$;
