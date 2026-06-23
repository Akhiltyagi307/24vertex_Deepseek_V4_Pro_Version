-- Drive teacher access off profiles.subjects_taught; remove the "Teaching filters"
-- columns (teacher_roster_grade / teacher_roster_subject_id) end-to-end.
--
-- Apply IDENTICALLY to BOTH Supabase projects (dev + production) per the two-project rule.
--
-- Order matters: every function that references the roster columns is redefined
-- BEFORE the columns are dropped. Idempotent: CREATE OR REPLACE / IF EXISTS throughout.

BEGIN;

-- 1. Grade predicate: TRUE when the teacher has no subjects_taught (empty/null ⇒ whole
--    school), else TRUE only when `grade` is a grade of one of the teacher's taught
--    ACTIVE subjects. New function; depends on subjects_taught (which is NOT dropped).
CREATE OR REPLACE FUNCTION public.teacher_teaches_grade(p_teacher_id uuid, p_grade integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT CASE
		WHEN COALESCE(
			array_length((SELECT p.subjects_taught FROM public.profiles p WHERE p.id = p_teacher_id), 1),
			0
		) = 0
			THEN TRUE
		ELSE EXISTS (
			SELECT 1
			FROM public.profiles p
			JOIN public.subjects s ON s.id = ANY (p.subjects_taught)
			WHERE p.id = p_teacher_id
				AND s.grade = p_grade
				AND s.is_active = TRUE
		)
	END;
$$;

REVOKE ALL ON FUNCTION public.teacher_teaches_grade(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_grade(uuid, integer) TO service_role;

-- 2. Gate ORG-student access by the teacher's taught grade. Link-code access is
--    unchanged (independent teachers stay scoped to their linked students). An
--    empty-scope teacher teaches every grade, so org access is unrestricted for them.
CREATE OR REPLACE FUNCTION public.teacher_can_access_student(p_teacher_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT
		(auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND public.auth_is_verified_teacher(p_teacher_id)
		AND EXISTS (
			SELECT 1
			FROM public.profiles s
			WHERE s.id = p_student_id
				AND s.role = 'student'
				AND s.deleted_at IS NULL
				AND (
					(
						s.organization_id IS NOT NULL
						AND public.teacher_teaches_grade(p_teacher_id, s.grade)
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
							AND tsl.student_id = p_student_id
							AND tsl.status = 'active'
					)
				)
		);
$$;

-- 3. Same taught-grade gate for the bulk accessible-id filter.
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
	WHERE (auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND public.auth_is_verified_teacher(p_teacher_id)
		AND s.role = 'student'
		AND s.deleted_at IS NULL
		AND (
			(
				s.organization_id IS NOT NULL
				AND public.teacher_teaches_grade(p_teacher_id, s.grade)
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

-- 4. Org join: stop NULL-ing the roster columns (they are being dropped). Defensively
--    drop the obsolete single-arg overload if it still exists in this project.
DROP FUNCTION IF EXISTS public.teacher_join_organization(uuid);

CREATE OR REPLACE FUNCTION public.teacher_join_organization(p_organization_id uuid, p_linking_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_norm text := upper(trim(coalesce(p_linking_code, '')));
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT public.auth_is_verified_teacher(auth.uid()) THEN
		RAISE EXCEPTION 'Caller must be a verified teacher';
	END IF;
	IF v_norm = '' THEN
		RAISE EXCEPTION 'Organization linking code required';
	END IF;
	IF NOT EXISTS (
		SELECT 1
		FROM public.organizations o
		WHERE o.id = p_organization_id
			AND o.is_active = TRUE
			AND o.deleted_at IS NULL
			AND o.linking_code = v_norm
	) THEN
		RAISE EXCEPTION 'Invalid organization or linking code';
	END IF;

	UPDATE public.teacher_student_links
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid() AND status = 'active';

	UPDATE public.teacher_organization_memberships
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid()
		AND status = 'active'
		AND organization_id IS DISTINCT FROM p_organization_id;

	INSERT INTO public.teacher_organization_memberships (teacher_id, organization_id, status, revoked_at, updated_at)
	VALUES (auth.uid(), p_organization_id, 'active', NULL, now())
	ON CONFLICT (teacher_id, organization_id) DO UPDATE
	SET status = 'active',
		revoked_at = NULL,
		updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_join_organization(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_join_organization(uuid, text) TO authenticated;

-- 5. Org leave: stop NULL-ing the roster columns.
CREATE OR REPLACE FUNCTION public.teacher_leave_organization()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.profiles
		WHERE id = auth.uid() AND role = 'teacher' AND deleted_at IS NULL
	) THEN
		RAISE EXCEPTION 'Caller must be a teacher';
	END IF;

	UPDATE public.teacher_organization_memberships
	SET status = 'revoked',
		revoked_at = COALESCE(revoked_at, now()),
		updated_at = now()
	WHERE teacher_id = auth.uid() AND status = 'active';
END;
$$;

-- 6. Drop the roster index + columns. The FK (teacher_roster_subject_id → subjects)
--    and the grade CHECK constraint drop automatically with their columns.
DROP INDEX IF EXISTS public.idx_profiles_teacher_roster_subject;

ALTER TABLE public.profiles
	DROP COLUMN IF EXISTS teacher_roster_subject_id,
	DROP COLUMN IF EXISTS teacher_roster_grade;

COMMIT;
