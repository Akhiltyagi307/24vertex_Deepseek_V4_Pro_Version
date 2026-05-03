-- Admin Phase 2: saved list views (filters / sort / search serialized in JSON).

CREATE TABLE IF NOT EXISTS public.admin_saved_views (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	list_id VARCHAR(120) NOT NULL,
	name VARCHAR(200) NOT NULL,
	state JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT admin_saved_views_list_name_uidx UNIQUE (list_id, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_saved_views_list ON public.admin_saved_views (list_id);

ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_saved_views FROM PUBLIC;
REVOKE ALL ON public.admin_saved_views FROM anon;
REVOKE ALL ON public.admin_saved_views FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_saved_views TO service_role;
