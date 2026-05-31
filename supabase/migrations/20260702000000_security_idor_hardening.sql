-- Security hardening: function-level authorization on SECURITY DEFINER RPCs
-- that are GRANTed to `authenticated` and trust a caller-supplied id.
--
-- Supabase exposes every function granted to `authenticated` directly via
-- PostgREST (`POST /rest/v1/rpc/<fn>`), reachable with any logged-in user's
-- JWT + the public anon key. Several definer RPCs took a `p_student_id` /
-- `p_test_id` / `p_teacher_id` and acted on it WITHOUT confirming it belonged
-- to the caller, so the Next.js route guards could be bypassed entirely.
--
-- Each change below is behavior-preserving for legitimate callers (verified by
-- tracing every call site): the in-app paths pass the session user's own id on
-- an RLS client, and the background workers run as `service_role`
-- (auth.uid() = NULL, auth.role() = 'service_role'). RLS policy helpers pass
-- `auth.uid()`. Only direct cross-user PostgREST calls change behavior.
--
-- Apply identically to BOTH Supabase projects (primary + secondary) per the
-- two-project rule; `check-migration-drift` will flag it as unapplied until then.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. refresh_student_activity_streak — was: SECURITY DEFINER + GRANT TO
--    authenticated with only a NULL check. An authenticated user could call
--    it with any p_student_id, rewriting that student's streak cache and
--    triggering billing_grant_streak_52_week_reward_atomic on their account.
--    Mirror the ownership guard already present in
--    student_activity_streak_snapshot. service_role / cron pass through
--    (auth.uid() IS NULL); the submit flow passes the session user's own id.
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

	-- IDOR guard: an authenticated caller may only refresh their own streak.
	IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_student_id THEN
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
-- 2. compute_student_activity_streak — definer aggregate over another
--    student's tests. No app code calls it directly; it is only invoked from
--    inside refresh_student_activity_streak and student_activity_streak_snapshot
--    (both SECURITY DEFINER, executing as the owner, which retains EXECUTE).
--    Remove the direct authenticated PostgREST entry point; keep service_role.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.compute_student_activity_streak(UUID) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. practice_enqueue_job — definer + GRANT TO authenticated; derived
--    student_id from the test but never checked the caller, so an
--    authenticated user could enqueue grade/pdf/email jobs for any test_id.
--    Workers/regrade/auto-submit run as service_role (allowed); an
--    authenticated caller may only enqueue for a test they own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.practice_enqueue_job(
	p_job_type TEXT,
	p_test_id UUID,
	p_payload JSONB DEFAULT '{}'::jsonb,
	p_run_after TIMESTAMP DEFAULT NOW()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_test_owner UUID;
	v_job_id UUID;
BEGIN
	IF p_job_type NOT IN ('grade', 'pdf', 'auto_submit', 'email', 'tracker_update') THEN
		RAISE EXCEPTION 'Invalid job_type %', p_job_type;
	END IF;

	SELECT student_id INTO v_test_owner FROM public.tests WHERE id = p_test_id;
	IF v_test_owner IS NULL THEN
		RAISE EXCEPTION 'Test % does not exist', p_test_id;
	END IF;

	-- IDOR guard: service_role (workers) is allowed; an authenticated caller
	-- may only enqueue jobs for a test they own.
	IF auth.role() <> 'service_role'
		AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM v_test_owner) THEN
		RAISE EXCEPTION 'Not authorized to enqueue a job for this test'
			USING ERRCODE = '42501';
	END IF;

	INSERT INTO public.practice_jobs (
		job_type, test_id, student_id, payload, run_after
	) VALUES (
		p_job_type, p_test_id, v_test_owner, COALESCE(p_payload, '{}'::jsonb), p_run_after
	)
	RETURNING id INTO v_job_id;

	RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION public.practice_enqueue_job(TEXT, UUID, JSONB, TIMESTAMP) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Teacher relationship/identity helpers. These are used inside RLS policy
--    USING clauses (which pass auth.uid()) and by the service_role assigned-
--    test generator (which passes the assignment's teacher id). They CANNOT be
--    revoked from authenticated (RLS evaluation runs as the querying user and
--    needs EXECUTE). Instead, bind the parameter to the session ONLY when the
--    caller is the authenticated role calling directly:
--        (auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
--    - RLS / app callers pass auth.uid() → term is true → unchanged.
--    - service_role worker → role is not 'authenticated' → term is true → unchanged.
--    - direct authenticated call with a foreign teacher id → false/empty result.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_verified_teacher(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT
		(auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND EXISTS (
			SELECT 1
			FROM public.profiles p
			WHERE p.id = p_teacher_id
				AND p.role = 'teacher'
				AND COALESCE(p.is_verified, FALSE) = TRUE
				AND COALESCE(p.is_suspended, FALSE) = FALSE
				AND p.deleted_at IS NULL
		);
$$;

CREATE OR REPLACE FUNCTION public.teacher_has_active_organization(p_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT
		(auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND EXISTS (
			SELECT 1
			FROM public.teacher_organization_memberships tom
			JOIN public.organizations o ON o.id = tom.organization_id
			WHERE tom.teacher_id = p_teacher_id
				AND tom.status = 'active'
				AND o.is_active = TRUE
				AND o.deleted_at IS NULL
		);
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_student(p_teacher_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	SELECT
		(auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND public.auth_is_verified_teacher(p_teacher_id)
		AND EXISTS (
			SELECT 1
			FROM public.profiles s
			WHERE s.id = p_student_id
				AND s.role = 'student'
				AND s.deleted_at IS NULL
				AND (
					(
						s.organization_id IS NOT NULL
						AND EXISTS (
							SELECT 1
							FROM public.teacher_organization_memberships tom
							JOIN public.organizations o ON o.id = tom.organization_id
							WHERE tom.teacher_id = p_teacher_id
								AND tom.organization_id = s.organization_id
								AND tom.status = 'active'
								AND o.is_active = TRUE
								AND o.deleted_at IS NULL
						)
					)
					OR EXISTS (
						SELECT 1
						FROM public.teacher_student_links tsl
						WHERE tsl.teacher_id = p_teacher_id
							AND tsl.student_id = p_student_id
							AND tsl.status = 'active'
					)
				)
		);
$$;

CREATE OR REPLACE FUNCTION public.teacher_filter_accessible_student_ids(
	p_teacher_id uuid,
	p_student_ids uuid[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
	WITH requested AS (
		SELECT DISTINCT sid
		FROM unnest(p_student_ids) AS sid
	)
	SELECT COALESCE(array_agg(s.id ORDER BY s.id), ARRAY[]::uuid[])
	FROM requested r
	JOIN public.profiles s ON s.id = r.sid
	WHERE (auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() = p_teacher_id)
		AND public.auth_is_verified_teacher(p_teacher_id)
		AND s.role = 'student'
		AND s.deleted_at IS NULL
		AND (
			(
				s.organization_id IS NOT NULL
				AND EXISTS (
					SELECT 1
					FROM public.teacher_organization_memberships tom
					JOIN public.organizations o ON o.id = tom.organization_id
					WHERE tom.teacher_id = p_teacher_id
						AND tom.organization_id = s.organization_id
						AND tom.status = 'active'
						AND o.is_active = TRUE
						AND o.deleted_at IS NULL
				)
			)
			OR EXISTS (
				SELECT 1
				FROM public.teacher_student_links tsl
				WHERE tsl.teacher_id = p_teacher_id
					AND tsl.student_id = s.id
					AND tsl.status = 'active'
			)
		);
$$;

REVOKE ALL ON FUNCTION public.auth_is_verified_teacher(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_has_active_organization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_can_access_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_filter_accessible_student_ids(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_verified_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_has_active_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_filter_accessible_student_ids(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. practice_update_tracker_running — already rejects cross-student callers
--    (v_caller <> p_student_id), but never bound p_current_test_id to the
--    student, so a direct caller could write a tracker row pointing at a test
--    they don't own. Add a minimal ownership check; all legitimate callers
--    (inline grading, worker, admin reinit) pass a real test owned by the
--    student. Scoring logic is unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.practice_update_tracker_running(p_student_id uuid, p_subject_id uuid, p_topic_id uuid, p_current_test_id uuid, p_current_test_score numeric, p_current_n_incorrect integer, p_now timestamp without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_caller UUID := auth.uid();
	v_existing_tests_taken INT;
	v_existing_id UUID;
	v_avg NUMERIC;
	v_last_two NUMERIC;
	v_prev_three NUMERIC;
	v_trend TEXT := 'stable';
	v_status TEXT;
BEGIN
	IF v_caller IS NOT NULL AND v_caller <> p_student_id THEN
		RAISE EXCEPTION 'Caller does not match student';
	END IF;

	-- Integrity: the referenced test must belong to the student so a tracker
	-- row cannot be written against a test the caller does not own.
	IF p_current_test_id IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM public.tests
		WHERE id = p_current_test_id AND student_id = p_student_id
	) THEN
		RAISE EXCEPTION 'test does not belong to student'
			USING ERRCODE = '42501';
	END IF;

	WITH previous_topic_tests AS (
		SELECT t.test_date, AVG(sa.score_earned::numeric) AS test_score
		FROM public.tests t
		JOIN public.student_answers sa ON sa.test_id = t.id
		JOIN public.questions q ON q.id = sa.question_id
		WHERE t.student_id = p_student_id
		  AND q.topic_id = p_topic_id
		  AND sa.score_earned IS NOT NULL
		  AND t.status IN ('graded', 'grading')
		  AND t.id <> p_current_test_id
		GROUP BY t.id, t.test_date
		ORDER BY t.test_date DESC
		LIMIT 10
	),
	series AS (
		SELECT p_current_test_score::numeric AS test_score, p_now AS test_date
		UNION ALL
		SELECT test_score, test_date FROM previous_topic_tests
	),
	ranked AS (
		SELECT test_score,
		       ROW_NUMBER() OVER (ORDER BY test_date DESC) AS rn
		FROM series
	)
	SELECT
		AVG(test_score) FILTER (WHERE rn <= 5),
		AVG(test_score) FILTER (WHERE rn <= 2),
		AVG(test_score) FILTER (WHERE rn BETWEEN 3 AND 5)
	INTO v_avg, v_last_two, v_prev_three
	FROM ranked;

	IF v_last_two IS NOT NULL AND v_prev_three IS NOT NULL THEN
		IF v_last_two - v_prev_three > 5 THEN
			v_trend := 'improving';
		ELSIF v_prev_three - v_last_two > 5 THEN
			v_trend := 'declining';
		END IF;
	END IF;

	v_status := CASE
		WHEN v_avg IS NULL THEN 'not_tested'
		WHEN v_avg >= 75 AND COALESCE(p_current_n_incorrect, 0) = 0 THEN 'good'
		WHEN v_avg >= 75 THEN 'satisfactory'
		WHEN v_avg >= 50 THEN 'satisfactory'
		ELSE 'bad'
	END;

	SELECT id, tests_taken
	INTO v_existing_id, v_existing_tests_taken
	FROM public.performance_tracker
	WHERE student_id = p_student_id AND topic_id = p_topic_id
	LIMIT 1;

	IF v_existing_id IS NOT NULL THEN
		UPDATE public.performance_tracker
		SET average_score = ROUND(v_avg::numeric, 2),
		    status = v_status,
		    trend = v_trend,
		    last_test_id = p_current_test_id,
		    last_test_date = p_now,
		    tests_taken = COALESCE(v_existing_tests_taken, 0) + 1,
		    updated_at = p_now
		WHERE id = v_existing_id;
	ELSE
		INSERT INTO public.performance_tracker (
			student_id, topic_id, subject_id,
			average_score, status, trend,
			last_test_id, last_test_date, tests_taken,
			created_at, updated_at
		) VALUES (
			p_student_id, p_topic_id, p_subject_id,
			ROUND(v_avg::numeric, 2), v_status, v_trend,
			p_current_test_id, p_now, 1,
			p_now, p_now
		);
	END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.practice_update_tracker_running(uuid, uuid, uuid, uuid, numeric, integer, timestamp without time zone) TO authenticated;

COMMIT;
