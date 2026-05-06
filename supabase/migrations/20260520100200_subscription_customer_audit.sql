-- W1.3 — Customer email-collision audit columns.
--
-- Razorpay's customers.create({ fail_existing: 0 }) returns the existing
-- customer when (email, contact) already match. If two of our profiles use the
-- same email + contact (parent + student in the same household, account
-- merge, re-signup), they end up sharing one Razorpay customer_id. Cancellation
-- on one would surprise the other.
--
-- The runtime fix lives in src/lib/billing/razorpay.ts: after create, check
-- the returned customer's notes.profile_id and refuse to reuse if it doesn't
-- match. These columns make the collision auditable on our side.

ALTER TABLE public.subscriptions
	ADD COLUMN IF NOT EXISTS razorpay_customer_email TEXT;

ALTER TABLE public.subscriptions
	ADD COLUMN IF NOT EXISTS razorpay_customer_email_collision_at TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.razorpay_customer_email IS
	'Email address Razorpay knows the customer by. Denormalized for audit; may differ from profiles.email if we collision-suffixed.';

COMMENT ON COLUMN public.subscriptions.razorpay_customer_email_collision_at IS
	'Set when createOrFetchCustomer detected a Razorpay customer already owned by a different profile. Investigate manually.';
