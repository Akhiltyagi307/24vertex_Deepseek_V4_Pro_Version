-- The "Teachers can view students" policy queried public.profiles inside a profiles
-- SELECT policy, which re-applies RLS on profiles and can raise:
-- "infinite recursion detected in policy for relation \"profiles\"" (42P17).
-- Use a SECURITY DEFINER helper so the teacher check does not recurse.

CREATE OR REPLACE FUNCTION public.auth_is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'teacher'
    );
$$;

REVOKE ALL ON FUNCTION public.auth_is_teacher() FROM PUBLIC;

DROP POLICY IF EXISTS "Teachers can view students in their grade/section" ON public.profiles;

CREATE POLICY "Teachers can view students in their grade/section"
ON public.profiles FOR SELECT USING (
    public.auth_is_teacher()
    AND role = 'student'
    AND EXISTS (
        SELECT 1 FROM public.teacher_assignments ta
        WHERE ta.teacher_id = auth.uid()
          AND ta.grade = public.profiles.grade
          AND ta.section = public.profiles.section
    )
);
