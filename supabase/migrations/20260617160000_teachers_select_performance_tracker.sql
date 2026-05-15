-- Allow verified teachers (org roster + independent link-code) to read performance_tracker rows for students they may access.

DROP POLICY IF EXISTS "Teachers view accessible student performance" ON public.performance_tracker;

CREATE POLICY "Teachers view accessible student performance"
ON public.performance_tracker
FOR SELECT
TO authenticated
USING (public.teacher_can_access_student(auth.uid(), student_id));
