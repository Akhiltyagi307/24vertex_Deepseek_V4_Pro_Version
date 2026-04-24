-- SaaS billing: plans, subscriptions, usage ledger, payments, coupons, webhook log.
-- Hybrid 14-day free trial seeded on student profile creation.
-- Razorpay Subscriptions + UPI Autopay is the paid gateway; coupons are DB-only.

BEGIN;

-- ============================================================
-- PLANS (seeded; Razorpay plan ids populated by scripts/seed-razorpay-plans.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    interval VARCHAR(16) NOT NULL CHECK (interval IN ('trial', 'month', 'year')),
    price_paise INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
    tests_per_period INTEGER NOT NULL CHECK (tests_per_period >= 0),
    tokens_grade_6_10 INTEGER NOT NULL CHECK (tokens_grade_6_10 >= 0),
    tokens_grade_11_12 INTEGER NOT NULL CHECK (tokens_grade_11_12 >= 0),
    pool_multiplier INTEGER NOT NULL DEFAULT 1 CHECK (pool_multiplier >= 1),
    razorpay_plan_id VARCHAR(80),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.plans (code, name, interval, price_paise, tests_per_period, tokens_grade_6_10, tokens_grade_11_12, pool_multiplier, sort_order)
VALUES
    ('free',        'Free Trial',   'trial',     0,        5,  50000,  50000,  1, 0),
    ('pro_monthly', 'Pro Monthly', 'month',  100000, 30, 200000, 400000, 1, 1),
    ('pro_annual',  'Pro Annual',  'year',  1000000, 360, 2400000, 4800000, 12, 2)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SUBSCRIPTIONS: one active row per student
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_code VARCHAR(32) NOT NULL REFERENCES public.plans(code),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('trialing', 'active', 'coupon', 'grace', 'past_due', 'cancelled', 'expired')),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    razorpay_subscription_id VARCHAR(80),
    razorpay_customer_id VARCHAR(80),
    -- pending plan code captured at Razorpay checkout time; applied on webhook
    pending_plan_code VARCHAR(32) REFERENCES public.plans(code),
    -- staff override keeps enforcement off for a specific profile (internal testers)
    staff_override BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub ON public.subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- ============================================================
-- USAGE_PERIODS: per-period ledger (atomic UPDATE … RETURNING gates)
-- For monthly plans: one row per billing cycle.
-- For annual plans: one row spanning the full year (pool burn).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    tests_quota INTEGER NOT NULL CHECK (tests_quota >= 0),
    tests_used INTEGER NOT NULL DEFAULT 0 CHECK (tests_used >= 0),
    tokens_quota INTEGER NOT NULL CHECK (tokens_quota >= 0),
    tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT usage_periods_sub_start_unique UNIQUE (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_periods_profile_end ON public.usage_periods(profile_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_usage_periods_subscription ON public.usage_periods(subscription_id, period_end DESC);

-- ============================================================
-- PAYMENTS: Razorpay receipt log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    razorpay_payment_id VARCHAR(80) UNIQUE,
    razorpay_invoice_id VARCHAR(80),
    razorpay_order_id VARCHAR(80),
    amount_paise INTEGER NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    method VARCHAR(30),
    invoice_short_url VARCHAR(500),
    captured_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_profile ON public.payments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments(subscription_id, created_at DESC);

-- ============================================================
-- COUPONS (shared campaign codes) + redemptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    description TEXT,
    max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0),
    redemptions_count INTEGER NOT NULL DEFAULT 0 CHECK (redemptions_count >= 0),
    duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
    grants_plan_code VARCHAR(32) NOT NULL REFERENCES public.plans(code),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT coupon_redemptions_unique UNIQUE (coupon_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_profile ON public.coupon_redemptions(profile_id);

-- Seed a demo campaign coupon that grants 1 month of pro_monthly. Feel free to rotate/expire.
INSERT INTO public.coupons (code, description, max_redemptions, duration_days, grants_plan_code, expires_at)
VALUES ('PARENT100', 'Parent referral – 1 month Pro Monthly free',
        100, 30, 'pro_monthly', NOW() + INTERVAL '180 days')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- BILLING EVENTS: idempotent webhook log (raw payloads)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_event_id VARCHAR(120) UNIQUE,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_type_created ON public.billing_events(event_type, created_at DESC);

-- ============================================================
-- RLS: owner-reads for students; service-role bypasses for writes
-- ============================================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Everyone can read the plan catalog.
CREATE POLICY "plans_select_all" ON public.plans FOR SELECT TO authenticated USING (is_active = TRUE);

-- Students read their own subscription and usage.
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "usage_periods_select_own" ON public.usage_periods FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "coupon_redemptions_select_own" ON public.coupon_redemptions FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Coupons / billing_events: admin reads only (no authenticated policy; service-role bypasses).

GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.usage_periods TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.coupon_redemptions TO authenticated;

GRANT ALL ON public.plans TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.usage_periods TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.coupons TO service_role;
GRANT ALL ON public.coupon_redemptions TO service_role;
GRANT ALL ON public.billing_events TO service_role;

-- ============================================================
-- PROFILE TRIGGER: seed free trial subscription for new students
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_free_trial_for_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_trial_end TIMESTAMPTZ := NOW() + INTERVAL '14 days';
    v_plan RECORD;
    v_sub_id UUID;
    v_token_quota INT;
BEGIN
    IF NEW.role <> 'student' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE profile_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_plan FROM public.plans WHERE code = 'free';
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NEW.grade IS NOT NULL AND NEW.grade BETWEEN 11 AND 12 THEN
        v_token_quota := v_plan.tokens_grade_11_12;
    ELSE
        v_token_quota := v_plan.tokens_grade_6_10;
    END IF;

    INSERT INTO public.subscriptions (
        profile_id, plan_code, status, trial_ends_at,
        current_period_start, current_period_end
    ) VALUES (
        NEW.id, 'free', 'trialing', v_trial_end, NOW(), v_trial_end
    ) RETURNING id INTO v_sub_id;

    INSERT INTO public.usage_periods (
        subscription_id, profile_id, period_start, period_end,
        tests_quota, tests_used, tokens_quota, tokens_used
    ) VALUES (
        v_sub_id, NEW.id, NOW(), v_trial_end,
        v_plan.tests_per_period, 0, v_token_quota, 0
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_free_trial ON public.profiles;
CREATE TRIGGER trg_seed_free_trial
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_free_trial_for_student();

-- Backfill any existing students that predate this migration.
INSERT INTO public.subscriptions (profile_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
SELECT p.id, 'free', 'trialing', NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '14 days'
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.profile_id = p.id
WHERE p.role = 'student' AND s.id IS NULL;

INSERT INTO public.usage_periods (subscription_id, profile_id, period_start, period_end, tests_quota, tests_used, tokens_quota, tokens_used)
SELECT s.id,
       s.profile_id,
       s.current_period_start,
       s.current_period_end,
       (SELECT tests_per_period FROM public.plans WHERE code = s.plan_code),
       0,
       CASE
           WHEN p.grade BETWEEN 11 AND 12
               THEN (SELECT tokens_grade_11_12 FROM public.plans WHERE code = s.plan_code)
           ELSE (SELECT tokens_grade_6_10 FROM public.plans WHERE code = s.plan_code)
       END,
       0
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.profile_id
LEFT JOIN public.usage_periods u
    ON u.subscription_id = s.id AND u.period_start = s.current_period_start
WHERE u.id IS NULL;

-- ============================================================
-- RPC: atomic quota consumption gates
-- ============================================================

-- Returns t/f. Only decrements when under quota.
CREATE OR REPLACE FUNCTION public.billing_consume_test(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_sub_id UUID;
    v_affected INT;
BEGIN
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;
    UPDATE public.usage_periods
    SET tests_used = tests_used + 1
    WHERE subscription_id = v_sub_id
      AND tests_used < tests_quota
      AND period_end > NOW();
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected > 0;
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
    v_affected INT;
BEGIN
    IF p_tokens IS NULL OR p_tokens <= 0 THEN
        RETURN TRUE;
    END IF;
    SELECT id INTO v_sub_id FROM public.subscriptions WHERE profile_id = p_profile_id;
    IF v_sub_id IS NULL THEN
        RETURN FALSE;
    END IF;
    UPDATE public.usage_periods
    SET tokens_used = LEAST(tokens_quota, tokens_used + p_tokens)
    WHERE subscription_id = v_sub_id
      AND period_end > NOW();
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.billing_consume_test(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.billing_consume_tokens(UUID, INT) TO authenticated, service_role;

COMMIT;
