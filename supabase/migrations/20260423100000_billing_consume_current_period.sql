-- Fix double-counting: consume RPCs previously updated every usage_period row with
-- period_end > now(), so overlapping rows (e.g. trial + new paid/coupon period) both
-- incremented. Only the active window should be billed: period_start <= now < period_end,
-- preferring the longest period_end when multiple match (same rule as app entitlements).

BEGIN;

CREATE OR REPLACE FUNCTION public.billing_consume_test(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sub_id UUID;
    v_usage_id UUID;
BEGIN
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u.id INTO v_usage_id
    FROM public.usage_periods u
    WHERE u.subscription_id = v_sub_id
      AND u.period_start <= NOW()
      AND u.period_end > NOW()
      AND u.tests_used < u.tests_quota
    ORDER BY u.period_end DESC
    LIMIT 1;

    IF v_usage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.usage_periods
    SET tests_used = tests_used + 1
    WHERE id = v_usage_id;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_consume_tokens(p_profile_id UUID, p_tokens INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sub_id UUID;
    v_usage_id UUID;
BEGIN
    IF p_tokens IS NULL OR p_tokens <= 0 THEN
        RETURN TRUE;
    END IF;

    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT u.id INTO v_usage_id
    FROM public.usage_periods u
    WHERE u.subscription_id = v_sub_id
      AND u.period_start <= NOW()
      AND u.period_end > NOW()
    ORDER BY u.period_end DESC
    LIMIT 1;

    IF v_usage_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.usage_periods
    SET tokens_used = LEAST(tokens_quota, tokens_used + p_tokens)
    WHERE id = v_usage_id;
    RETURN TRUE;
END;
$$;

COMMIT;
