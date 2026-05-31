-- Cache of AI-generated teacher dashboard "class insight" narratives.
--
-- An insight is a pure function of the scoped class-performance summary, so we
-- key each cached row on (teacher, dashboard scope, prompt_version) and stamp it
-- with a `data_fingerprint` — a sha256 of the exact summary inputs that feed the
-- prompt. On generate we recompute the summary, hash it, and compare:
--   * fingerprint matches a stored row  -> serve the cached insight, no LLM call
--   * fingerprint differs / no row       -> regenerate, then upsert
-- This self-invalidates: when grades change, the fingerprint changes and the
-- next view regenerates lazily. Bumping the app-side PROMPT_VERSION constant
-- invalidates every row without a migration.
--
-- Per-teacher only. The class summary folds in the requesting teacher's own
-- graded assignments (assignments.teacher_id = teacherId), so two teachers in
-- the same org generally produce different insights for the same scope — org
-- pooling is intentionally NOT done here. `organization_id` is stored as
-- context only (for future org-pure insights and cleanup), never as a key.
--
-- Scope columns are nullable; NULL means "all" (all grades / sections /
-- subjects). The unique index uses NULLS NOT DISTINCT (Postgres 15+) so the
-- "all" scopes collapse to a single upsert target instead of multiplying.

CREATE TABLE IF NOT EXISTS public.teacher_class_insights (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
	grade smallint NULL,
	section text NULL,
	subject_id uuid NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
	prompt_version integer NOT NULL,
	data_fingerprint text NOT NULL,
	insight jsonb NOT NULL,
	model text NULL,
	provider text NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (teacher, scope, prompt_version). NULLS NOT DISTINCT makes the
-- "all grades / all sections / all subjects" scope a single upsert target so
-- ON CONFLICT correctly overwrites the existing row when the data changes.
CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_insights_scope_uniq
	ON public.teacher_class_insights (teacher_id, grade, section, subject_id, prompt_version)
	NULLS NOT DISTINCT;

ALTER TABLE public.teacher_class_insights ENABLE ROW LEVEL SECURITY;

-- No SELECT / INSERT / UPDATE / DELETE policies are declared on purpose: only
-- the service-role connection (the server-side `db` client used by the teacher
-- dashboard action + SSR loader) bypasses RLS and may read / write this table.
-- The cache is never exposed to anon / authenticated PostgREST callers.

COMMENT ON TABLE public.teacher_class_insights IS
	'Per-teacher cache of AI class-insight narratives, keyed by dashboard scope + prompt_version and validated by a data_fingerprint over the summary inputs. Service-role only.';
