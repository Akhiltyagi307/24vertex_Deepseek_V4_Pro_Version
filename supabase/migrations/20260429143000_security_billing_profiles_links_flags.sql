-- Security hardening:
-- 1) billing_consume_*: caller must be profile owner, linked active parent, or service_role.
-- 2) profiles: block client updates to privilege / integrity columns (trigger); trusted RPCs set bypass.
-- 3) parent_student_links: students cannot reassign parent_id or self-activate links.
-- 4) question_flags: INSERT requires the question to belong to the student's test.

BEGIN;
-- ---------------------------------------------------------------------------
-- billing_consume_test / billing_consume_tokens
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.billing_consume_test(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sub_id UUID;
    v_usage_id UUID;
BEGIN
    IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'billing_consume_test: not authenticated'
                USING ERRCODE = '42501';
        END IF;
        IF auth.uid() IS DISTINCT FROM p_profile_id
            AND NOT EXISTS (
                SELECT 1
                FROM public.parent_student_links psl
                WHERE psl.student_id = p_profile_id
                  AND psl.parent_id = auth.uid()
                  AND psl.status = 'active'
            )
        THEN
            RAISE EXCEPTION 'billing_consume_test: forbidden'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u.id INTO v_usage_id
    FROM public.usage_periods u
    WHERE u.subscription_id = v_sub_id
      AND u.period_start <= NOW()
      AND u.period_end > NOW()
      AND u.tests_used < u.tests_quota
    ORDER BY u.period_end DESC
    LIMIT 1;

    IF v_usage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.usage_periods
    SET tests_used = tests_used + 1
    WHERE id = v_usage_id;
    RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.billing_consume_tokens(p_profile_id UUID, p_tokens INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sub_id UUID;
    v_usage_id UUID;
BEGIN
    IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'billing_consume_tokens: not authenticated'
                USING ERRCODE = '42501';
        END IF;
        IF auth.uid() IS DISTINCT FROM p_profile_id
            AND NOT EXISTS (
                SELECT 1
                FROM public.parent_student_links psl
                WHERE psl.student_id = p_profile_id
                  AND psl.parent_id = auth.uid()
                  AND psl.status = 'active'
            )
        THEN
            RAISE EXCEPTION 'billing_consume_tokens: forbidden'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF p_tokens IS NULL OR p_tokens <= 0 THEN
        RETURN TRUE;
    END IF;

    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u.id INTO v_usage_id
    FROM public.usage_periods u
    WHERE u.subscription_id = v_sub_id
      AND u.period_start <= NOW()
      AND u.period_end > NOW()
    ORDER BY u.period_end DESC
    LIMIT 1;

    IF v_usage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.usage_periods
    SET tokens_used = LEAST(tokens_quota, tokens_used + p_tokens)
    WHERE id = v_usage_id;
    RETURN TRUE;
END;
$$;
-- ---------------------------------------------------------------------------
-- profiles: block tampering with staff / linking / identity columns from JWT clients
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.profiles_block_privilege_column_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        RETURN NEW;
    END IF;
    IF current_setting('eduai.bypass_profile_update_guard', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
        OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
        OR NEW.parent_email IS DISTINCT FROM OLD.parent_email
        OR NEW.student_link_code IS DISTINCT FROM OLD.student_link_code
        OR NEW.subjects_taught IS DISTINCT FROM OLD.subjects_taught
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'profiles: cannot modify protected columns via client'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profiles_block_privilege_updates ON public.profiles;
CREATE TRIGGER trg_profiles_block_privilege_updates
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_block_privilege_column_updates();
-- Email confirmation sync updates is_verified (trusted; not a browser client).
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
        PERFORM set_config('eduai.bypass_profile_update_guard', 'on', true);
        UPDATE public.profiles
        SET is_verified = true
        WHERE id = NEW.id AND role IN ('student', 'parent');
    ELSIF OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
        PERFORM set_config('eduai.bypass_profile_update_guard', 'on', true);
        UPDATE public.profiles
        SET is_verified = true
        WHERE id = NEW.id AND role IN ('student', 'parent');
    END IF;
    RETURN NEW;
END;
$$;
-- Parent linking may set parent_email / parent_name on the student row when previously null.
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

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student_id AND role = 'student') THEN
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
            parent_email = v_jwt_email,
            parent_name = v_parent_display_name
        WHERE id = v_student_id AND role = 'student';
    ELSE
        IF v_student_parent_email IS DISTINCT FROM v_jwt_email THEN
            RAISE EXCEPTION 'Parent email does not match student record';
        END IF;
    END IF;

    INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
    VALUES (auth.uid(), v_student_id, 'active', now())
    ON CONFLICT (parent_id, student_id) DO UPDATE
    SET status = 'active', linked_at = now();
END;
$$;
-- ---------------------------------------------------------------------------
-- parent_student_links: student-side updates cannot reassign IDs or activate
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.parent_student_links_enforce_student_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND OLD.student_id = auth.uid() THEN
        IF NEW.student_id IS DISTINCT FROM OLD.student_id
            OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
        THEN
            RAISE EXCEPTION 'parent_student_links: student cannot reassign link endpoints'
                USING ERRCODE = '42501';
        END IF;
        IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'parent_student_links: only parent flow can activate a link'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_parent_student_links_student_guard ON public.parent_student_links;
CREATE TRIGGER trg_parent_student_links_student_guard
    BEFORE UPDATE ON public.parent_student_links
    FOR EACH ROW
    EXECUTE FUNCTION public.parent_student_links_enforce_student_updates();
-- ---------------------------------------------------------------------------
-- question_flags: question must belong to a test owned by the student
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Students insert own flags" ON public.question_flags;
CREATE POLICY "Students insert own flags"
    ON public.question_flags FOR INSERT TO authenticated
    WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.questions q
            JOIN public.tests t ON t.id = q.test_id
            WHERE q.id = question_id
              AND t.student_id = auth.uid()
        )
    );
COMMIT;
