-- Human-readable student link code (AA1234) for parent linking; profiles.id stays the auth UUID.

ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS student_link_code varchar(6);

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_student_link_code_format_ck
    CHECK (student_link_code IS NULL OR student_link_code ~ '^[A-Z]{2}[0-9]{4}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_link_code_uidx
    ON public.profiles (student_link_code)
    WHERE student_link_code IS NOT NULL;

-- Random A–Z, A–Z, 0000–9999 (uppercase letters, zero-padded digits).
CREATE OR REPLACE FUNCTION public._generate_student_link_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
    b bytea;
    d int;
BEGIN
    b := extensions.gen_random_bytes(4);
    d := ((get_byte(b, 2) << 8) | get_byte(b, 3)) % 10000;
    RETURN chr(65 + (get_byte(b, 0) % 26))
        || chr(65 + (get_byte(b, 1) % 26))
        || lpad(d::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public._generate_student_link_code() FROM PUBLIC;

-- Backfill existing students
DO $$
DECLARE
    r record;
    v_code text;
    n int;
BEGIN
    FOR r IN
        SELECT id
        FROM public.profiles
        WHERE role = 'student' AND student_link_code IS NULL
    LOOP
        n := 0;
        LOOP
            v_code := public._generate_student_link_code();
            BEGIN
                UPDATE public.profiles
                SET student_link_code = v_code
                WHERE id = r.id;
                EXIT;
            EXCEPTION
                WHEN unique_violation THEN
                    n := n + 1;
                    IF n > 100 THEN
                        RAISE EXCEPTION 'Could not allocate student_link_code for %', r.id;
                    END IF;
            END;
        END LOOP;
    END LOOP;
END;
$$;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_student_link_code_role_ck
    CHECK (
        (role = 'student' AND student_link_code IS NOT NULL)
        OR (role <> 'student' AND student_link_code IS NULL)
    );

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
    v_code text;
    n int := 0;
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

    LOOP
        v_code := public._generate_student_link_code();
        BEGIN
            INSERT INTO public.profiles (
                id, full_name, role, grade, section, stream, elective_subject_id,
                parent_name, parent_email, is_verified, student_link_code
            ) VALUES (
                auth.uid(), p_full_name, 'student', p_grade, p_section,
                CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
                CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END,
                p_parent_name, p_parent_email,
                COALESCE(v_email_confirmed, false),
                v_code
            );
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                n := n + 1;
                IF n > 100 THEN
                    RAISE EXCEPTION 'Could not allocate student link code';
                END IF;
        END;
    END LOOP;

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        p_grade,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END
    );
END;
$$;

DROP FUNCTION IF EXISTS public.link_parent_to_student(uuid);

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_student_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_trim text := trim(p_student_ref);
    v_student_id uuid;
    v_jwt_email text := lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')));
    v_student_email text;
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

    SELECT lower(trim(parent_email)) INTO v_student_email
    FROM public.profiles
    WHERE id = v_student_id AND role = 'student';
    IF v_student_email IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;
    IF v_student_email IS DISTINCT FROM v_jwt_email THEN
        RAISE EXCEPTION 'Parent email does not match student record';
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
    VALUES (auth.uid(), v_student_id, 'active', now())
    ON CONFLICT (parent_id, student_id) DO UPDATE
    SET status = 'active', linked_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_parent_to_student(text) TO authenticated;
