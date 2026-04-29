-- Reclaim free-trial identity locks when the original claimant account no longer exists.
-- This keeps strict one-trial-per-identity while avoiding permanent lockouts after account deletion.

BEGIN;

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
	v_owner_is_stale BOOLEAN := FALSE;
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

	-- Serialize claim attempts per identity.
	PERFORM pg_advisory_xact_lock(872014, hashtext(v_key));

	SELECT c.first_profile_id
	INTO v_existing_owner
	FROM public.free_trial_claims c
	WHERE c.identity_key = v_key;

	IF v_existing_owner IS NOT NULL AND v_existing_owner <> NEW.id THEN
		SELECT NOT EXISTS (
			SELECT 1
			FROM auth.users u
			WHERE u.id = v_existing_owner
		) INTO v_owner_is_stale;

		IF v_owner_is_stale THEN
			UPDATE public.free_trial_claims
			SET first_profile_id = NEW.id,
			    claimed_at = NOW()
			WHERE identity_key = v_key;
			v_existing_owner := NEW.id;
		ELSE
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
				SELECT NOT EXISTS (
					SELECT 1
					FROM auth.users u
					WHERE u.id = v_existing_owner
				) INTO v_owner_is_stale;

				IF v_owner_is_stale THEN
					UPDATE public.free_trial_claims
					SET first_profile_id = NEW.id,
					    claimed_at = NOW()
					WHERE identity_key = v_key;
				ELSE
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
			ELSE
				RAISE;
			END IF;
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

-- Repair already blocked students whose duplicate-identity lock points to a deleted auth user.
WITH stale_claims AS (
	SELECT c.identity_key
	FROM public.free_trial_claims c
	LEFT JOIN auth.users u ON u.id = c.first_profile_id
	WHERE u.id IS NULL
),
candidate_students AS (
	SELECT
		p.id AS profile_id,
		public.trial_identity_key_from_auth(p.id) AS identity_key,
		p.grade
	FROM public.profiles p
	WHERE p.role = 'student'
),
claim_reassign AS (
	UPDATE public.free_trial_claims c
	SET first_profile_id = cs.profile_id,
	    claimed_at = NOW()
	FROM candidate_students cs
	WHERE c.identity_key = cs.identity_key
	  AND c.identity_key IN (SELECT identity_key FROM stale_claims)
	RETURNING c.identity_key, cs.profile_id, cs.grade
),
regranted AS (
	UPDATE public.subscriptions s
	SET status = 'trialing',
	    trial_ends_at = NOW() + INTERVAL '14 days',
	    current_period_start = NOW(),
	    current_period_end = NOW() + INTERVAL '14 days',
	    metadata = (COALESCE(s.metadata, '{}'::jsonb) - 'trial_blocked') || jsonb_build_object('trial_regranted', 'stale_claim_owner'),
	    updated_at = NOW()
	FROM claim_reassign cr
	WHERE s.profile_id = cr.profile_id
	  AND s.plan_code = 'free'
	  AND s.status = 'expired'
	  AND COALESCE(s.metadata->>'trial_blocked', '') = 'duplicate_identity'
	RETURNING s.id AS subscription_id, s.profile_id
)
INSERT INTO public.usage_periods (
	subscription_id, profile_id, period_start, period_end, tests_quota, tests_used, tokens_quota, tokens_used
)
SELECT
	r.subscription_id,
	r.profile_id,
	NOW(),
	NOW() + INTERVAL '14 days',
	pl.tests_per_period,
	0,
	CASE
		WHEN p.grade BETWEEN 11 AND 12 THEN pl.tokens_grade_11_12
		ELSE pl.tokens_grade_6_10
	END,
	0
FROM regranted r
JOIN public.profiles p ON p.id = r.profile_id
JOIN public.plans pl ON pl.code = 'free'
LEFT JOIN public.usage_periods up
	ON up.subscription_id = r.subscription_id
	AND up.period_start <= NOW()
	AND up.period_end > NOW()
WHERE up.id IS NULL;

COMMIT;
