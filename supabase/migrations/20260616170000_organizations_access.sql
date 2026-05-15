-- Organizations (schools / tuition centers) and teacher/student access model.
-- Apply to both Supabase projects so dev and main stay in lockstep.

CREATE TABLE IF NOT EXISTS public.organizations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	type VARCHAR(32) NOT NULL CHECK (type IN ('school', 'tuition_center')),
	name VARCHAR(300) NOT NULL CHECK (length(trim(name)) > 0),
	external_id VARCHAR(100),
	favicon_url TEXT,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	deleted_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_catalog
	ON public.organizations (is_active, deleted_at, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_active_type_name
	ON public.organizations (type, lower(name))
	WHERE deleted_at IS NULL;

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization
	ON public.profiles (organization_id)
	WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.teacher_organization_memberships (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
	status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (teacher_id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_org_memberships_one_active
	ON public.teacher_organization_memberships (teacher_id)
	WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_teacher_org_memberships_org
	ON public.teacher_organization_memberships (organization_id, status);

CREATE TABLE IF NOT EXISTS public.teacher_student_links (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
	linked_at TIMESTAMPTZ,
	revoked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_student_links_teacher
	ON public.teacher_student_links (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_student_links_student
	ON public.teacher_student_links (student_id, status);

-- Public bucket: public-object URLs serve favicons; uploads go through trusted admin server code.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'organization-favicons',
	'organization-favicons',
	TRUE,
	524288,
	ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
	file_size_limit = EXCLUDED.file_size_limit,
	allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep this bucket public by URL, but avoid broad storage.objects SELECT policies that enable listing.
DROP POLICY IF EXISTS "Organization favicons public read" ON storage.objects;
DROP POLICY IF EXISTS "Organization favicons admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Organization favicons admin update" ON storage.objects;
DROP POLICY IF EXISTS "Organization favicons admin delete" ON storage.objects;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active organizations are visible to authenticated users" ON public.organizations;
CREATE POLICY "Active organizations are visible to authenticated users"
ON public.organizations FOR SELECT TO authenticated
USING (is_active = TRUE AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Teachers can view own organization memberships" ON public.teacher_organization_memberships;
CREATE POLICY "Teachers can view own organization memberships"
ON public.teacher_organization_memberships FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view own student links" ON public.teacher_student_links;
CREATE POLICY "Teachers can view own student links"
ON public.teacher_student_links FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Students can view teacher links to self" ON public.teacher_student_links;
CREATE POLICY "Students can view teacher links to self"
ON public.teacher_student_links FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE OR REPLACE FUNCTION public.auth_is_verified_teacher(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles p
		WHERE p.id = p_teacher_id
			AND p.role = 'teacher'
			AND COALESCE(p.is_verified, FALSE) = TRUE
			AND COALESCE(p.is_suspended, FALSE) = FALSE
			AND p.deleted_at IS NULL
	);
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_active_organization(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.teacher_organization_memberships tom
		JOIN public.organizations o ON o.id = tom.organization_id
		WHERE tom.teacher_id = p_teacher_id
			AND tom.status = 'active'
			AND o.is_active = TRUE
			AND o.deleted_at IS NULL
	);
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student(p_teacher_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT public.auth_is_verified_teacher(p_teacher_id)
		AND EXISTS (
			SELECT 1
			FROM public.profiles s
			WHERE s.id = p_student_id
				AND s.role = 'student'
				AND s.deleted_at IS NULL
				AND (
					(
						s.organization_id IS NOT NULL
						AND EXISTS (
							SELECT 1
							FROM public.teacher_organization_memberships tom
							JOIN public.organizations o ON o.id = tom.organization_id
							WHERE tom.teacher_id = p_teacher_id
								AND tom.organization_id = s.organization_id
								AND tom.status = 'active'
								AND o.is_active = TRUE
								AND o.deleted_at IS NULL
						)
					)
					OR EXISTS (
						SELECT 1
						FROM public.teacher_student_links tsl
						WHERE tsl.teacher_id = p_teacher_id
							AND tsl.student_id = p_student_id
							AND tsl.status = 'active'
					)
				)
		);
$$;

REVOKE ALL ON FUNCTION public.auth_is_verified_teacher(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_has_active_organization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_can_access_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_verified_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_has_active_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_student(uuid, uuid) TO authenticated;

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
		OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
	THEN
		RAISE EXCEPTION 'profiles: cannot modify protected columns via client'
			USING ERRCODE = '42501';
	END IF;

	RETURN NEW;
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

	PERFORM set_config('eduai.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles
	SET organization_id = p_organization_id,
		updated_at = now()
	WHERE id = auth.uid() AND role = 'student';
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_join_organization(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT public.auth_is_verified_teacher(auth.uid()) THEN
		RAISE EXCEPTION 'Caller must be a verified teacher';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.organizations
		WHERE id = p_organization_id AND is_active = TRUE AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Organization not found';
	END IF;

	UPDATE public.teacher_student_links
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid() AND status = 'active';

	UPDATE public.teacher_organization_memberships
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid()
		AND status = 'active'
		AND organization_id IS DISTINCT FROM p_organization_id;

	INSERT INTO public.teacher_organization_memberships (teacher_id, organization_id, status, revoked_at, updated_at)
	VALUES (auth.uid(), p_organization_id, 'active', NULL, now())
	ON CONFLICT (teacher_id, organization_id) DO UPDATE
	SET status = 'active',
		revoked_at = NULL,
		updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_leave_organization()
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
		WHERE id = auth.uid() AND role = 'teacher' AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Caller must be a teacher';
	END IF;

	UPDATE public.teacher_organization_memberships
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid() AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.link_teacher_to_student(p_student_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_trim text := trim(coalesce(p_student_ref, ''));
	v_student_id uuid;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT public.auth_is_verified_teacher(auth.uid()) THEN
		RAISE EXCEPTION 'Caller must be a verified teacher';
	END IF;
	IF public.teacher_has_active_organization(auth.uid()) THEN
		RAISE EXCEPTION 'Teachers associated with an organization cannot link students by code';
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
		WHERE role = 'student' AND student_link_code = upper(v_trim) AND deleted_at IS NULL;
	END IF;

	IF v_student_id IS NULL OR NOT EXISTS (
		SELECT 1 FROM public.profiles
		WHERE id = v_student_id AND role = 'student' AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Student not found';
	END IF;

	INSERT INTO public.teacher_student_links (teacher_id, student_id, status, linked_at, revoked_at, updated_at)
	VALUES (auth.uid(), v_student_id, 'active', now(), NULL, now())
	ON CONFLICT (teacher_id, student_id) DO UPDATE
	SET status = 'active',
		linked_at = now(),
		revoked_at = NULL,
		updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_student_links_enforce_student_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.uid() IS NOT NULL AND OLD.student_id = auth.uid() THEN
		IF NEW.student_id IS DISTINCT FROM OLD.student_id
			OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
		THEN
			RAISE EXCEPTION 'teacher_student_links: student cannot reassign link endpoints'
				USING ERRCODE = '42501';
		END IF;
		IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
			RAISE EXCEPTION 'teacher_student_links: only teacher flow can activate a link'
				USING ERRCODE = '42501';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_student_links_student_guard ON public.teacher_student_links;
CREATE TRIGGER trg_teacher_student_links_student_guard
	BEFORE UPDATE ON public.teacher_student_links
	FOR EACH ROW
	EXECUTE FUNCTION public.teacher_student_links_enforce_student_updates();

REVOKE ALL ON FUNCTION public.student_set_organization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_join_organization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_leave_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_teacher_to_student(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_student_links_enforce_student_updates() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.student_set_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_join_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_leave_organization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_teacher_to_student(text) TO authenticated;

DROP POLICY IF EXISTS "Teachers can view accessible student profiles" ON public.profiles;
CREATE POLICY "Teachers can view accessible student profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
	role = 'student'
	AND public.teacher_can_access_student(auth.uid(), id)
);
