-- Phase 1: practice flow integrity and security
--   * tests: new columns (started_at, auto_submitted, abandoned_at, question_count,
--     question_mix) + widened status CHECK (grading, grading_failed, abandoned,
--     expired retained).
--   * questions: unique (test_id, question_number); column-level grant so
--     students cannot SELECT answer_key.
--   * student_answers: per-question timing columns (time_spent_ms, visits).
--   * new tables: practice_rate_limits, question_flags.
--   * new RPCs (SECURITY DEFINER): practice_generate_test, practice_start_grading,
--     practice_update_tracker_running, practice_rate_limit_consume.

BEGIN;

-- ============================================================
-- tests: new columns and widened status
-- ============================================================

ALTER TABLE public.tests
	ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
	ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN DEFAULT FALSE,
	ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMP,
	ADD COLUMN IF NOT EXISTS question_count INT,
	ADD COLUMN IF NOT EXISTS question_mix JSONB;

-- Replace status CHECK; keep the column contents unchanged.
ALTER TABLE public.tests DROP CONSTRAINT IF EXISTS tests_status_check;
ALTER TABLE public.tests
	ADD CONSTRAINT tests_status_check
	CHECK (status IN ('in_progress', 'grading', 'submitted', 'graded', 'grading_failed', 'abandoned', 'expired'));

-- Only one active session (in_progress or grading) per subject+student.
-- Partial unique index so abandoned/graded/etc don't count.
CREATE UNIQUE INDEX IF NOT EXISTS tests_one_active_per_subject_uidx
	ON public.tests (student_id, subject_id)
	WHERE status IN ('in_progress', 'grading');

-- ============================================================
-- questions: unique question_number per test
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS questions_test_question_number_uidx
	ON public.questions (test_id, question_number);

-- ============================================================
-- student_answers: per-question timing
-- ============================================================

ALTER TABLE public.student_answers
	ADD COLUMN IF NOT EXISTS time_spent_ms BIGINT DEFAULT 0,
	ADD COLUMN IF NOT EXISTS visits INT DEFAULT 0;

-- ============================================================
-- practice_rate_limits: fixed window counter keyed by (student, bucket, window_start).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practice_rate_limits (
	student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	bucket TEXT NOT NULL,
	window_start TIMESTAMP NOT NULL,
	count INT NOT NULL DEFAULT 0,
	PRIMARY KEY (student_id, bucket, window_start)
);

CREATE INDEX IF NOT EXISTS idx_practice_rate_limits_student_bucket
	ON public.practice_rate_limits (student_id, bucket, window_start DESC);

ALTER TABLE public.practice_rate_limits ENABLE ROW LEVEL SECURITY;
-- No student-facing policies: updated only via SECURITY DEFINER RPC.

-- ============================================================
-- question_flags: students can report bad questions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_flags (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
	student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reason TEXT NOT NULL,
	notes TEXT,
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_flags_question ON public.question_flags (question_id);
CREATE INDEX IF NOT EXISTS idx_question_flags_student ON public.question_flags (student_id, created_at DESC);

ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students insert own flags"
	ON public.question_flags FOR INSERT TO authenticated
	WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students read own flags"
	ON public.question_flags FOR SELECT TO authenticated
	USING (student_id = auth.uid());

-- ============================================================
-- RLS audit: column-level grant on questions so answer_key is
-- unreachable from any authenticated client (service role bypasses).
-- ============================================================

REVOKE ALL ON public.questions FROM authenticated;
GRANT SELECT (
	id,
	test_id,
	topic_id,
	question_text,
	question_type,
	difficulty_level,
	options,
	question_number,
	metadata,
	created_at,
	embedding
) ON public.questions TO authenticated;
-- Writes still pass through RLS policies + the normal ALL grant.
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;

-- ============================================================
-- RPC: practice_rate_limit_consume
--   Fixed window with window length `p_window_seconds`; truncates current
--   time to the window and increments the counter. Returns allowed +
--   remaining + next reset.
-- ============================================================

CREATE OR REPLACE FUNCTION public.practice_rate_limit_consume(
	p_bucket TEXT,
	p_limit_n INT,
	p_window_seconds INT
)
RETURNS TABLE (allowed BOOLEAN, remaining INT, reset_at TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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

	-- Atomic upsert-and-return: if we would exceed the limit, do not increment.
	INSERT INTO public.practice_rate_limits (student_id, bucket, window_start, count)
	VALUES (v_student, p_bucket, v_window, 1)
	ON CONFLICT (student_id, bucket, window_start)
	DO UPDATE SET count = public.practice_rate_limits.count + 1
		WHERE public.practice_rate_limits.count < p_limit_n
	RETURNING count INTO v_count;

	IF v_count IS NULL THEN
		-- Limit reached; read the existing value for the user-facing message.
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
$$;

GRANT EXECUTE ON FUNCTION public.practice_rate_limit_consume(TEXT, INT, INT) TO authenticated;

-- ============================================================
-- RPC: practice_generate_test
--   Transactional insert of a new self-practice test + its questions.
--   Cancels any existing in_progress test for the same subject (marks
--   abandoned).
-- ============================================================

CREATE OR REPLACE FUNCTION public.practice_generate_test(
	p_subject_id UUID,
	p_difficulty TEXT,
	p_duration_seconds INT,
	p_question_count INT,
	p_question_mix JSONB,
	p_questions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
	v_student UUID := auth.uid();
	v_test_id UUID;
	v_inserted INT := 0;
	v_row JSONB;
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
	IF p_duration_seconds <= 0 OR p_duration_seconds > 24 * 3600 THEN
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

	-- Cancel any live test for this subject; partial unique index enforces
	-- the invariant so this must happen before the new insert.
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

	-- Insert questions, assigning question_number 1..N server-side.
	FOR v_row IN SELECT * FROM jsonb_array_elements(p_questions)
	LOOP
		v_inserted := v_inserted + 1;
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
			v_test_id,
			(v_row->>'topic_id')::uuid,
			v_row->>'question_text',
			v_row->>'question_type',
			v_row->>'difficulty_level',
			v_row->'answer_key',
			CASE
				WHEN (v_row->>'question_type') = 'multiple_choice' THEN v_row->'options'
				ELSE NULL
			END,
			v_inserted,
			COALESCE(v_row->'metadata', '{}'::jsonb)
		);
	END LOOP;

	RETURN v_test_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_generate_test(UUID, TEXT, INT, INT, JSONB, JSONB) TO authenticated;

-- ============================================================
-- RPC: practice_start_grading
--   Atomically flips tests.status from 'in_progress' to 'grading' and
--   records a server-side clamped duration. Returns the row id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.practice_start_grading(
	p_test_id UUID,
	p_client_elapsed_seconds INT
)
RETURNS TABLE (
	test_id UUID,
	subject_id UUID,
	status TEXT,
	duration_seconds INT,
	time_limit_seconds INT,
	started_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
	RETURNING t.id, t.subject_id, t.status, t.duration_seconds, t.time_limit_seconds, t.started_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.practice_start_grading(UUID, INT) TO authenticated;

-- ============================================================
-- RPC: practice_update_tracker_running
--   Rolling-window average (last 5 graded test means for this topic) +
--   trend recomputation. Caller passes the freshly computed rollup for
--   the current test so it can participate in the average even though
--   the test row may still be in 'grading' status.
-- ============================================================

CREATE OR REPLACE FUNCTION public.practice_update_tracker_running(
	p_student_id UUID,
	p_subject_id UUID,
	p_topic_id UUID,
	p_current_test_id UUID,
	p_current_test_score NUMERIC,
	p_current_n_incorrect INT,
	p_now TIMESTAMP
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
	-- Service-role callers (no JWT) have auth.uid() NULL; student callers
	-- must match p_student_id. Anything else is rejected.
	IF v_caller IS NOT NULL AND v_caller <> p_student_id THEN
		RAISE EXCEPTION 'Caller does not match student';
	END IF;

	-- Build a single series: current test's mean + the last 10 previous
	-- graded-topic test means. Rank by recency (current is most recent).
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

	-- Status thresholds mirror src/lib/practice/topic-rollup.ts.
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
$$;

GRANT EXECUTE ON FUNCTION public.practice_update_tracker_running(UUID, UUID, UUID, UUID, NUMERIC, INT, TIMESTAMP) TO authenticated;

COMMIT;
