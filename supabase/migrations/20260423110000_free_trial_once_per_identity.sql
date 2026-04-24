-- One free trial per normalized login identity (email, with Gmail-style folding;
-- falls back to normalized phone when email is absent). Prevents repeat trials from
-- new accounts sharing the same email or phone.

BEGIN;

-- ============================================================
-- Claim ledger (no FK to profiles so rows survive account deletion)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.free_trial_claims (
    identity_key TEXT PRIMARY KEY,
    first_profile_id UUID NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_trial_claims_profile ON public.free_trial_claims(first_profile_id);

ALTER TABLE public.free_trial_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "free_trial_claims_deny_authenticated" ON public.free_trial_claims
    FOR ALL TO authenticated
    USING (FALSE)
    WITH CHECK (FALSE);

COMMENT ON TABLE public.free_trial_claims IS
    'First student profile to claim a normalized email/phone gets the platform free trial; later signups with the same identity get subscriptions.expired instead.';

-- ============================================================
-- Normalize email for deduplication (Gmail / Googlemail local-part rules)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_trial_email(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    e TEXT;
    at_pos INT;
    local_part TEXT;
    domain TEXT;
BEGIN
    IF p_raw IS NULL THEN
        RETURN NULL;
    END IF;
    e := lower(btrim(p_raw));
    IF e = '' THEN
        RETURN NULL;
    END IF;
    at_pos := position('@' IN e);
    IF at_pos < 2 THEN
        RETURN e;
    END IF;
    local_part := substring(e FROM 1 FOR at_pos - 1);
    domain := substring(e FROM at_pos + 1);
    local_part := split_part(local_part, '+', 1);
    IF domain IN ('gmail.com', 'googlemail.com') THEN
        local_part := replace(local_part, '.', '');
    END IF;
    RETURN local_part || '@' || domain;
END;
$$;

-- ============================================================
-- Normalize phone: digits only, prefixed for key stability
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_trial_phone(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_raw IS NULL OR btrim(p_raw) = '' THEN NULL
        ELSE 'phone:' || regexp_replace(btrim(p_raw), '\D', '', 'g')
    END;
$$;

-- ============================================================
-- Resolve a single dedupe key: prefer email, else phone
-- ============================================================
CREATE OR REPLACE FUNCTION public.trial_identity_key_from_auth(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_email TEXT;
    v_phone TEXT;
BEGIN
    SELECT u.email::TEXT, u.phone::TEXT
    INTO v_email, v_phone
    FROM auth.users u
    WHERE u.id = p_user_id;

    IF v_email IS NOT NULL AND btrim(v_email) <> '' THEN
        RETURN public.normalize_trial_email(v_email);
    END IF;
    IF v_phone IS NOT NULL AND btrim(v_phone) <> '' THEN
        RETURN public.normalize_trial_phone(v_phone);
    END IF;
    RETURN NULL;
END;
$$;

-- ============================================================
-- PROFILE TRIGGER: seed trial or expired stub
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
    v_key TEXT;
    v_existing_owner UUID;
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

    v_key := public.trial_identity_key_from_auth(NEW.id);

    -- No email/phone on auth user: cannot dedupe across accounts; grant trial without a claim row.
    IF v_key IS NULL THEN
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
    END IF;

    -- Serialize claim attempts per identity (namespace int avoids collisions with other advisory users).
    PERFORM pg_advisory_xact_lock(872014, hashtext(v_key));

    SELECT c.first_profile_id
    INTO v_existing_owner
    FROM public.free_trial_claims c
    WHERE c.identity_key = v_key;

    IF v_existing_owner IS NOT NULL AND v_existing_owner <> NEW.id THEN
        INSERT INTO public.subscriptions (
            profile_id, plan_code, status, trial_ends_at,
            current_period_start, current_period_end, metadata
        ) VALUES (
            NEW.id,
            'free',
            'expired',
            NULL,
            NOW(),
            NOW(),
            jsonb_build_object('trial_blocked', 'duplicate_identity')
        );
        RETURN NEW;
    END IF;

    BEGIN
        INSERT INTO public.free_trial_claims (identity_key, first_profile_id)
        VALUES (v_key, NEW.id);
    EXCEPTION
        WHEN unique_violation THEN
            SELECT c.first_profile_id INTO v_existing_owner
            FROM public.free_trial_claims c
            WHERE c.identity_key = v_key;
            IF v_existing_owner IS NOT NULL AND v_existing_owner <> NEW.id THEN
                INSERT INTO public.subscriptions (
                    profile_id, plan_code, status, trial_ends_at,
                    current_period_start, current_period_end, metadata
                ) VALUES (
                    NEW.id,
                    'free',
                    'expired',
                    NULL,
                    NOW(),
                    NOW(),
                    jsonb_build_object('trial_blocked', 'duplicate_identity')
                );
                RETURN NEW;
            END IF;
            RAISE;
    END;

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

-- ============================================================
-- Backfill claims for existing students (earliest profile per identity wins)
-- ============================================================
INSERT INTO public.free_trial_claims (identity_key, first_profile_id, claimed_at)
SELECT t.identity_key, t.first_profile_id, t.claimed_at
FROM (
    SELECT
        public.trial_identity_key_from_auth(p.id) AS identity_key,
        p.id AS first_profile_id,
        COALESCE(s.created_at, NOW()) AS claimed_at,
        row_number() OVER (
            PARTITION BY public.trial_identity_key_from_auth(p.id)
            ORDER BY p.created_at ASC NULLS LAST, p.id ASC
        ) AS rn
    FROM public.profiles p
    INNER JOIN public.subscriptions s ON s.profile_id = p.id
    WHERE p.role = 'student'
      AND public.trial_identity_key_from_auth(p.id) IS NOT NULL
) t
WHERE t.rn = 1
ON CONFLICT (identity_key) DO NOTHING;

-- Students who already had a trialing free row but are not the winning profile for their identity
UPDATE public.subscriptions s
SET
    status = 'expired',
    trial_ends_at = NULL,
    current_period_start = NOW(),
    current_period_end = NOW(),
    metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object('trial_blocked', 'duplicate_identity_backfill'),
    updated_at = NOW()
FROM public.profiles p
CROSS JOIN LATERAL (SELECT public.trial_identity_key_from_auth(p.id) AS k) x
INNER JOIN public.free_trial_claims c ON c.identity_key = x.k AND c.first_profile_id <> p.id
WHERE s.profile_id = p.id
  AND p.role = 'student'
  AND x.k IS NOT NULL
  AND s.plan_code = 'free'
  AND s.status = 'trialing';

COMMIT;
