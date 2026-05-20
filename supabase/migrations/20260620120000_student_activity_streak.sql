-- Weekly activity streak: at least one submitted practice/assignment test per ISO week.
-- 52 consecutive weeks grants one year of Pro (pro_annual quotas, 365-day period).

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_activity_streaks (
	student_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	streak_weeks INTEGER NOT NULL DEFAULT 0 CHECK (streak_weeks >= 0),
	current_week_active BOOLEAN NOT NULL DEFAULT FALSE,
	last_active_week_start DATE,
	longest_streak_weeks INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak_weeks >= 0),
	reward_granted_at TIMESTAMPTZ,
	reward_streak_weeks INTEGER CHECK (reward_streak_weeks IS NULL OR reward_streak_weeks >= 52),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_activity_streaks IS
	'Cached weekly practice streak per student; refreshed on test submit and read by the top-bar widget.';

ALTER TABLE public.student_activity_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_activity_streaks_select_own ON public.student_activity_streaks;
CREATE POLICY student_activity_streaks_select_own
	ON public.student_activity_streaks
	FOR SELECT
	TO authenticated
	USING (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Compute streak from submitted tests (practice + assignments; mock tests later)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_student_activity_streak(p_student_id UUID)
RETURNS TABLE(
	streak_weeks INTEGER,
	current_week_active BOOLEAN,
	last_active_week_start DATE,
	longest_streak_weeks INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
	WITH active_weeks AS (
		SELECT DISTINCT (date_trunc('week', t.test_date AT TIME ZONE 'UTC'))::date AS week_start
		FROM public.tests t
		WHERE t.student_id = p_student_id
			AND t.test_date IS NOT NULL
			AND t.status IN ('grading', 'graded', 'submitted')
	),
	current_week AS (
		SELECT (date_trunc('week', NOW() AT TIME ZONE 'UTC'))::date AS week_start
	),
	numbered AS (
		SELECT
			aw.week_start,
			aw.week_start
				- ((ROW_NUMBER() OVER (ORDER BY aw.week_start ASC) - 1) * INTERVAL '7 days') AS streak_group
		FROM active_weeks aw
	),
	latest_week AS (
		SELECT MAX(week_start) AS week_start FROM active_weeks
	),
	current_streak AS (
		SELECT COUNT(*)::integer AS streak_weeks
		FROM numbered n
		CROSS JOIN latest_week lw
		WHERE lw.week_start IS NOT NULL
			AND n.streak_group = (
				SELECT n2.streak_group
				FROM numbered n2
				WHERE n2.week_start = lw.week_start
			)
	),
	longest AS (
		SELECT COALESCE(MAX(cnt), 0)::integer AS longest_streak_weeks
		FROM (
			SELECT COUNT(*)::integer AS cnt
			FROM numbered
			GROUP BY streak_group
		) g
	)
	SELECT
		COALESCE((SELECT cs.streak_weeks FROM current_streak cs), 0) AS streak_weeks,
		EXISTS (
			SELECT 1
			FROM active_weeks aw
			CROSS JOIN current_week cw
			WHERE aw.week_start = cw.week_start
		) AS current_week_active,
		(SELECT MAX(week_start) FROM active_weeks) AS last_active_week_start,
		(SELECT l.longest_streak_weeks FROM longest l) AS longest_streak_weeks;
$$;

REVOKE ALL ON FUNCTION public.compute_student_activity_streak(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_student_activity_streak(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grant one year Pro when 52-week streak is reached (once per student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.billing_grant_streak_52_week_reward_atomic(p_profile_id UUID)
RETURNS TABLE(ok BOOLEAN, error_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
DECLARE
	v_now TIMESTAMPTZ := NOW();
	v_streak INTEGER;
	v_reward_at TIMESTAMPTZ;
	v_sub_id UUID;
	v_sub_status VARCHAR(20);
	v_plan RECORD;
	v_anchor TIMESTAMPTZ;
	v_new_end TIMESTAMPTZ;
	v_extend_days INTEGER := 365;
	v_grade INTEGER;
	v_token_quota INTEGER;
BEGIN
	IF p_profile_id IS NULL THEN
		RETURN QUERY SELECT FALSE, 'invalid_input';
		RETURN;
	END IF;

	SELECT s.streak_weeks, s.reward_granted_at
	INTO v_streak, v_reward_at
	FROM public.student_activity_streaks s
	WHERE s.student_id = p_profile_id
	FOR UPDATE;

	IF NOT FOUND OR v_streak IS NULL OR v_streak < 52 THEN
		RETURN QUERY SELECT FALSE, 'streak_not_eligible';
		RETURN;
	END IF;

	IF v_reward_at IS NOT NULL THEN
		RETURN QUERY SELECT TRUE, 'already_granted';
		RETURN;
	END IF;

	SELECT
		pl.code,
		pl.tests_per_period,
		pl.tokens_grade_6_10,
		pl.tokens_grade_11_12
	INTO v_plan
	FROM public.plans pl
	WHERE pl.code = 'pro_annual'
	LIMIT 1;

	IF NOT FOUND THEN
		RETURN QUERY SELECT FALSE, 'plan_missing';
		RETURN;
	END IF;

	SELECT pr.grade INTO v_grade
	FROM public.profiles pr
	WHERE pr.id = p_profile_id;

	v_token_quota :=
		CASE
			WHEN v_grade IS NOT NULL AND v_grade >= 11 AND v_grade <= 12 THEN v_plan.tokens_grade_11_12
			ELSE v_plan.tokens_grade_6_10
		END;

	SELECT s.id, s.status, s.current_period_end
	INTO v_sub_id, v_sub_status, v_anchor
	FROM public.subscriptions s
	WHERE s.profile_id = p_profile_id
	FOR UPDATE;

	IF v_sub_id IS NULL THEN
		v_anchor := v_now;
		v_new_end := v_now + make_interval(days => v_extend_days);
		INSERT INTO public.subscriptions (
			profile_id,
			plan_code,
			status,
			current_period_start,
			current_period_end
		)
		VALUES (
			p_profile_id,
			'pro_annual',
			'coupon',
			v_now,
			v_new_end
		)
		RETURNING id INTO v_sub_id;
	ELSIF v_sub_status IN ('active', 'grace', 'past_due') THEN
		v_anchor := GREATEST(v_anchor, v_now);
		v_new_end := v_anchor + make_interval(days => v_extend_days);
		UPDATE public.subscriptions
		SET
			current_period_end = v_new_end,
			cancel_at_period_end = FALSE,
			updated_at = v_now
		WHERE id = v_sub_id;
	ELSE
		v_anchor := v_now;
		v_new_end := v_now + make_interval(days => v_extend_days);
		UPDATE public.subscriptions
		SET
			plan_code = 'pro_annual',
			status = 'coupon',
			current_period_start = v_now,
			current_period_end = v_new_end,
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
		v_new_end,
		v_plan.tests_per_period,
		0,
		v_token_quota,
		0
	)
	ON CONFLICT ON CONSTRAINT usage_periods_sub_start_unique DO UPDATE
	SET
		period_end = EXCLUDED.period_end,
		tests_quota = EXCLUDED.tests_quota,
		tests_used = 0,
		tokens_quota = EXCLUDED.tokens_quota,
		tokens_used = 0;

	UPDATE public.student_activity_streaks
	SET
		reward_granted_at = v_now,
		reward_streak_weeks = v_streak,
		updated_at = v_now
	WHERE student_id = p_profile_id;

	RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_grant_streak_52_week_reward_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_grant_streak_52_week_reward_atomic(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Refresh cache + attempt 52-week reward (idempotent per student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_student_activity_streak(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
DECLARE
	v_streak INTEGER;
	v_current_week_active BOOLEAN;
	v_last_week DATE;
	v_longest INTEGER;
BEGIN
	IF p_student_id IS NULL THEN
		RETURN;
	END IF;

	SELECT c.streak_weeks, c.current_week_active, c.last_active_week_start, c.longest_streak_weeks
	INTO v_streak, v_current_week_active, v_last_week, v_longest
	FROM public.compute_student_activity_streak(p_student_id) c;

	INSERT INTO public.student_activity_streaks (
		student_id,
		streak_weeks,
		current_week_active,
		last_active_week_start,
		longest_streak_weeks,
		updated_at
	)
	VALUES (
		p_student_id,
		v_streak,
		v_current_week_active,
		v_last_week,
		v_longest,
		NOW()
	)
	ON CONFLICT (student_id) DO UPDATE
	SET
		streak_weeks = EXCLUDED.streak_weeks,
		current_week_active = EXCLUDED.current_week_active,
		last_active_week_start = EXCLUDED.last_active_week_start,
		longest_streak_weeks = GREATEST(
			public.student_activity_streaks.longest_streak_weeks,
			EXCLUDED.longest_streak_weeks
		),
		updated_at = NOW();

	IF v_streak >= 52 THEN
		PERFORM public.billing_grant_streak_52_week_reward_atomic(p_student_id);
	END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_student_activity_streak(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_student_activity_streak(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Snapshot for UI (reads cache, falls back to live compute)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_activity_streak_snapshot(p_student_id UUID)
RETURNS TABLE(
	streak_weeks INTEGER,
	current_week_active BOOLEAN,
	last_active_week_start DATE,
	longest_streak_weeks INTEGER,
	weeks_to_reward INTEGER,
	reward_granted BOOLEAN,
	reward_granted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
	DECLARE
	v_row public.student_activity_streaks%ROWTYPE;
	v_streak INTEGER := 0;
	v_current_week_active BOOLEAN := FALSE;
	v_last_week DATE;
	v_longest INTEGER := 0;
	v_reward_granted_at TIMESTAMPTZ;
BEGIN
	IF p_student_id IS NULL THEN
		RETURN;
	END IF;

	IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_student_id THEN
		RETURN;
	END IF;

	SELECT * INTO v_row
	FROM public.student_activity_streaks s
	WHERE s.student_id = p_student_id;

	IF NOT FOUND THEN
		SELECT c.streak_weeks, c.current_week_active, c.last_active_week_start, c.longest_streak_weeks
		INTO v_streak, v_current_week_active, v_last_week, v_longest
		FROM public.compute_student_activity_streak(p_student_id) c;
		v_reward_granted_at := NULL;
	ELSE
		v_streak := v_row.streak_weeks;
		v_current_week_active := v_row.current_week_active;
		v_last_week := v_row.last_active_week_start;
		v_longest := v_row.longest_streak_weeks;
		v_reward_granted_at := v_row.reward_granted_at;
	END IF;

	RETURN QUERY
	SELECT
		v_streak,
		v_current_week_active,
		v_last_week,
		v_longest,
		GREATEST(0, 52 - v_streak)::integer AS weeks_to_reward,
		(v_reward_granted_at IS NOT NULL) AS reward_granted,
		v_reward_granted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.student_activity_streak_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_activity_streak_snapshot(UUID) TO authenticated, service_role;

COMMIT;
