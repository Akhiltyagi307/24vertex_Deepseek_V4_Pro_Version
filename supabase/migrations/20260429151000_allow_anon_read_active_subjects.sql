-- Signup pages call subject lookup RPCs before authentication.
-- Allow anon role to read active subjects only.

DROP POLICY IF EXISTS "Subjects are readable by all anon users (active only)" ON public.subjects;

CREATE POLICY "Subjects are readable by all anon users (active only)"
ON public.subjects
FOR SELECT
TO anon
USING (is_active = TRUE);
