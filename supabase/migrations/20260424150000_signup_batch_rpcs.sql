-- Batch signup data loads: one round trip instead of 7 (teacher) or 2 (student) RPC calls.
-- Replaces client-side Promise.all of get_all_subjects_for_grade / get_available_electives.

CREATE OR REPLACE FUNCTION public.get_subjects_for_teacher_signup()
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
	SELECT * FROM public.subjects
	WHERE grade >= 6 AND grade <= 12 AND is_active = TRUE
	ORDER BY grade, subject_group NULLS LAST, sort_order, name;
$$;

CREATE OR REPLACE FUNCTION public.get_electives_for_signup()
RETURNS SETOF public.subjects
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
	SELECT * FROM public.subjects
	WHERE grade IN (11, 12) AND is_elective = TRUE AND is_active = TRUE
	ORDER BY grade, sort_order, name;
$$;

GRANT EXECUTE ON FUNCTION public.get_subjects_for_teacher_signup() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_electives_for_signup() TO authenticated, anon;
