-- Teacher approval updates `profiles.is_verified`, which is guarded by
-- `trg_profiles_block_privilege_updates`. Setting `eduai.bypass_profile_update_guard`
-- must happen in the same database execution context as the UPDATE; otherwise
-- pooled connections (Supabase transaction pooler) can drop session locals between
-- separate Drizzle statements and the trigger rejects the write.

CREATE OR REPLACE FUNCTION public.admin_set_teacher_verified(p_teacher_id uuid, p_verified boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_count int;
BEGIN
	PERFORM set_config('eduai.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles
	SET is_verified = p_verified,
		updated_at = now()
	WHERE id = p_teacher_id AND role = 'teacher';
	GET DIAGNOSTICS v_count = ROW_COUNT;
	RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_teacher_verified(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_verified(uuid, boolean) TO postgres;
