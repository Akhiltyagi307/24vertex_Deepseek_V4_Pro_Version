-- PL/pgSQL exposes RETURNS TABLE columns as variables; `ON CONFLICT (subscription_id,
-- period_start)` then errors with 42702 ("subscription_id" is ambiguous).

BEGIN;

CREATE OR REPLACE FUNCTION public.billing_redeem_coupon_atomic(
	p_coupon_id uuid,
	p_profile_id uuid,
	p_plan_code character varying,
	p_duration_days integer,
	p_tests_quota integer,
	p_tokens_quota integer
)
RETURNS TABLE(ok boolean, error_code text, subscription_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
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

	IF p_plan_code = 'free' THEN
		RETURN QUERY SELECT FALSE, 'invalid_plan', NULL::UUID;
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
	ON CONFLICT ON CONSTRAINT usage_periods_sub_start_unique DO UPDATE
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
$function$;

COMMIT;
