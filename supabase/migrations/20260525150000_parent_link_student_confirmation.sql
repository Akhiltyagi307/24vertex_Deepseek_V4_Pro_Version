-- Parent linking: when the student has no guardian email on file, create a pending
-- link and require the student to confirm before activating portal access.

DROP FUNCTION IF EXISTS public.link_parent_to_student(text);

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
            IF OLD.status <> 'pending' THEN
                RAISE EXCEPTION 'parent_student_links: student can only activate a pending link'
                    USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.status = 'revoked' AND OLD.status IS DISTINCT FROM 'revoked' THEN
            IF OLD.status <> 'pending' THEN
                RAISE EXCEPTION 'parent_student_links: student can only reject a pending link'
                    USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'parent_student_links: student cannot change link status to %', NEW.status
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_student_ref text)
RETURNS text
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
	v_link_status text;
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
		v_link_status := 'pending';
	ELSE
		IF v_student_parent_email IS DISTINCT FROM v_parent_auth_email THEN
			RAISE EXCEPTION 'Parent email does not match student record';
		END IF;
		v_link_status := 'active';
	END IF;

	INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
	VALUES (auth.uid(), v_student_id, v_link_status, now())
	ON CONFLICT (parent_id, student_id) DO UPDATE
	SET
		status = CASE
			WHEN parent_student_links.status = 'active' THEN 'active'
			ELSE EXCLUDED.status
		END,
		linked_at = CASE
			WHEN parent_student_links.status = 'active' THEN parent_student_links.linked_at
			ELSE now()
		END;

	SELECT status INTO v_link_status
	FROM public.parent_student_links
	WHERE parent_id = auth.uid() AND student_id = v_student_id;

	RETURN coalesce(v_link_status, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_parent_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id uuid;
	v_parent_id uuid;
	v_parent_auth_email text;
	v_parent_display_name text;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT student_id, parent_id
	INTO v_student_id, v_parent_id
	FROM public.parent_student_links
	WHERE id = p_link_id
	FOR UPDATE;

	IF v_student_id IS NULL THEN
		RAISE EXCEPTION 'Link not found';
	END IF;

	IF v_student_id IS DISTINCT FROM auth.uid() THEN
		RAISE EXCEPTION 'Only the student can confirm this link'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.parent_student_links
		WHERE id = p_link_id AND status = 'pending'
	) THEN
		RAISE EXCEPTION 'Link is not pending approval';
	END IF;

	SELECT lower(trim(coalesce(u.email, ''))) INTO v_parent_auth_email
	FROM auth.users u
	WHERE u.id = v_parent_id;

	IF v_parent_auth_email IS NULL OR v_parent_auth_email = '' THEN
		RAISE EXCEPTION 'Parent account email missing';
	END IF;

	SELECT full_name INTO v_parent_display_name
	FROM public.profiles
	WHERE id = v_parent_id AND role = 'parent';

	IF v_parent_display_name IS NULL THEN
		RAISE EXCEPTION 'Parent profile missing';
	END IF;

	PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles SET
		parent_email = v_parent_auth_email,
		parent_name = v_parent_display_name
	WHERE id = v_student_id AND role = 'student';

	UPDATE public.parent_student_links
	SET status = 'active', linked_at = now()
	WHERE id = p_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_parent_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id uuid;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT student_id INTO v_student_id
	FROM public.parent_student_links
	WHERE id = p_link_id
	FOR UPDATE;

	IF v_student_id IS NULL THEN
		RAISE EXCEPTION 'Link not found';
	END IF;

	IF v_student_id IS DISTINCT FROM auth.uid() THEN
		RAISE EXCEPTION 'Only the student can reject this link'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.parent_student_links
		WHERE id = p_link_id AND status = 'pending'
	) THEN
		RAISE EXCEPTION 'Link is not pending approval';
	END IF;

	UPDATE public.parent_student_links
	SET status = 'revoked', linked_at = NULL
	WHERE id = p_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_parent_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_parent_link(uuid) TO authenticated;

COMMENT ON FUNCTION public.link_parent_to_student(text) IS
'Links parent to student. Returns link status: active (immediate) or pending (student must confirm when guardian email was blank).';

COMMENT ON FUNCTION public.confirm_parent_link(uuid) IS
'Student approves a pending parent_student_links row; backfills guardian fields and activates the link.';

COMMENT ON FUNCTION public.reject_parent_link(uuid) IS
'Student rejects a pending parent_student_links row (status revoked).';
