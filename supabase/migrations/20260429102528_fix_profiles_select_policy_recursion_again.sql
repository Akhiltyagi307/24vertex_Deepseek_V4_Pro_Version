BEGIN;

DROP POLICY IF EXISTS "Teachers can view students in their grade/section" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view linked children profiles" ON public.profiles;
DROP FUNCTION IF EXISTS public.auth_is_teacher();

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Parents can view linked children profiles"
ON public.profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.parent_student_links psl
        WHERE psl.parent_id = auth.uid()
          AND psl.student_id = public.profiles.id
          AND psl.status = 'active'
    )
);

COMMIT;;
