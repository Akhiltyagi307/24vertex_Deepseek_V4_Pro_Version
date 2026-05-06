-- W4.1 — plan-change audit table.
--
-- A user-facing plan change (Pro Monthly ↔ Pro Annual) goes through:
--   1. POST /api/billing/change-plan        → calls Razorpay subscriptions.update
--   2. (when=now)  charge a one-off prorated order for the upgrade delta
--   3. webhook subscription.updated         → flips local plan_code + period
--
-- Each row here records intent + outcome so we can correlate Razorpay's
-- subscription.updated with the user click that triggered it. Without this,
-- a Razorpay-initiated change (admin in Razorpay dashboard, never our UI)
-- and a user-initiated change look identical to the webhook handler.

CREATE TABLE IF NOT EXISTS public.billing_plan_changes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
	from_plan_code VARCHAR(32),
	to_plan_code VARCHAR(32) NOT NULL,
	when_applied VARCHAR(16) NOT NULL,
	proration_delta_paise INTEGER,
	proration_payment_id VARCHAR(80),
	initiated_by_user_id UUID,
	initiated_by_admin_session_id UUID,
	error_message TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	completed_at TIMESTAMPTZ,
	CONSTRAINT billing_plan_changes_when_applied_check CHECK (when_applied IN ('now', 'cycle_end'))
);

CREATE INDEX IF NOT EXISTS idx_billing_plan_changes_subscription
	ON public.billing_plan_changes (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_plan_changes_pending
	ON public.billing_plan_changes (created_at DESC)
	WHERE completed_at IS NULL;

ALTER TABLE public.billing_plan_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_plan_changes_no_anon ON public.billing_plan_changes;
CREATE POLICY billing_plan_changes_no_anon
	ON public.billing_plan_changes
	FOR ALL TO authenticated, anon
	USING (false) WITH CHECK (false);

COMMENT ON TABLE public.billing_plan_changes IS
	'Plan change attempts (user or admin). Razorpay does not auto-prorate so we compute delta_paise locally and capture it here for audit.';
