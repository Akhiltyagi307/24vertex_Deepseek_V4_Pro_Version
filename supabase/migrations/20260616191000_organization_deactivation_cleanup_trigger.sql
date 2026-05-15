CREATE OR REPLACE FUNCTION public.organizations_cleanup_on_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
	IF (NEW.is_active = false OR NEW.deleted_at IS NOT NULL)
		AND (
			OLD.is_active IS DISTINCT FROM NEW.is_active
			OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
		)
	THEN
		UPDATE public.profiles
		SET organization_id = NULL,
			updated_at = now()
		WHERE organization_id = NEW.id
			AND role = 'student';

		UPDATE public.teacher_organization_memberships
		SET status = 'revoked',
			revoked_at = COALESCE(revoked_at, now()),
			updated_at = now()
		WHERE organization_id = NEW.id
			AND status = 'active';
	END IF;

	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_cleanup_on_deactivate_trigger ON public.organizations;

CREATE TRIGGER organizations_cleanup_on_deactivate_trigger
AFTER UPDATE OF is_active, deleted_at ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.organizations_cleanup_on_deactivate();

REVOKE ALL ON FUNCTION public.organizations_cleanup_on_deactivate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.organizations_cleanup_on_deactivate() FROM anon;
REVOKE ALL ON FUNCTION public.organizations_cleanup_on_deactivate() FROM authenticated;
