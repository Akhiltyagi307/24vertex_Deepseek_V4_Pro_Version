-- Unique linking codes per organization so verified teachers prove affiliation when joining.

ALTER TABLE public.organizations
	ADD COLUMN IF NOT EXISTS linking_code varchar(8);

DO $$
DECLARE
	r RECORD;
	v_code text;
	alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	i int;
	j int;
	b bytea;
	ok boolean;
BEGIN
	FOR r IN SELECT id FROM public.organizations WHERE linking_code IS NULL
	LOOP
		ok := false;
		WHILE NOT ok LOOP
			b := gen_random_bytes(8);
			v_code := '';
			FOR i IN 0..7 LOOP
				j := get_byte(b, i);
				v_code := v_code || substr(alphabet, (j % length(alphabet)) + 1, 1);
			END LOOP;
			BEGIN
				UPDATE public.organizations SET linking_code = v_code WHERE id = r.id;
				ok := true;
			EXCEPTION
				WHEN unique_violation THEN
					ok := false;
			END;
		END LOOP;
	END LOOP;
END $$;

ALTER TABLE public.organizations
	ALTER COLUMN linking_code SET NOT NULL;

ALTER TABLE public.organizations
	DROP CONSTRAINT IF EXISTS organizations_linking_code_format_ck;

ALTER TABLE public.organizations
	ADD CONSTRAINT organizations_linking_code_format_ck
	CHECK (linking_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_linking_code_uidx
	ON public.organizations (linking_code);

-- Verified teachers must supply organization linking_code when joining (alongside org id).
DROP FUNCTION IF EXISTS public.teacher_join_organization(uuid);

CREATE OR REPLACE FUNCTION public.teacher_join_organization(p_organization_id uuid, p_linking_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_prev_org uuid;
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

	SELECT tom.organization_id INTO v_prev_org
	FROM public.teacher_organization_memberships tom
	WHERE tom.teacher_id = auth.uid()
		AND tom.status = 'active'
	LIMIT 1;

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

	IF v_prev_org IS DISTINCT FROM p_organization_id THEN
		UPDATE public.profiles
		SET teacher_roster_grade = NULL,
			teacher_roster_subject_id = NULL,
			updated_at = now()
		WHERE id = auth.uid() AND role = 'teacher';
	END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_join_organization(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_join_organization(uuid, text) TO authenticated;
