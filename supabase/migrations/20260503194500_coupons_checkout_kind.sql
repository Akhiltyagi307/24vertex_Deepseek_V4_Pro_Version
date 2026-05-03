-- Coupons: multi-redeem (optional single-use-global), entitlement vs checkout_discount,
-- Razorpay offer map, and atomic checkout redemption after paid subscription.

BEGIN;

-- 1) Columns on coupons
ALTER TABLE public.coupons
	ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'entitlement',
	ADD COLUMN IF NOT EXISTS single_use_globally boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS discount_percent smallint,
	ADD COLUMN IF NOT EXISTS eligible_plan_codes text[],
	ADD COLUMN IF NOT EXISTS razorpay_offers_by_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_kind_chk;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_kind_chk CHECK (kind IN ('entitlement', 'checkout_discount'));

-- Entitlement coupons require a plan and positive duration; checkout coupons require discount + offer map.
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_kind_fields_chk;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_kind_fields_chk CHECK (
	(
		kind = 'entitlement'
		AND grants_plan_code IS NOT NULL
		AND duration_days > 0
		AND discount_percent IS NULL
	)
	OR (
		kind = 'checkout_discount'
		AND discount_percent IS NOT NULL
		AND discount_percent >= 1
		AND discount_percent <= 100
		AND duration_days >= 0
	)
);

COMMENT ON COLUMN public.coupons.kind IS 'entitlement = free N days via billing_redeem_coupon_atomic; checkout_discount = % off Razorpay subscription via offer_id map.';
COMMENT ON COLUMN public.coupons.single_use_globally IS 'When true, at most one coupon_redemptions row may exist for this coupon (legacy campaign behavior).';
COMMENT ON COLUMN public.coupons.eligible_plan_codes IS 'For checkout_discount: NULL = all paid plans (pro_monthly, pro_annual); else subset.';
COMMENT ON COLUMN public.coupons.razorpay_offers_by_plan IS 'For checkout_discount: JSON map plan_code -> Razorpay offer_id (offer_...).';

-- Allow checkout rows without a grants_plan_code
ALTER TABLE public.coupons ALTER COLUMN grants_plan_code DROP NOT NULL;

-- Backfill existing rows as entitlement + legacy single-use-global behavior
UPDATE public.coupons
SET
	kind = 'entitlement',
	single_use_globally = true
WHERE kind = 'entitlement';

-- 2) Replace global single-use trigger with conditional on single_use_globally
CREATE OR REPLACE FUNCTION public.enforce_coupon_single_use_global()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_single boolean;
BEGIN
	SELECT c.single_use_globally
	INTO v_single
	FROM public.coupons c
	WHERE c.id = NEW.coupon_id;

	IF v_single IS DISTINCT FROM TRUE THEN
		RETURN NEW;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.coupon_redemptions cr
		WHERE cr.coupon_id = NEW.coupon_id
	) THEN
		RAISE EXCEPTION 'Coupon has already been redeemed'
			USING ERRCODE = '23505';
	END IF;

	RETURN NEW;
END;
$$;

-- 3) Entitlement RPC: reject checkout_discount coupons
CREATE OR REPLACE FUNCTION public.billing_redeem_coupon_atomic(
	p_coupon_id UUID,
	p_profile_id UUID,
	p_plan_code VARCHAR,
	p_duration_days INTEGER,
	p_tests_quota INTEGER,
	p_tokens_quota INTEGER
)
RETURNS TABLE (
	ok BOOLEAN,
	error_code TEXT,
	subscription_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_now TIMESTAMPTZ := NOW();
	v_end TIMESTAMPTZ;
	v_sub_id UUID;
	v_sub_status VARCHAR(20);
	v_coupon RECORD;
BEGIN
	IF p_coupon_id IS NULL
		OR p_profile_id IS NULL
		OR p_plan_code IS NULL
		OR p_duration_days IS NULL
		OR p_duration_days <= 0
		OR p_tests_quota IS NULL
		OR p_tests_quota < 0
		OR p_tokens_quota IS NULL
		OR p_tokens_quota < 0 THEN
		RETURN QUERY SELECT FALSE, 'invalid_input', NULL::UUID;
		RETURN;
	END IF;

	v_end := v_now + make_interval(days => p_duration_days);

	SELECT
		id,
		is_active,
		expires_at,
		max_redemptions,
		redemptions_count,
		kind
	INTO v_coupon
	FROM public.coupons
	WHERE id = p_coupon_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RETURN QUERY SELECT FALSE, 'invalid_code', NULL::UUID;
		RETURN;
	END IF;

	IF v_coupon.kind IS DISTINCT FROM 'entitlement' THEN
		RETURN QUERY SELECT FALSE, 'wrong_kind', NULL::UUID;
		RETURN;
	END IF;

	IF v_coupon.is_active IS DISTINCT FROM TRUE THEN
		RETURN QUERY SELECT FALSE, 'inactive', NULL::UUID;
		RETURN;
	END IF;

	IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < v_now THEN
		RETURN QUERY SELECT FALSE, 'expired', NULL::UUID;
		RETURN;
	END IF;

	IF v_coupon.redemptions_count >= v_coupon.max_redemptions THEN
		RETURN QUERY SELECT FALSE, 'exhausted', NULL::UUID;
		RETURN;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.coupon_redemptions cr
		WHERE cr.coupon_id = p_coupon_id
			AND cr.profile_id = p_profile_id
	) THEN
		RETURN QUERY SELECT FALSE, 'already_redeemed', NULL::UUID;
		RETURN;
	END IF;

	SELECT s.id, s.status
	INTO v_sub_id, v_sub_status
	FROM public.subscriptions s
	WHERE s.profile_id = p_profile_id
	FOR UPDATE;

	IF v_sub_id IS NOT NULL AND v_sub_status IN ('active', 'grace', 'past_due') THEN
		RETURN QUERY SELECT FALSE, 'blocked_paid', NULL::UUID;
		RETURN;
	END IF;

	IF v_sub_id IS NULL THEN
		INSERT INTO public.subscriptions (
			profile_id,
			plan_code,
			status,
			current_period_start,
			current_period_end
		)
		VALUES (
			p_profile_id,
			p_plan_code,
			'coupon',
			v_now,
			v_end
		)
		RETURNING id INTO v_sub_id;
	ELSE
		UPDATE public.subscriptions
		SET
			plan_code = p_plan_code,
			status = 'coupon',
			current_period_start = v_now,
			current_period_end = v_end,
			cancel_at_period_end = FALSE,
			updated_at = v_now
		WHERE id = v_sub_id;
	END IF;

	INSERT INTO public.usage_periods (
		subscription_id,
		profile_id,
		period_start,
		period_end,
		tests_quota,
		tests_used,
		tokens_quota,
		tokens_used
	)
	VALUES (
		v_sub_id,
		p_profile_id,
		v_now,
		v_end,
		p_tests_quota,
		0,
		p_tokens_quota,
		0
	)
	ON CONFLICT (subscription_id, period_start) DO UPDATE
	SET
		period_end = EXCLUDED.period_end,
		tests_quota = EXCLUDED.tests_quota,
		tests_used = EXCLUDED.tests_used,
		tokens_quota = EXCLUDED.tokens_quota,
		tokens_used = EXCLUDED.tokens_used;

	UPDATE public.coupons
	SET redemptions_count = redemptions_count + 1
	WHERE id = p_coupon_id;

	INSERT INTO public.coupon_redemptions (
		coupon_id,
		profile_id,
		subscription_id
	)
	VALUES (
		p_coupon_id,
		p_profile_id,
		v_sub_id
	);

	RETURN QUERY SELECT TRUE, NULL::TEXT, v_sub_id;
END;
$$;

-- 4) Idempotent checkout redemption (webhook: first successful grant path)
CREATE OR REPLACE FUNCTION public.billing_apply_checkout_coupon_redemption_atomic(
	p_coupon_id UUID,
	p_profile_id UUID,
	p_our_subscription_id UUID
)
RETURNS TABLE (
	ok BOOLEAN,
	applied BOOLEAN,
	error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_coupon RECORD;
	v_inserted boolean := false;
BEGIN
	IF p_coupon_id IS NULL OR p_profile_id IS NULL OR p_our_subscription_id IS NULL THEN
		RETURN QUERY SELECT FALSE, FALSE, 'invalid_input';
		RETURN;
	END IF;

	SELECT id, kind, is_active, expires_at, max_redemptions, redemptions_count
	INTO v_coupon
	FROM public.coupons
	WHERE id = p_coupon_id
	FOR UPDATE;

	IF NOT FOUND THEN
		RETURN QUERY SELECT FALSE, FALSE, 'invalid_code';
		RETURN;
	END IF;

	IF v_coupon.kind IS DISTINCT FROM 'checkout_discount' THEN
		RETURN QUERY SELECT FALSE, FALSE, 'wrong_kind';
		RETURN;
	END IF;

	IF v_coupon.is_active IS DISTINCT FROM TRUE THEN
		RETURN QUERY SELECT FALSE, FALSE, 'inactive';
		RETURN;
	END IF;

	IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
		RETURN QUERY SELECT FALSE, FALSE, 'expired';
		RETURN;
	END IF;

	IF v_coupon.redemptions_count >= v_coupon.max_redemptions THEN
		RETURN QUERY SELECT FALSE, FALSE, 'exhausted';
		RETURN;
	END IF;

	BEGIN
		INSERT INTO public.coupon_redemptions (coupon_id, profile_id, subscription_id)
		VALUES (p_coupon_id, p_profile_id, p_our_subscription_id);
		v_inserted := true;
	EXCEPTION
		WHEN unique_violation THEN
			v_inserted := false;
	END;

	IF v_inserted THEN
		UPDATE public.coupons
		SET redemptions_count = redemptions_count + 1
		WHERE id = p_coupon_id;
	END IF;

	RETURN QUERY SELECT TRUE, v_inserted, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.billing_apply_checkout_coupon_redemption_atomic(UUID, UUID, UUID) TO service_role;

COMMIT;
