-- W1.4 — billing_action_failures: durable surface for non-fatal billing
-- side-effect failures (coupon redemption RPC, email send, partial sync,
-- orphan customers from W4.4, etc.).
--
-- Before this table, the coupon-redemption-on-webhook path swallowed RPC
-- failures with a Sentry warning that lacked coupon_id/profile_id context;
-- there was no retry surface, so a single dropped redemption stayed dropped.
-- The webhook itself returns 200 (Razorpay shouldn't retry — the side effect
-- is non-essential to the subscription state change), so without a durable
-- record the failure was effectively lost.
--
-- This table is the catch-all destination for those cases. The admin UI in
-- app/admin/(authenticated)/billing/action-failures/page.tsx lists open rows
-- and offers a retry button.
--
-- Single table with a `kind` discriminator + nullable foreign keys keeps the
-- schema flexible for the W3.4 (sync offers), W4.4 (orphan customers), and
-- W5.2 (email/analytics) workstreams without a per-kind table explosion.

CREATE TABLE IF NOT EXISTS public.billing_action_failures (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	kind TEXT NOT NULL,
	coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
	profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
	subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
	payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
	razorpay_event_id VARCHAR(120),
	error_message TEXT NOT NULL,
	payload JSONB NOT NULL DEFAULT '{}'::jsonb,
	retry_count INTEGER NOT NULL DEFAULT 0,
	last_retry_at TIMESTAMPTZ,
	resolved_at TIMESTAMPTZ,
	resolved_by_jti TEXT,
	resolution_note TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validate `kind` against a known enum at the app layer (tests scan source
-- for stale strings). Using a CHECK here would lock us out of adding new
-- kinds without a migration; we'd rather catch typos in code review.

CREATE INDEX IF NOT EXISTS idx_billing_action_failures_open
	ON public.billing_action_failures (kind, created_at DESC)
	WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_action_failures_coupon
	ON public.billing_action_failures (coupon_id)
	WHERE coupon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_action_failures_profile
	ON public.billing_action_failures (profile_id, created_at DESC)
	WHERE profile_id IS NOT NULL;

-- RLS: this table is admin-internal. service_role only.
ALTER TABLE public.billing_action_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_action_failures_no_anon ON public.billing_action_failures;
CREATE POLICY billing_action_failures_no_anon
	ON public.billing_action_failures
	FOR ALL
	TO authenticated, anon
	USING (false)
	WITH CHECK (false);

COMMENT ON TABLE public.billing_action_failures IS
	'Durable record of non-fatal billing side-effect failures (coupon redemption RPC, email, partial sync, orphan customers). Admin UI offers retry. Resolved rows kept for audit.';
