-- Break infinite RLS recursion (42P17) between assignments and assignment_submissions.
-- Policies on each relation subqueried the other with RLS enabled, forming a cycle.
-- SECURITY DEFINER helpers run queries as the function owner so visibility checks stay
-- correct without re-entering the calling role's permissive policies.

BEGIN;

CREATE OR REPLACE FUNCTION public.rls_student_has_assignment_submission(
	p_assignment_id uuid,
	p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.assignment_submissions s
		WHERE s.assignment_id = p_assignment_id
			AND s.student_id = p_student_id
	);
$$;

CREATE OR REPLACE FUNCTION public.rls_parent_linked_child_has_assignment_submission(
	p_assignment_id uuid,
	p_parent_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.assignment_submissions s
		JOIN public.parent_student_links psl ON psl.student_id = s.student_id
		WHERE s.assignment_id = p_assignment_id
			AND psl.parent_id = p_parent_id
			AND psl.status = 'active'
	);
$$;

CREATE OR REPLACE FUNCTION public.rls_assignment_published_for_student_owner(
	p_uid uuid,
	p_row_student_id uuid,
	p_assignment_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
	SELECT COALESCE(p_uid = p_row_student_id, FALSE)
		AND EXISTS (
			SELECT 1
			FROM public.assignments a
			WHERE a.id = p_assignment_id
				AND a.status = 'published'
		);
$$;

CREATE OR REPLACE FUNCTION public.rls_assignment_published_for_linked_parent(
	p_parent_id uuid,
	p_student_id uuid,
	p_assignment_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.parent_student_links psl
		WHERE psl.parent_id = p_parent_id
			AND psl.student_id = p_student_id
			AND psl.status = 'active'
	)
		AND EXISTS (
			SELECT 1
			FROM public.assignments a
			WHERE a.id = p_assignment_id
				AND a.status = 'published'
		);
$$;

REVOKE ALL ON FUNCTION public.rls_student_has_assignment_submission(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_parent_linked_child_has_assignment_submission(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_assignment_published_for_student_owner(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_assignment_published_for_linked_parent(uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rls_student_has_assignment_submission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_parent_linked_child_has_assignment_submission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_assignment_published_for_student_owner(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_assignment_published_for_linked_parent(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Students read targeted assignments" ON public.assignments;
CREATE POLICY "Students read targeted assignments"
ON public.assignments FOR SELECT TO authenticated
USING (
	status = 'published'
	AND public.rls_student_has_assignment_submission(id, auth.uid())
);

DROP POLICY IF EXISTS "Parents read linked child assignments" ON public.assignments;
CREATE POLICY "Parents read linked child assignments"
ON public.assignments FOR SELECT TO authenticated
USING (
	status = 'published'
	AND public.rls_parent_linked_child_has_assignment_submission(id, auth.uid())
);

DROP POLICY IF EXISTS "Students read own assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Students read own assignment submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
	public.rls_assignment_published_for_student_owner(
		auth.uid(),
		assignment_submissions.student_id,
		assignment_submissions.assignment_id
	)
);

DROP POLICY IF EXISTS "Parents read linked child assignment submissions" ON public.assignment_submissions;
CREATE POLICY "Parents read linked child assignment submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (
	public.rls_assignment_published_for_linked_parent(
		auth.uid(),
		assignment_submissions.student_id,
		assignment_submissions.assignment_id
	)
);

COMMIT;
