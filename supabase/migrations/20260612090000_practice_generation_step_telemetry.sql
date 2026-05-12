BEGIN;

-- ============================================================
-- Practice generation run + step telemetry
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practice_generation_runs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	correlation_id UUID NOT NULL UNIQUE,
	student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
	subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
	test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
	request_mode TEXT NOT NULL,
	config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
	status TEXT NOT NULL DEFAULT 'running',
	failure_code TEXT,
	failure_message TEXT,
	total_input_tokens INT NOT NULL DEFAULT 0,
	total_output_tokens INT NOT NULL DEFAULT 0,
	total_ai_calls INT NOT NULL DEFAULT 0,
	timings_ms JSONB NOT NULL DEFAULT '{}'::jsonb,
	started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	finished_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT practice_generation_runs_request_mode_chk
		CHECK (request_mode IN ('server_action', 'stream')),
	CONSTRAINT practice_generation_runs_status_chk
		CHECK (status IN ('running', 'succeeded', 'failed', 'aborted'))
);

CREATE INDEX IF NOT EXISTS idx_practice_generation_runs_student_created
	ON public.practice_generation_runs (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_generation_runs_test_created
	ON public.practice_generation_runs (test_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_generation_runs_subject_created
	ON public.practice_generation_runs (subject_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.practice_generation_steps (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	run_id UUID NOT NULL REFERENCES public.practice_generation_runs(id) ON DELETE CASCADE,
	step_order INT NOT NULL,
	step_key VARCHAR(64) NOT NULL,
	status TEXT NOT NULL,
	model VARCHAR(64),
	feature VARCHAR(64),
	latency_ms INT,
	input_tokens INT,
	output_tokens INT,
	error TEXT,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT practice_generation_steps_status_chk
		CHECK (status IN ('started', 'ok', 'error', 'skipped')),
	CONSTRAINT practice_generation_steps_nonneg_input_tokens_chk
		CHECK (input_tokens IS NULL OR input_tokens >= 0),
	CONSTRAINT practice_generation_steps_nonneg_output_tokens_chk
		CHECK (output_tokens IS NULL OR output_tokens >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_generation_steps_run_step_order
	ON public.practice_generation_steps (run_id, step_order);
CREATE INDEX IF NOT EXISTS idx_practice_generation_steps_run_created
	ON public.practice_generation_steps (run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_generation_steps_step_created
	ON public.practice_generation_steps (step_key, created_at DESC);

-- ============================================================
-- ai_calls linkage extension
-- ============================================================

ALTER TABLE public.ai_calls
	ADD COLUMN IF NOT EXISTS generation_run_id UUID REFERENCES public.practice_generation_runs(id) ON DELETE SET NULL;

ALTER TABLE public.ai_calls
	ADD COLUMN IF NOT EXISTS correlation_id UUID;

ALTER TABLE public.ai_calls
	ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL;

ALTER TABLE public.ai_calls
	ADD COLUMN IF NOT EXISTS step_key VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_ai_calls_generation_run_created
	ON public.ai_calls (generation_run_id, created_at DESC)
	WHERE generation_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_calls_test_created
	ON public.ai_calls (test_id, created_at DESC)
	WHERE test_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_calls_correlation_created
	ON public.ai_calls (correlation_id, created_at DESC)
	WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_calls_step_key_created
	ON public.ai_calls (step_key, created_at DESC)
	WHERE step_key IS NOT NULL;

-- ============================================================
-- RLS + grants (service role telemetry writes)
-- ============================================================

ALTER TABLE public.practice_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_generation_steps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.practice_generation_runs FROM PUBLIC;
REVOKE ALL ON public.practice_generation_runs FROM anon;
REVOKE ALL ON public.practice_generation_runs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.practice_generation_runs TO service_role;

REVOKE ALL ON public.practice_generation_steps FROM PUBLIC;
REVOKE ALL ON public.practice_generation_steps FROM anon;
REVOKE ALL ON public.practice_generation_steps FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.practice_generation_steps TO service_role;

REVOKE ALL ON public.ai_calls FROM PUBLIC;
REVOKE ALL ON public.ai_calls FROM anon;
REVOKE ALL ON public.ai_calls FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_calls TO service_role;

COMMIT;
