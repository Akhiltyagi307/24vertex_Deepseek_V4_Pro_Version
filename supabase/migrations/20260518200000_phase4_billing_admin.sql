-- Phase 4 admin billing: billing_events replay metadata, payment refunds, quota grants, trial/blocklist

-- 1) billing_events — admin replay / resolve
ALTER TABLE public.billing_events
	ADD COLUMN IF NOT EXISTS replay_count integer NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS last_replay_at timestamptz,
	ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
	ADD COLUMN IF NOT EXISTS resolved_by text;

-- 2) payments — refund tracking
ALTER TABLE public.payments
	ADD COLUMN IF NOT EXISTS razorpay_refund_id varchar(80),
	ADD COLUMN IF NOT EXISTS refund_amount_paise integer,
	ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_refund_id
	ON public.payments (razorpay_refund_id)
	WHERE razorpay_refund_id IS NOT NULL;

-- 3) Idempotent admin refunds (Idempotency-Key header)
CREATE TABLE IF NOT EXISTS public.admin_refund_idempotency (
	idempotency_key text PRIMARY KEY,
	payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
	razorpay_refund_id varchar(80),
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_refund_idempotency ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_refund_idempotency TO service_role;

-- 4) Quota grants (manual test/token grants before subscription quota)
CREATE TABLE IF NOT EXISTS public.quota_grants (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
	grant_type varchar(32) NOT NULL,
	quantity integer NOT NULL CHECK (quantity > 0),
	consumed integer NOT NULL DEFAULT 0 CHECK (consumed >= 0),
	expires_at timestamptz,
	note text,
	created_by text,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quota_grants_student_type ON public.quota_grants (student_id, grant_type);
CREATE INDEX IF NOT EXISTS idx_quota_grants_expires ON public.quota_grants (expires_at);

ALTER TABLE public.quota_grants ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.quota_grants TO service_role;

-- 5) Identity blocklist (trial abuse prevention)
CREATE TABLE IF NOT EXISTS public.identity_blocklist (
	identity_key text PRIMARY KEY,
	reason text,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.identity_blocklist ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.identity_blocklist TO service_role;

-- 6) free_trial_claims — release audit columns
ALTER TABLE public.free_trial_claims
	ADD COLUMN IF NOT EXISTS released_at timestamptz,
	ADD COLUMN IF NOT EXISTS released_by text,
	ADD COLUMN IF NOT EXISTS released_reason text;
