-- Teacher approval lifecycle history.
--
-- Records every admin-driven transition of a teacher's `is_verified` flag
-- (verified / unverified / rejected). Two consumers:
--   1. Cooldown check on auth-side teacher signup — reject a fresh signup
--      within 24h of a 'rejected' row for the same email so admins aren't
--      pestered by retry loops.
--   2. Audit reconstruction: pair with `admin_action_log.payload` (which
--      now carries `{ before, after }` for the same transition) to attribute
--      who flipped what and when.
--
-- Email is denormalised so the cooldown check still works after the
-- teacher's `profiles` row has been deleted (FK is ON DELETE CASCADE, but
-- a rejected teacher may never have a profile at all).
--
-- Single-migration table creation runs inside one implicit transaction;
-- CREATE INDEX CONCURRENTLY is therefore NOT applicable here (and unnecessary
-- for an empty new table). The repo-wide CONCURRENTLY guidance applies only
-- to new indexes on existing hot tables.

CREATE TABLE IF NOT EXISTS public.teacher_approval_history (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	teacher_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	email text NOT NULL,
	action text NOT NULL CHECK (action IN ('verified', 'unverified', 'rejected')),
	actor_admin_id uuid NULL,
	reason text NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

-- Cooldown lookup is `lower(email) = ? AND created_at > now() - interval '24h'`.
-- The functional index supports it and keeps lookups O(log n) even after a
-- large backlog of historical rows.
CREATE INDEX IF NOT EXISTS teacher_approval_history_email_lower_created_at_idx
	ON public.teacher_approval_history (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS teacher_approval_history_teacher_user_id_idx
	ON public.teacher_approval_history (teacher_user_id, created_at DESC);

ALTER TABLE public.teacher_approval_history ENABLE ROW LEVEL SECURITY;

-- No SELECT / INSERT / UPDATE / DELETE policies are declared on purpose:
-- only the service-role client (used by `src/lib/admin/teacher-approval-history.ts`
-- and `src/lib/auth/teacher-recent-rejection-check.ts`) bypasses RLS and may
-- read / write this table. Anonymous, anon-key, and authenticated callers
-- receive no rows.

COMMENT ON TABLE public.teacher_approval_history IS
	'Admin-driven teacher verification lifecycle transitions. Source of truth for the 24h re-signup cooldown and approval audit reconstruction. Service-role only.';
