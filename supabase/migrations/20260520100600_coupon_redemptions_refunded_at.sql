-- W3.2 — coupon_redemptions.refunded_at + rollback helper.
--
-- When a coupon-discounted payment is refunded, the redemption row stays
-- (best practice: refund != punishment, the user can still reuse the coupon
-- if they re-subscribe before max_redemptions is hit) but we must:
--   1. Decrement coupons.redemptions_count so the global cap is accurate.
--   2. Mark coupon_redemptions.refunded_at so the redemption can be excluded
--      from reports and the unique (coupon_id, profile_id) constraint still
--      prevents the same user from re-applying.
--
-- The handler in src/lib/billing/razorpay-webhook-processor.ts (refund.processed)
-- and the admin refund route call billing_rollback_coupon_redemption_atomic
-- which does both updates atomically.

ALTER TABLE public.coupon_redemptions
	ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_refunded_at
	ON public.coupon_redemptions (refunded_at)
	WHERE refunded_at IS NOT NULL;

-- Atomic rollback: decrement count + mark redemption refunded in one txn.
-- Returns whether anything was actually rolled back (idempotent: a second
-- call for the same payment is a no-op).
CREATE OR REPLACE FUNCTION public.billing_rollback_coupon_redemption_atomic(
	p_subscription_id uuid,
	p_profile_id uuid
)
RETURNS TABLE(ok boolean, rolled_back boolean, coupon_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_redemption RECORD;
BEGIN
	IF p_subscription_id IS NULL OR p_profile_id IS NULL THEN
		RETURN QUERY SELECT FALSE, FALSE, NULL::UUID;
		RETURN;
	END IF;

	-- FOR UPDATE on the redemption row + its parent coupon serializes
	-- concurrent webhook deliveries for the same payment.
	SELECT cr.id, cr.coupon_id, cr.refunded_at
	INTO v_redemption
	FROM public.coupon_redemptions cr
	WHERE cr.subscription_id = p_subscription_id AND cr.profile_id = p_profile_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RETURN QUERY SELECT TRUE, FALSE, NULL::UUID;
		RETURN;
	END IF;

	-- Idempotent: a duplicate refund.processed webhook for the same payment
	-- (or the admin refund route firing alongside the webhook) finds the row
	-- already marked and exits without double-decrementing.
	IF v_redemption.refunded_at IS NOT NULL THEN
		RETURN QUERY SELECT TRUE, FALSE, v_redemption.coupon_id;
		RETURN;
	END IF;

	-- Lock parent coupon and decrement (clamped to 0 to defend against
	-- counter drift; a stuck-at-0 coupon is recoverable, a negative one is
	-- visually broken).
	UPDATE public.coupons
	SET redemptions_count = GREATEST(0, redemptions_count - 1)
	WHERE id = v_redemption.coupon_id;

	UPDATE public.coupon_redemptions
	SET refunded_at = NOW()
	WHERE id = v_redemption.id;

	RETURN QUERY SELECT TRUE, TRUE, v_redemption.coupon_id;
END;
$function$;
