-- Teacher roster filters (org teachers) + revoke independent teacher–student links.
-- Apply to dev + production Supabase projects.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS teacher_roster_grade integer
		CHECK (teacher_roster_grade IS NULL OR teacher_roster_grade BETWEEN 6 AND 12);

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS teacher_roster_subject_id uuid
		REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_teacher_roster_subject
	ON public.profiles (teacher_roster_subject_id)
	WHERE teacher_roster_subject_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.teacher_join_organization(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_prev_org uuid;
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

	SELECT tom.organization_id INTO v_prev_org
	FROM public.teacher_organization_memberships tom
	WHERE tom.teacher_id = auth.uid()
		AND tom.status = 'active'
	LIMIT 1;

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

	IF v_prev_org IS DISTINCT FROM p_organization_id THEN
		UPDATE public.profiles
		SET teacher_roster_grade = NULL,
			teacher_roster_subject_id = NULL,
			updated_at = now()
		WHERE id = auth.uid() AND role = 'teacher';
	END IF;
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

	UPDATE public.profiles
	SET teacher_roster_grade = NULL,
		teacher_roster_subject_id = NULL,
		updated_at = now()
	WHERE id = auth.uid() AND role = 'teacher';
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_teacher_from_student(p_student_id uuid)
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
	IF public.teacher_has_active_organization(auth.uid()) THEN
		RAISE EXCEPTION 'Teachers connected to an organization manage students via the organization roster';
	END IF;

	UPDATE public.teacher_student_links
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid()
		AND student_id = p_student_id
		AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_teacher_from_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_teacher_from_student(uuid) TO authenticated;
