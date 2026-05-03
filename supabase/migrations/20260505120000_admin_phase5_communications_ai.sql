-- Phase 5: ai_prompts, ai_calls, email_templates, broadcasts, email_log telemetry.

BEGIN;

-- ---------------------------------------------------------------------------
-- ai_prompts + ai_calls (PDR §6 item 4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_prompts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	feature VARCHAR(64) NOT NULL,
	name VARCHAR(200) NOT NULL,
	version INT NOT NULL,
	template TEXT NOT NULL,
	model VARCHAR(64) NOT NULL,
	temperature NUMERIC(3, 2),
	max_tokens INT,
	is_active BOOLEAN NOT NULL DEFAULT FALSE,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT ai_prompts_feature_version_uq UNIQUE (feature, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON public.ai_prompts (feature) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.ai_calls (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	feature VARCHAR(64) NOT NULL,
	model VARCHAR(64) NOT NULL,
	user_id UUID,
	prompt_id UUID REFERENCES public.ai_prompts (id) ON DELETE SET NULL,
	input_tokens INT NOT NULL,
	output_tokens INT NOT NULL,
	latency_ms INT,
	status VARCHAR(20) NOT NULL,
	error TEXT,
	cost_inr NUMERIC(12, 4),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_feature_created ON public.ai_calls (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_user ON public.ai_calls (user_id);

-- ---------------------------------------------------------------------------
-- email_templates (PDR §6 item 8)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_templates (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	slug VARCHAR(100) NOT NULL,
	version INT NOT NULL,
	subject_tmpl TEXT NOT NULL,
	body_mjml TEXT NOT NULL,
	body_html TEXT NOT NULL,
	variables JSONB NOT NULL,
	is_active BOOLEAN NOT NULL DEFAULT FALSE,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT email_templates_slug_version_uq UNIQUE (slug, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_active_per_slug ON public.email_templates (slug)
WHERE
	is_active = TRUE;

-- ---------------------------------------------------------------------------
-- broadcasts (§4.14 — schema not in PDR §6; operator-defined)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broadcasts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	subject VARCHAR(500) NOT NULL,
	body_md TEXT NOT NULL,
	audience_json JSONB NOT NULL DEFAULT '{}'::jsonb,
	channels_json JSONB NOT NULL DEFAULT '{"in_app": true, "email": false, "priority_urgent": false}'::jsonb,
	status VARCHAR(30) NOT NULL DEFAULT 'draft',
	scheduled_at TIMESTAMPTZ,
	sent_at TIMESTAMPTZ,
	recipient_count INT,
	error TEXT,
	stats_json JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON public.broadcasts (status);

-- ---------------------------------------------------------------------------
-- email_log augmentation (webhook payloads, broadcast link, engagement)
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_log
	ADD COLUMN IF NOT EXISTS provider_payload JSONB;

ALTER TABLE public.email_log
	ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

ALTER TABLE public.email_log
	ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

ALTER TABLE public.email_log
	ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.broadcasts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_log_broadcast ON public.email_log (broadcast_id)
WHERE
	broadcast_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- Cohort / analytics range scans (12-month window)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_practice_analytics_occurred ON public.practice_analytics_events (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: admin tables — service_role only (same pattern as admin_saved_views)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_prompts FROM PUBLIC;
REVOKE ALL ON public.ai_prompts FROM anon;
REVOKE ALL ON public.ai_prompts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO service_role;

REVOKE ALL ON public.ai_calls FROM PUBLIC;
REVOKE ALL ON public.ai_calls FROM anon;
REVOKE ALL ON public.ai_calls FROM authenticated;
GRANT SELECT, INSERT ON public.ai_calls TO service_role;

REVOKE ALL ON public.email_templates FROM PUBLIC;
REVOKE ALL ON public.email_templates FROM anon;
REVOKE ALL ON public.email_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

REVOKE ALL ON public.broadcasts FROM PUBLIC;
REVOKE ALL ON public.broadcasts FROM anon;
REVOKE ALL ON public.broadcasts FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO service_role;

COMMIT;
