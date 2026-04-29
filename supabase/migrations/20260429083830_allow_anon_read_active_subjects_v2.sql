DROP POLICY IF EXISTS "Subjects are readable by all anon users (active only)" ON public.subjects;

CREATE POLICY "Subjects are readable by all anon users (active only)"
ON public.subjects
FOR SELECT
TO anon
USING (is_active = TRUE);;
