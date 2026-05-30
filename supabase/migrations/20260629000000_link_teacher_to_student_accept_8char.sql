-- H-1 fix: link_teacher_to_student rejected 8-char student_link_codes.
--
-- The function hard-coded a 6-char regex `^[A-Z]{2}[0-9]{4}$`, but
-- 20260619100000_extend_student_link_code_to_8_chars.sql widened codes to
-- 8 chars (XXX12345) and made the generator emit them. Independent (non-org)
-- teachers could therefore never link any student created/rotated after
-- 2026-06-19: the app accepted the 8-char code, then this RPC raised
-- "Invalid student link code".
--
-- Fix: drop the format regex entirely and mirror link_parent_to_student's
-- tolerant lookup (`student_link_code = upper(v_code)`). The equality lookup
-- is the real validator — an unknown code raises "Student not found". This is
-- format-agnostic, so a future length change won't require another migration.
-- Teacher-specific guards (verified-teacher, non-org, empty-string) are kept.

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
