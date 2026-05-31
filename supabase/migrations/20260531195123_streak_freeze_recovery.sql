-- Gentle streak freeze + effort-based recovery.
--
-- NOTE: this migration was applied to BOTH Supabase projects via MCP before being
-- captured here, so the remote ledger versions differ slightly per project
-- (EDU_AI/suwakggcbxmmvqzeudmq = 20260531195123; canary/ezxmjkvhrlqeimhnfvfd =
-- 20260531194854). Run `pnpm db:reconcile-migration-ledger` if the drift check
-- flags the version offset. The statements below are idempotent
-- (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE), so re-applying is safe.
--
-- Design: persist the set of bridged (missed) weeks; compute the streak via
-- gaps-and-islands over (real active weeks UNION bridged weeks) so bridges survive
-- the existing full-recompute model. A single missed week at the boundary consumes
-- a freeze; the freeze is re-earned after >=4 active weeks past the bridge. Frozen
-- weeks count toward the 52-week reward. Gated by `streak_freeze_enabled()`.

ALTER TABLE public.student_activity_streaks
	ADD COLUMN IF NOT EXISTS bridged_weeks date[] NOT NULL DEFAULT '{}',
	ADD COLUMN IF NOT EXISTS freezes_available integer NOT NULL DEFAULT 1,
	ADD COLUMN IF NOT EXISTS freeze_last_used_week date;

-- Kill-switch / staged-rollout gate. Flip with CREATE OR REPLACE returning false.
CREATE OR REPLACE FUNCTION public.streak_freeze_enabled()
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_catalog'
AS $$ SELECT true $$;

-- Streak computation over real active weeks UNION caller-supplied bridged weeks.
CREATE OR REPLACE FUNCTION public.compute_student_activity_streak_bridged(p_student_id uuid, p_bridged date[])
RETURNS TABLE(streak_weeks integer, current_week_active boolean, last_active_week_start date, longest_streak_weeks integer, last_real_week_start date)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
	WITH real_weeks AS (
		SELECT DISTINCT (date_trunc('week', t.test_date AT TIME ZONE 'UTC'))::date AS week_start
		FROM public.tests t
		WHERE t.student_id = p_student_id
			AND t.test_date IS NOT NULL
			AND t.status IN ('grading', 'graded', 'submitted')
	),
	bridged AS (
		SELECT DISTINCT b::date AS week_start FROM unnest(COALESCE(p_bridged, '{}'::date[])) AS b
	),
	active_weeks AS (
		SELECT week_start FROM real_weeks
		UNION
		SELECT week_start FROM bridged
	),
	current_week AS (
		SELECT (date_trunc('week', NOW() AT TIME ZONE 'UTC'))::date AS week_start
	),
	numbered AS (
		SELECT aw.week_start,
			aw.week_start - ((ROW_NUMBER() OVER (ORDER BY aw.week_start ASC) - 1) * INTERVAL '7 days') AS streak_group
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
			AND n.streak_group = (SELECT n2.streak_group FROM numbered n2 WHERE n2.week_start = lw.week_start)
	),
	longest AS (
		SELECT COALESCE(MAX(cnt), 0)::integer AS longest_streak_weeks
		FROM (SELECT COUNT(*)::integer AS cnt FROM numbered GROUP BY streak_group) g
	)
	SELECT
		COALESCE((SELECT cs.streak_weeks FROM current_streak cs), 0) AS streak_weeks,
		EXISTS (
			SELECT 1 FROM real_weeks rw CROSS JOIN current_week cw WHERE rw.week_start = cw.week_start
		) AS current_week_active,
		(SELECT MAX(week_start) FROM active_weeks) AS last_active_week_start,
		(SELECT l.longest_streak_weeks FROM longest l) AS longest_streak_weeks,
		(SELECT MAX(week_start) FROM real_weeks) AS last_real_week_start;
$function$;

-- Freeze-aware refresh: decides whether to bridge a single missed week, then
-- recomputes the effective streak and derives freeze availability (recovery).
CREATE OR REPLACE FUNCTION public.refresh_student_activity_streak(p_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_prev_last_real DATE;
	v_bridged DATE[];
	v_freezes INTEGER;
	v_real_last DATE;
	v_missed INTEGER;
	v_candidate DATE;
	v_flag BOOLEAN;
	c_streak INTEGER;
	c_current BOOLEAN;
	c_last DATE;
	c_longest INTEGER;
	c_last_real DATE;
	v_last_bridge DATE;
	v_run_start DATE;
	v_new_freezes INTEGER;
BEGIN
	IF p_student_id IS NULL THEN RETURN; END IF;
	IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_student_id THEN RETURN; END IF;

	v_flag := public.streak_freeze_enabled();

	SELECT s.last_active_week_start, COALESCE(s.bridged_weeks, '{}'::date[]), COALESCE(s.freezes_available, 1)
	INTO v_prev_last_real, v_bridged, v_freezes
	FROM public.student_activity_streaks s
	WHERE s.student_id = p_student_id;

	IF v_bridged IS NULL THEN v_bridged := '{}'::date[]; END IF;
	IF v_freezes IS NULL THEN v_freezes := 1; END IF;

	SELECT MAX((date_trunc('week', t.test_date AT TIME ZONE 'UTC'))::date)
	INTO v_real_last
	FROM public.tests t
	WHERE t.student_id = p_student_id
		AND t.test_date IS NOT NULL
		AND t.status IN ('grading', 'graded', 'submitted');

	-- Bridge exactly one missed week at the boundary when a freeze is available.
	IF v_flag AND v_prev_last_real IS NOT NULL AND v_real_last IS NOT NULL AND v_real_last > v_prev_last_real THEN
		v_missed := ((v_real_last - v_prev_last_real) / 7) - 1;
		IF v_missed = 1 AND v_freezes >= 1 THEN
			v_candidate := v_prev_last_real + 7;
			IF NOT (v_candidate = ANY(v_bridged)) THEN
				v_bridged := array_append(v_bridged, v_candidate);
			END IF;
		END IF;
	END IF;

	SELECT b.streak_weeks, b.current_week_active, b.last_active_week_start, b.longest_streak_weeks, b.last_real_week_start
	INTO c_streak, c_current, c_last, c_longest, c_last_real
	FROM public.compute_student_activity_streak_bridged(p_student_id, v_bridged) b;

	-- Recovery: derive freeze availability from persisted state (stable under recompute).
	v_last_bridge := (SELECT MAX(x) FROM unnest(v_bridged) AS x);
	v_run_start := c_last - ((GREATEST(c_streak, 1) - 1) * 7);

	IF NOT v_flag THEN
		v_new_freezes := v_freezes;
	ELSIF v_last_bridge IS NULL THEN
		v_new_freezes := 1;
	ELSIF v_last_bridge < v_run_start THEN
		v_new_freezes := 1; -- bridge is in an old (reset) run; grant a fresh freeze
	ELSIF (COALESCE(c_last_real, v_last_bridge) - v_last_bridge) >= 28 THEN
		v_new_freezes := 1; -- >=4 active weeks since the bridge; re-earned
	ELSE
		v_new_freezes := 0; -- freeze currently spent
	END IF;

	INSERT INTO public.student_activity_streaks (
		student_id, streak_weeks, current_week_active, last_active_week_start,
		longest_streak_weeks, bridged_weeks, freezes_available, freeze_last_used_week, updated_at
	)
	VALUES (
		p_student_id, c_streak, c_current, c_last_real,
		c_longest, v_bridged, v_new_freezes, v_last_bridge, NOW()
	)
	ON CONFLICT (student_id) DO UPDATE SET
		streak_weeks = EXCLUDED.streak_weeks,
		current_week_active = EXCLUDED.current_week_active,
		last_active_week_start = EXCLUDED.last_active_week_start,
		longest_streak_weeks = GREATEST(public.student_activity_streaks.longest_streak_weeks, EXCLUDED.longest_streak_weeks),
		bridged_weeks = EXCLUDED.bridged_weeks,
		freezes_available = EXCLUDED.freezes_available,
		freeze_last_used_week = EXCLUDED.freeze_last_used_week,
		updated_at = NOW();

	IF c_streak >= 52 THEN
		PERFORM public.billing_grant_streak_52_week_reward_atomic(p_student_id);
	END IF;
END;
$function$;

-- Extend the snapshot to expose freeze state (requires DROP: return shape changes).
DROP FUNCTION IF EXISTS public.student_activity_streak_snapshot(uuid);
CREATE FUNCTION public.student_activity_streak_snapshot(p_student_id uuid)
RETURNS TABLE(streak_weeks integer, current_week_active boolean, last_active_week_start date, longest_streak_weeks integer, weeks_to_reward integer, reward_granted boolean, reward_granted_at timestamp with time zone, freezes_available integer, freeze_last_used_week date)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_row public.student_activity_streaks%ROWTYPE;
	v_streak INTEGER := 0;
	v_current_week_active BOOLEAN := FALSE;
	v_last_week DATE;
	v_longest INTEGER := 0;
	v_reward_granted_at TIMESTAMPTZ;
	v_freezes INTEGER := 1;
	v_freeze_used DATE;
BEGIN
	IF p_student_id IS NULL THEN RETURN; END IF;
	IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_student_id THEN RETURN; END IF;

	SELECT * INTO v_row FROM public.student_activity_streaks s WHERE s.student_id = p_student_id;

	IF NOT FOUND THEN
		SELECT c.streak_weeks, c.current_week_active, c.last_active_week_start, c.longest_streak_weeks
		INTO v_streak, v_current_week_active, v_last_week, v_longest
		FROM public.compute_student_activity_streak(p_student_id) c;
		v_reward_granted_at := NULL;
		v_freezes := 1;
		v_freeze_used := NULL;
	ELSE
		v_streak := v_row.streak_weeks;
		v_current_week_active := v_row.current_week_active;
		v_last_week := v_row.last_active_week_start;
		v_longest := v_row.longest_streak_weeks;
		v_reward_granted_at := v_row.reward_granted_at;
		v_freezes := COALESCE(v_row.freezes_available, 1);
		v_freeze_used := v_row.freeze_last_used_week;
	END IF;

	RETURN QUERY SELECT
		v_streak,
		v_current_week_active,
		v_last_week,
		v_longest,
		GREATEST(0, 52 - v_streak)::integer AS weeks_to_reward,
		(v_reward_granted_at IS NOT NULL) AS reward_granted,
		v_reward_granted_at,
		v_freezes,
		v_freeze_used;
END;
$function$;
