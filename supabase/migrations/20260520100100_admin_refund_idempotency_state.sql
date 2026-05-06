-- W1.1 — Refund idempotency state machine.
--
-- Eliminates the "second refund" race in app/api/admin/payments/[id]/refund/route.ts.
-- Prior flow deleted the idempotency row on Razorpay error, so a retry with the
-- same Idempotency-Key would re-attempt the refund — fine when Razorpay actually
-- failed, but catastrophic when Razorpay processed the refund and we just didn't
-- see the response (network blip, gateway timeout). Two refunds for one charge.
--
-- New flow uses an explicit state column:
--   pending   — row reserved, Razorpay outcome unknown.
--   succeeded — row has razorpay_refund_id; safe to return on dedup.
--   orphan    — reconciliation determined the row will never succeed (e.g.
--               Razorpay confirms no refund exists). Admin must clear before
--               retry. Set only by the W3.3 reconciliation cron, never by the
--               request path.
--
-- Backfill rule: rows that already have razorpay_refund_id are 'succeeded';
-- everything else is 'pending' (defensive — these can't currently exist because
-- the prior code deleted-on-failure, but treating them as pending is the safe
-- default for the cron to investigate later).

ALTER TABLE public.admin_refund_idempotency
	ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'pending';

UPDATE public.admin_refund_idempotency
SET state = CASE
	WHEN razorpay_refund_id IS NOT NULL THEN 'succeeded'
	ELSE 'pending'
END
WHERE state = 'pending';

ALTER TABLE public.admin_refund_idempotency
	DROP CONSTRAINT IF EXISTS admin_refund_idempotency_state_check;

ALTER TABLE public.admin_refund_idempotency
	ADD CONSTRAINT admin_refund_idempotency_state_check
	CHECK (state IN ('pending', 'succeeded', 'orphan'));

-- Invariant: a row marked 'succeeded' must carry the refund id; otherwise the
-- dedup branch could return a null id to the admin and confuse them into
-- thinking the refund happened when it didn't (or vice versa).
ALTER TABLE public.admin_refund_idempotency
	DROP CONSTRAINT IF EXISTS admin_refund_idempotency_succeeded_has_refund_id;

ALTER TABLE public.admin_refund_idempotency
	ADD CONSTRAINT admin_refund_idempotency_succeeded_has_refund_id
	CHECK (state <> 'succeeded' OR razorpay_refund_id IS NOT NULL);

-- Index for the W3.3 reconciliation cron: find old pending rows fast.
CREATE INDEX IF NOT EXISTS idx_admin_refund_idempotency_pending_old
	ON public.admin_refund_idempotency (created_at)
	WHERE state = 'pending';
