-- Admin panel: Postgres-backed JWT version (panic revoke) + login rate limiting (replaces Upstash for Phase 1).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_runtime_kv (
	key TEXT PRIMARY KEY,
	value_int BIGINT NOT NULL DEFAULT 0,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.admin_runtime_kv (key, value_int)
VALUES ('jwt_version', 0)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_login_rate (
	ip INET PRIMARY KEY,
	fail_count INT NOT NULL DEFAULT 0,
	window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.admin_runtime_kv FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_login_rate FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_runtime_kv TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_rate TO service_role;

COMMIT;
