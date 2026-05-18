-- Parent-side companion to public.unlink_teacher_from_student
-- (20260617103000_teacher_roster_and_unlink_student.sql).
--
-- The accompanying `parent_session_invalidations` table is an append-style
-- (one row per parent, upsert on conflict) forensic ledger of when an
-- unlink occurred. requireParent() does NOT consult it — the security
-- boundary is enforced by assertParentActiveLink() on every parent page
-- that reads child data, which bounces stale cookies to
-- /parent/select-student. The table exists so operators can see, via the
-- service-role SQL console, when a given parent revoked access (and why).

CREATE TABLE IF NOT EXISTS public.parent_session_invalidations (
    parent_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    invalidated_at timestamptz NOT NULL DEFAULT now(),
    reason text CHECK (char_length(reason) BETWEEN 0 AND 64)
);

-- Service-role-only. No SELECT policy on `authenticated` because no
-- end-user code reads this table; operators query via the admin SQL console
-- (which uses the service role and bypasses RLS).
ALTER TABLE public.parent_session_invalidations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.unlink_parent_from_student(p_student_id uuid)
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
        WHERE id = auth.uid() AND role = 'parent'
    ) THEN
        RAISE EXCEPTION 'Caller must be a parent';
    END IF;

    UPDATE public.parent_student_links
    SET status = 'revoked',
        revoked_at = COALESCE(revoked_at, now())
    WHERE parent_id = auth.uid()
      AND student_id = p_student_id
      AND status = 'active';

    -- Boot the parent off every open tab the next time requireParent()
    -- runs. The cookie itself is also cleared by the calling server
    -- action, but this catches other browsers / devices.
    INSERT INTO public.parent_session_invalidations (parent_id, invalidated_at, reason)
    VALUES (auth.uid(), now(), 'unlink_child')
    ON CONFLICT (parent_id) DO UPDATE
        SET invalidated_at = EXCLUDED.invalidated_at,
            reason = EXCLUDED.reason;
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_parent_from_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_parent_from_student(uuid) TO authenticated;

COMMENT ON TABLE public.parent_session_invalidations IS
    'Per-parent unlink-event ledger. Forensic only; no end-user reads. assertParentActiveLink() enforces the security boundary on each request.';
