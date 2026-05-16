CREATE OR REPLACE FUNCTION public.teacher_filter_accessible_student_ids(
	p_teacher_id uuid,
	p_student_ids uuid[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	WITH requested AS (
		SELECT DISTINCT sid
		FROM unnest(p_student_ids) AS sid
	)
	SELECT COALESCE(array_agg(s.id ORDER BY s.id), ARRAY[]::uuid[])
	FROM requested r
	JOIN public.profiles s ON s.id = r.sid
	WHERE public.auth_is_verified_teacher(p_teacher_id)
		AND s.role = 'student'
		AND s.deleted_at IS NULL
		AND (
			(
				s.organization_id IS NOT NULL
				AND EXISTS (
					SELECT 1
					FROM public.teacher_organization_memberships tom
					JOIN public.organizations o ON o.id = tom.organization_id
					WHERE tom.teacher_id = p_teacher_id
						AND tom.organization_id = s.organization_id
						AND tom.status = 'active'
						AND o.is_active = TRUE
						AND o.deleted_at IS NULL
				)
			)
			OR EXISTS (
				SELECT 1
				FROM public.teacher_student_links tsl
				WHERE tsl.teacher_id = p_teacher_id
					AND tsl.student_id = s.id
					AND tsl.status = 'active'
			)
		);
$$;

REVOKE ALL ON FUNCTION public.teacher_filter_accessible_student_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_filter_accessible_student_ids(uuid, uuid[]) TO authenticated;
