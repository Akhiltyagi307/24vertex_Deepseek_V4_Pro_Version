-- 24Vertex rebrand: profile-update bypass guard uses vertex24.* GUC; legacy eduai.* still honored.

CREATE OR REPLACE FUNCTION public.profile_update_guard_bypassed()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
	SELECT current_setting('vertex24.bypass_profile_update_guard', true) = 'on'
		OR current_setting('eduai.bypass_profile_update_guard', true) = 'on';
$$;

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
	IF public.profile_update_guard_bypassed() THEN
		RETURN NEW;
	END IF;

	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.role IS DISTINCT FROM OLD.role
		OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
		OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
		OR NEW.parent_email IS DISTINCT FROM OLD.parent_email
		OR NEW.student_link_code IS DISTINCT FROM OLD.student_link_code
		OR NEW.subjects_taught IS DISTINCT FROM OLD.subjects_taught
		OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
	THEN
		RAISE EXCEPTION 'profiles: cannot modify protected columns via client'
			USING ERRCODE = '42501';
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_teacher_verified(p_teacher_id uuid, p_verified boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_count int;
BEGIN
	PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles
	SET is_verified = p_verified,
		updated_at = now()
	WHERE id = p_teacher_id AND role = 'teacher';
	GET DIAGNOSTICS v_count = ROW_COUNT;
	RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_set_organization(p_organization_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.profiles
		WHERE id = auth.uid() AND role = 'student' AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Caller must be a student';
	END IF;
	IF p_organization_id IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM public.organizations
		WHERE id = p_organization_id AND is_active = TRUE AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Organization not found';
	END IF;

	PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles
	SET organization_id = p_organization_id,
		updated_at = now()
	WHERE id = auth.uid() AND role = 'student';
END;
$$;

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
		PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
		UPDATE public.profiles
		SET is_verified = true
		WHERE id = NEW.id AND role IN ('student', 'parent');
	ELSIF OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
		PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
		UPDATE public.profiles
		SET is_verified = true
		WHERE id = NEW.id AND role IN ('student', 'parent');
	END IF;
	RETURN NEW;
END;
$$;

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
		PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
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
