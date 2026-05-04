-- Align public function bodies on dev (and any env behind main) with production (main).
-- pg_cron job names/schedules already matched; this migration only replaces RPC/trigger definitions.
-- Source: pg_get_functiondef from main (2026-05-04).

CREATE OR REPLACE FUNCTION public.assemble_and_insert(p_batch_key text, p_topic_id uuid, p_source_ref text, p_chunk_type text, p_metadata jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
    insert into topic_context_chunks (topic_id, content, source_ref, chunk_type, metadata)
    select p_topic_id,
           string_agg(content, '' order by part_num),
           p_source_ref, p_chunk_type, p_metadata
    from _import_staging where batch_key = p_batch_key;
    delete from _import_staging where batch_key = p_batch_key;
end;
$function$;

CREATE OR REPLACE FUNCTION public.billing_consume_test(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.billing_consume_tokens(p_profile_id uuid, p_tokens integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.practice_abandon_test(p_test_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_caller UUID := auth.uid();
BEGIN
	IF v_caller IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	UPDATE public.tests
	SET status = 'abandoned',
	    abandoned_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_test_id
	  AND student_id = v_caller
	  AND status = 'in_progress';

	RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_append_questions(p_test_id uuid, p_questions jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_caller UUID := auth.uid();
	v_student UUID;
	v_status TEXT;
	v_max_qn INT;
	v_row JSONB;
	v_added INT := 0;
BEGIN
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
		RAISE EXCEPTION 'Questions payload must be a JSON array';
	END IF;

	SELECT student_id, status INTO v_student, v_status FROM public.tests WHERE id = p_test_id;
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Test not found';
	END IF;
	IF v_status <> 'in_progress' THEN
		RAISE EXCEPTION 'Test is not in progress';
	END IF;
	IF v_caller IS NOT NULL AND v_caller <> v_student THEN
		RAISE EXCEPTION 'Caller does not own test';
	END IF;

	SELECT COALESCE(MAX(question_number), 0) INTO v_max_qn
	FROM public.questions WHERE test_id = p_test_id;

	FOR v_row IN SELECT * FROM jsonb_array_elements(p_questions)
	LOOP
		v_max_qn := v_max_qn + 1;
		v_added := v_added + 1;
		INSERT INTO public.questions (
			test_id,
			topic_id,
			question_text,
			question_type,
			difficulty_level,
			answer_key,
			options,
			question_number,
			metadata
		) VALUES (
			p_test_id,
			(v_row->>'topic_id')::uuid,
			v_row->>'question_text',
			v_row->>'question_type',
			v_row->>'difficulty_level',
			v_row->'answer_key',
			CASE
				WHEN (v_row->>'question_type') = 'multiple_choice' THEN v_row->'options'
				ELSE NULL
			END,
			v_max_qn,
			COALESCE(v_row->'metadata', '{}'::jsonb) || jsonb_build_object('adaptive', true)
		);
	END LOOP;

	UPDATE public.tests
	SET total_questions = COALESCE(total_questions, 0) + v_added,
	    question_count = COALESCE(question_count, 0) + v_added,
	    updated_at = NOW()
	WHERE id = p_test_id;

	RETURN v_added;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_claim_jobs(p_worker_id text, p_job_types text[], p_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, job_type text, test_id uuid, student_id uuid, attempts integer, max_attempts integer, payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
	IF auth.uid() IS NOT NULL THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	RETURN QUERY
	WITH claimed AS (
		SELECT pj.id
		FROM public.practice_jobs pj
		WHERE pj.status = 'pending'
		  AND pj.job_type = ANY(p_job_types)
		  AND pj.run_after <= NOW()
		ORDER BY pj.run_after ASC
		LIMIT p_limit
		FOR UPDATE SKIP LOCKED
	)
	UPDATE public.practice_jobs pj
	SET status = 'running',
	    attempts = pj.attempts + 1,
	    claimed_at = NOW(),
	    claimed_by = p_worker_id,
	    updated_at = NOW()
	FROM claimed
	WHERE pj.id = claimed.id
	RETURNING pj.id, pj.job_type, pj.test_id, pj.student_id,
	          pj.attempts, pj.max_attempts, pj.payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_enqueue_job(p_job_type text, p_test_id uuid, p_payload jsonb DEFAULT '{}'::jsonb, p_run_after timestamp without time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_caller UUID := auth.uid();
	v_test_owner UUID;
	v_job_id UUID;
BEGIN
	IF p_job_type NOT IN ('grade', 'pdf', 'auto_submit') THEN
		RAISE EXCEPTION 'Invalid job_type %', p_job_type;
	END IF;

	SELECT student_id INTO v_test_owner FROM public.tests WHERE id = p_test_id;
	IF v_test_owner IS NULL THEN
		RAISE EXCEPTION 'Test not found';
	END IF;

	IF v_caller IS NOT NULL AND v_caller <> v_test_owner THEN
		RAISE EXCEPTION 'Cannot enqueue jobs for another student';
	END IF;

	INSERT INTO public.practice_jobs (
		job_type, test_id, student_id, payload, run_after
	) VALUES (
		p_job_type, p_test_id, v_test_owner, COALESCE(p_payload, '{}'::jsonb), p_run_after
	) RETURNING id INTO v_job_id;

	RETURN v_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_generate_test(p_subject_id uuid, p_difficulty text, p_duration_seconds integer, p_question_count integer, p_question_mix jsonb, p_questions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_student UUID := auth.uid();
	v_test_id UUID;
	v_expected_count INT;
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_student AND role = 'student') THEN
		RAISE EXCEPTION 'Only students can generate practice tests';
	END IF;
	IF p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
		RAISE EXCEPTION 'Invalid difficulty';
	END IF;
	IF p_duration_seconds NOT IN (3600, 10800) THEN
		RAISE EXCEPTION 'Invalid duration';
	END IF;
	IF p_question_count <= 0 OR p_question_count > 200 THEN
		RAISE EXCEPTION 'Invalid question count';
	END IF;
	IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
		RAISE EXCEPTION 'Questions payload must be a JSON array';
	END IF;

	v_expected_count := jsonb_array_length(p_questions);
	IF v_expected_count <> p_question_count THEN
		RAISE EXCEPTION 'question_count % does not match payload length %', p_question_count, v_expected_count;
	END IF;

	UPDATE public.tests
	SET status = 'abandoned',
	    abandoned_at = NOW(),
	    updated_at = NOW()
	WHERE student_id = v_student
	  AND subject_id = p_subject_id
	  AND status IN ('in_progress', 'grading');

	INSERT INTO public.tests (
		student_id,
		subject_id,
		test_type,
		status,
		is_draft,
		time_limit_seconds,
		total_questions,
		difficulty,
		question_count,
		question_mix
	) VALUES (
		v_student,
		p_subject_id,
		'self',
		'in_progress',
		TRUE,
		p_duration_seconds,
		p_question_count,
		p_difficulty,
		p_question_count,
		p_question_mix
	) RETURNING id INTO v_test_id;

	INSERT INTO public.questions (
		test_id,
		topic_id,
		question_text,
		question_type,
		difficulty_level,
		answer_key,
		options,
		question_number,
		metadata
	)
	SELECT
		v_test_id,
		(elem->>'topic_id')::uuid,
		elem->>'question_text',
		elem->>'question_type',
		elem->>'difficulty_level',
		elem->'answer_key',
		CASE
			WHEN (elem->>'question_type') = 'multiple_choice' THEN elem->'options'
			ELSE NULL
		END,
		ord::int,
		COALESCE(elem->'metadata', '{}'::jsonb)
	FROM jsonb_array_elements(p_questions) WITH ORDINALITY AS t(elem, ord);

	RETURN v_test_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_rate_limit_consume(p_bucket text, p_limit_n integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_student UUID := auth.uid();
	v_window TIMESTAMP;
	v_count INT;
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	v_window := to_timestamp(
		floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
	) AT TIME ZONE 'UTC';

	INSERT INTO public.practice_rate_limits (student_id, bucket, window_start, count)
	VALUES (v_student, p_bucket, v_window, 1)
	ON CONFLICT (student_id, bucket, window_start)
	DO UPDATE SET count = public.practice_rate_limits.count + 1
		WHERE public.practice_rate_limits.count < p_limit_n
	RETURNING count INTO v_count;

	IF v_count IS NULL THEN
		SELECT count INTO v_count FROM public.practice_rate_limits
		WHERE student_id = v_student AND bucket = p_bucket AND window_start = v_window;
		allowed := FALSE;
		remaining := 0;
		reset_at := v_window + make_interval(secs => p_window_seconds);
		RETURN NEXT;
		RETURN;
	END IF;

	allowed := TRUE;
	remaining := GREATEST(0, p_limit_n - v_count);
	reset_at := v_window + make_interval(secs => p_window_seconds);
	RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_reclaim_stale_running_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	n integer;
BEGIN
	IF auth.uid() IS NOT NULL THEN
		RAISE EXCEPTION 'Workers only';
	END IF;

	WITH reclaimed AS (
		UPDATE public.practice_jobs
		SET
			status = 'pending',
			run_after = NOW(),
			error = NULL,
			updated_at = NOW()
		WHERE status = 'running'
			AND updated_at < NOW() - INTERVAL '12 minutes'
		RETURNING id
	)
	SELECT count(*)::integer INTO n FROM reclaimed;

	RETURN COALESCE(n, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_start_grading(p_test_id uuid, p_client_elapsed_seconds integer)
 RETURNS TABLE(test_id uuid, subject_id uuid, status text, duration_seconds integer, time_limit_seconds integer, started_at timestamp without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_student UUID := auth.uid();
BEGIN
	IF v_student IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	RETURN QUERY
	UPDATE public.tests t
	SET status = 'grading',
	    duration_seconds = LEAST(
	        COALESCE(p_client_elapsed_seconds, t.time_limit_seconds),
	        COALESCE(t.time_limit_seconds, p_client_elapsed_seconds),
	        CASE
	            WHEN t.started_at IS NOT NULL THEN GREATEST(1, CAST(EXTRACT(EPOCH FROM (NOW() - t.started_at)) AS INT))
	            ELSE COALESCE(p_client_elapsed_seconds, t.time_limit_seconds)
	        END
	    ),
	    updated_at = NOW()
	WHERE t.id = p_test_id
	  AND t.student_id = v_student
	  AND t.status = 'in_progress'
	RETURNING t.id, t.subject_id, (t.status)::text, t.duration_seconds, t.time_limit_seconds, t.started_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_subject_progress(p_student_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(subject_id uuid, test_id uuid, answered_count integer, total_questions integer, time_limit_seconds integer, started_at timestamp without time zone, topics_covered integer, last_test_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	v_target UUID := COALESCE(p_student_id, auth.uid());
BEGIN
	IF v_target IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;
	IF auth.uid() IS NOT NULL AND auth.uid() <> v_target THEN
		RAISE EXCEPTION 'Cannot read another student';
	END IF;

	RETURN QUERY
	WITH in_progress AS (
		SELECT DISTINCT ON (t.subject_id)
			t.id AS test_id,
			t.subject_id,
			t.total_questions,
			t.time_limit_seconds,
			t.started_at
		FROM public.tests t
		WHERE t.student_id = v_target
		  AND t.test_type = 'self'
		  AND t.status = 'in_progress'
		ORDER BY t.subject_id, t.updated_at DESC
	),
	answer_counts AS (
		SELECT sa.test_id, COUNT(*)::int AS n
		FROM public.student_answers sa
		WHERE sa.test_id IN (SELECT p.test_id FROM in_progress p)
		  AND sa.student_answer ? 'value'
		  AND length(COALESCE(sa.student_answer->>'value', '')) > 0
		GROUP BY sa.test_id
	),
	question_counts AS (
		SELECT q.test_id,
		       COUNT(*)::int AS qn,
		       COUNT(DISTINCT q.topic_id)::int AS tn
		FROM public.questions q
		WHERE q.test_id IN (SELECT p.test_id FROM in_progress p)
		GROUP BY q.test_id
	),
	last_scores AS (
		SELECT DISTINCT ON (t.subject_id)
			t.subject_id,
			t.total_score
		FROM public.tests t
		WHERE t.student_id = v_target
		  AND t.test_type = 'self'
		  AND t.status = 'graded'
		ORDER BY t.subject_id, t.test_date DESC
	)
	SELECT
		ip.subject_id,
		ip.test_id,
		COALESCE(ac.n, 0) AS answered_count,
		COALESCE(NULLIF(ip.total_questions, 0), qc.qn, 0) AS total_questions,
		ip.time_limit_seconds,
		ip.started_at,
		qc.tn AS topics_covered,
		ls.total_score AS last_test_score
	FROM in_progress ip
	LEFT JOIN answer_counts ac ON ac.test_id = ip.test_id
	LEFT JOIN question_counts qc ON qc.test_id = ip.test_id
	LEFT JOIN last_scores ls ON ls.subject_id = ip.subject_id;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.practice_update_trackers_bulk(p_student_id uuid, p_subject_id uuid, p_current_test_id uuid, p_now timestamp with time zone, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
	elem jsonb;
BEGIN
	IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
		RETURN;
	END IF;

	FOR elem IN SELECT t.x FROM jsonb_array_elements(p_items) AS t(x)
	LOOP
		IF elem IS NULL OR jsonb_typeof(elem) <> 'object' THEN
			CONTINUE;
		END IF;
		IF elem->>'topic_id' IS NULL OR elem->>'average_score' IS NULL THEN
			CONTINUE;
		END IF;

		PERFORM public.practice_update_tracker_running(
			p_student_id,
			p_subject_id,
			(elem->>'topic_id')::uuid,
			p_current_test_id,
			(elem->>'average_score')::numeric,
			COALESCE((elem->>'n_incorrect')::int, 0),
			p_now::timestamp
		);
	END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.practice_upsert_question_embeddings(p_rows jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
	UPDATE public.questions AS q
	SET embedding = v.emb::vector
	FROM (
		SELECT (elem->>'question_id')::uuid AS qid, elem->>'embedding' AS emb
		FROM jsonb_array_elements(
			CASE
				WHEN p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN '[]'::jsonb
				ELSE p_rows
			END
		) AS elem
		WHERE elem ? 'question_id'
		  AND elem ? 'embedding'
		  AND (elem->>'embedding') IS NOT NULL
		  AND length(trim(elem->>'embedding')) > 0
	) AS v(qid, emb)
	WHERE q.id = v.qid;
$function$;

CREATE OR REPLACE FUNCTION public.profiles_block_privilege_column_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        RETURN NEW;
    END IF;
    IF current_setting('eduai.bypass_profile_update_guard', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
        OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
        OR NEW.parent_email IS DISTINCT FROM OLD.parent_email
        OR NEW.student_link_code IS DISTINCT FROM OLD.student_link_code
        OR NEW.subjects_taught IS DISTINCT FROM OLD.subjects_taught
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'profiles: cannot modify protected columns via client'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_parent(p_full_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_email_confirmed boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = auth.uid();

    INSERT INTO public.profiles (id, full_name, role, is_verified)
    VALUES (auth.uid(), p_full_name, 'parent', COALESCE(v_email_confirmed, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_student(p_full_name text, p_grade integer, p_section text, p_stream text DEFAULT NULL::text, p_elective_subject_id uuid DEFAULT NULL::uuid, p_parent_name text DEFAULT NULL::text, p_parent_email text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_email_confirmed boolean;
    v_code text;
    n int := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Profile already exists';
    END IF;
    IF p_grade IS NULL OR p_grade NOT BETWEEN 6 AND 12 THEN
        RAISE EXCEPTION 'Invalid grade';
    END IF;
    IF p_section IS NULL OR length(trim(p_section)) = 0 THEN
        RAISE EXCEPTION 'Section required';
    END IF;
    IF p_grade IN (11, 12) AND (
        p_stream IS NULL
        OR p_stream NOT IN (
            'science',
            'science_pcmb',
            'science_pcm',
            'science_pcb',
            'commerce',
            'commerce_with_maths',
            'arts'
        )
    ) THEN
        RAISE EXCEPTION 'Stream required for grades 11-12';
    END IF;
    IF p_grade IN (11, 12) AND p_elective_subject_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.subjects s
            WHERE s.id = p_elective_subject_id AND s.grade = p_grade AND s.is_elective = true
        ) THEN
            RAISE EXCEPTION 'Invalid elective for grade';
        END IF;
    END IF;

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users u
    WHERE u.id = auth.uid();

    LOOP
        v_code := public._generate_student_link_code();
        BEGIN
            INSERT INTO public.profiles (
                id, full_name, role, grade, section, stream, elective_subject_id,
                parent_name, parent_email, is_verified, student_link_code
            ) VALUES (
                auth.uid(), p_full_name, 'student', p_grade, p_section,
                CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
                CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END,
                p_parent_name, p_parent_email,
                COALESCE(v_email_confirmed, false),
                v_code
            );
            EXIT;
        EXCEPTION
            WHEN unique_violation THEN
                n := n + 1;
                IF n > 100 THEN
                    RAISE EXCEPTION 'Could not allocate student link code';
                END IF;
        END;
    END LOOP;

    PERFORM public.initialize_performance_tracker(
        auth.uid(),
        p_grade,
        CASE WHEN p_grade IN (11, 12) THEN p_stream ELSE NULL END,
        CASE WHEN p_grade IN (11, 12) THEN p_elective_subject_id ELSE NULL END
    );
END;
$function$;
