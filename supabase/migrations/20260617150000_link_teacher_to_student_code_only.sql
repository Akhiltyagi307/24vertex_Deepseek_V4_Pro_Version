-- Teachers link independent students by student_link_code only (students don't expose UUID in UX).

CREATE OR REPLACE FUNCTION public.link_teacher_to_student(p_student_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_code text := upper(trim(coalesce(p_student_ref, '')));
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
	IF v_code = '' THEN
		RAISE EXCEPTION 'Student reference required';
	END IF;
	IF v_code !~ '^[A-Z]{2}[0-9]{4}$' THEN
		RAISE EXCEPTION 'Invalid student link code';
	END IF;

	SELECT id INTO v_student_id
	FROM public.profiles
	WHERE role = 'student'
		AND student_link_code = v_code
		AND deleted_at IS NULL;

	IF v_student_id IS NULL THEN
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
