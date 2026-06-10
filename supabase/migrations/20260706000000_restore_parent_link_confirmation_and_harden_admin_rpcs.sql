-- Security remediation (review findings M1 + L4).
--
-- M1: The 2026-06-21 rebrand migration (20260621130000_vertex24_bypass_profile_guard)
-- overwrote public.link_parent_to_student and dropped the student-confirmation gate that
-- 20260525150000_parent_link_student_confirmation had added: when a student has no guardian
-- email on file, a parent link must be created as 'pending' and the student must approve it
-- before it activates. The rebrand reverted this to an unconditional 'active' link that also
-- back-fills the caller's email as the student's guardian, letting any parent-role account
-- silently claim an orphan student (and poison the real guardian's later link).
--
-- The rebrand also changed the return type (text -> void) via CREATE OR REPLACE without a
-- preceding DROP, which Postgres rejects (42P13: cannot change return type). On a database
-- that already held the 'text' version that statement aborts; on a fresh database it applies.
-- The two Supabase projects can therefore be on different versions of this function.
--
-- This migration restores the secure pending/confirm flow as the authoritative definition on
-- BOTH projects. It is idempotent: the explicit DROP handles a database holding either the
-- 'text' or the 'void' version. The confirm/reject flow is still wired in the app
-- (app/student/settings + src/lib/parent/pending-parent-links.ts), so no client change is needed.
--
-- L4: admin_set_teacher_verified trusts its p_teacher_id argument and had no in-function
-- authorization — it was protected only by a postgres-only GRANT. We add a defense-in-depth
-- guard that rejects any real authenticated non-service_role caller, while still allowing the
-- legitimate path (a direct Drizzle/postgres connection where auth.uid() is NULL, see
-- src/lib/admin/teacher-approval.ts) and the service_role client.

-- ---------------------------------------------------------------------------
-- M1 — restore parent-link student-confirmation flow
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.link_parent_to_student(text);

CREATE OR REPLACE FUNCTION public.parent_student_links_enforce_student_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND OLD.student_id = auth.uid() THEN
        IF NEW.student_id IS DISTINCT FROM OLD.student_id
            OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
        THEN
            RAISE EXCEPTION 'parent_student_links: student cannot reassign link endpoints'
                USING ERRCODE = '42501';
        END IF;
        IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
            IF OLD.status <> 'pending' THEN
                RAISE EXCEPTION 'parent_student_links: student can only activate a pending link'
                    USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.status = 'revoked' AND OLD.status IS DISTINCT FROM 'revoked' THEN
            IF OLD.status <> 'pending' THEN
                RAISE EXCEPTION 'parent_student_links: student can only reject a pending link'
                    USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'parent_student_links: student cannot change link status to %', NEW.status
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_parent_to_student(p_student_ref text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_trim text := trim(p_student_ref);
	v_student_id uuid;
	v_parent_auth_email text;
	v_student_parent_email text;
	v_parent_display_name text;
	v_link_status text;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent') THEN
		RAISE EXCEPTION 'Caller must be a parent';
	END IF;
	IF v_trim = '' THEN
		RAISE EXCEPTION 'Student reference required';
	END IF;

	SELECT lower(trim(coalesce(u.email, ''))) INTO v_parent_auth_email
	FROM auth.users u
	WHERE u.id = auth.uid();

	IF v_parent_auth_email IS NULL OR v_parent_auth_email = '' THEN
		v_parent_auth_email := lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')));
	END IF;

	BEGIN
		v_student_id := v_trim::uuid;
	EXCEPTION
		WHEN invalid_text_representation THEN
			v_student_id := NULL;
	END;

	IF v_student_id IS NULL THEN
		SELECT id INTO v_student_id
		FROM public.profiles
		WHERE role = 'student' AND student_link_code = upper(v_trim);
	END IF;

	IF v_student_id IS NULL THEN
		RAISE EXCEPTION 'Student not found';
	END IF;

	IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_student_id AND p.role = 'student') THEN
		RAISE EXCEPTION 'Student not found';
	END IF;

	SELECT nullif(trim(lower(coalesce(parent_email, ''))), '')
	INTO v_student_parent_email
	FROM public.profiles
	WHERE id = v_student_id AND role = 'student';

	SELECT full_name INTO v_parent_display_name
	FROM public.profiles
	WHERE id = auth.uid() AND role = 'parent';

	IF v_parent_display_name IS NULL THEN
		RAISE EXCEPTION 'Parent profile missing';
	END IF;

	-- When the student has no guardian email on file, the link starts 'pending'
	-- and the student must confirm it (confirm_parent_link) before it activates;
	-- guardian fields are NOT back-filled here. When a guardian email is on file,
	-- the parent's auth email must match before the link goes 'active'.
	IF v_student_parent_email IS NULL THEN
		v_link_status := 'pending';
	ELSE
		IF v_student_parent_email IS DISTINCT FROM v_parent_auth_email THEN
			RAISE EXCEPTION 'Parent email does not match student record';
		END IF;
		v_link_status := 'active';
	END IF;

	INSERT INTO public.parent_student_links (parent_id, student_id, status, linked_at)
	VALUES (auth.uid(), v_student_id, v_link_status, now())
	ON CONFLICT (parent_id, student_id) DO UPDATE
	SET
		status = CASE
			WHEN parent_student_links.status = 'active' THEN 'active'
			ELSE EXCLUDED.status
		END,
		linked_at = CASE
			WHEN parent_student_links.status = 'active' THEN parent_student_links.linked_at
			ELSE now()
		END;

	SELECT status INTO v_link_status
	FROM public.parent_student_links
	WHERE parent_id = auth.uid() AND student_id = v_student_id;

	RETURN coalesce(v_link_status, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_parent_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id uuid;
	v_parent_id uuid;
	v_parent_auth_email text;
	v_parent_display_name text;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT student_id, parent_id
	INTO v_student_id, v_parent_id
	FROM public.parent_student_links
	WHERE id = p_link_id
	FOR UPDATE;

	IF v_student_id IS NULL THEN
		RAISE EXCEPTION 'Link not found';
	END IF;

	IF v_student_id IS DISTINCT FROM auth.uid() THEN
		RAISE EXCEPTION 'Only the student can confirm this link'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.parent_student_links
		WHERE id = p_link_id AND status = 'pending'
	) THEN
		RAISE EXCEPTION 'Link is not pending approval';
	END IF;

	SELECT lower(trim(coalesce(u.email, ''))) INTO v_parent_auth_email
	FROM auth.users u
	WHERE u.id = v_parent_id;

	IF v_parent_auth_email IS NULL OR v_parent_auth_email = '' THEN
		RAISE EXCEPTION 'Parent account email missing';
	END IF;

	SELECT full_name INTO v_parent_display_name
	FROM public.profiles
	WHERE id = v_parent_id AND role = 'parent';

	IF v_parent_display_name IS NULL THEN
		RAISE EXCEPTION 'Parent profile missing';
	END IF;

	PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
	UPDATE public.profiles SET
		parent_email = v_parent_auth_email,
		parent_name = v_parent_display_name
	WHERE id = v_student_id AND role = 'student';

	UPDATE public.parent_student_links
	SET status = 'active', linked_at = now()
	WHERE id = p_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_parent_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student_id uuid;
BEGIN
	IF auth.uid() IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT student_id INTO v_student_id
	FROM public.parent_student_links
	WHERE id = p_link_id
	FOR UPDATE;

	IF v_student_id IS NULL THEN
		RAISE EXCEPTION 'Link not found';
	END IF;

	IF v_student_id IS DISTINCT FROM auth.uid() THEN
		RAISE EXCEPTION 'Only the student can reject this link'
			USING ERRCODE = '42501';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.parent_student_links
		WHERE id = p_link_id AND status = 'pending'
	) THEN
		RAISE EXCEPTION 'Link is not pending approval';
	END IF;

	UPDATE public.parent_student_links
	SET status = 'revoked', linked_at = NULL
	WHERE id = p_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_parent_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_parent_link(uuid) TO authenticated;

COMMENT ON FUNCTION public.link_parent_to_student(text) IS
'Links parent to student. Returns link status: active (immediate) or pending (student must confirm when guardian email was blank).';

COMMENT ON FUNCTION public.confirm_parent_link(uuid) IS
'Student approves a pending parent_student_links row; backfills guardian fields and activates the link.';

COMMENT ON FUNCTION public.reject_parent_link(uuid) IS
'Student rejects a pending parent_student_links row (status revoked).';

-- ---------------------------------------------------------------------------
-- L4 — defense-in-depth authorization for admin_set_teacher_verified
-- ---------------------------------------------------------------------------
-- The only caller invokes this over a direct Drizzle/postgres connection
-- (auth.uid() IS NULL), so the guard must NOT reject that path; it rejects only
-- a real authenticated non-service_role caller, which would only be reachable if
-- the postgres-only GRANT is ever loosened to `authenticated`. We set BOTH GUC
-- names so the privilege-column bypass works regardless of which version of
-- profile_update_guard_bypassed() a given project is currently running.
CREATE OR REPLACE FUNCTION public.admin_set_teacher_verified(p_teacher_id uuid, p_verified boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_count int;
BEGIN
	IF auth.uid() IS NOT NULL AND (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
		RAISE EXCEPTION 'admin_set_teacher_verified: not authorized'
			USING ERRCODE = '42501';
	END IF;

	PERFORM set_config('vertex24.bypass_profile_update_guard', 'on', true);
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
