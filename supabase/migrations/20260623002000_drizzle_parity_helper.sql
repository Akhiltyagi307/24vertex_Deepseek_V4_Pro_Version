-- Helper RPC used by scripts/check-drizzle-postgres-parity.mjs to surface
-- the full column inventory of `public` to a service-role client. Returns
-- one row per (table_name, column_name) pair. The function is service-role
-- only; we want zero exposure of schema metadata to anon/authenticated.
--
-- The script can run without this helper (it WARNs and exits 0), but
-- installing it lets the parity check return a definitive diff.

CREATE OR REPLACE FUNCTION public._drizzle_parity_columns()
RETURNS TABLE(table_name text, column_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $$
	SELECT c.table_name::text, c.column_name::text
	FROM information_schema.columns c
	JOIN information_schema.tables t
		ON c.table_schema = t.table_schema AND c.table_name = t.table_name
	WHERE c.table_schema = 'public'
		AND t.table_type = 'BASE TABLE'
	ORDER BY c.table_name, c.ordinal_position;
$$;

REVOKE ALL ON FUNCTION public._drizzle_parity_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._drizzle_parity_columns() TO service_role;

COMMENT ON FUNCTION public._drizzle_parity_columns() IS
	'Service-role helper for scripts/check-drizzle-postgres-parity.mjs. Returns (table_name, column_name) pairs for every base table in `public`. Do not call from application code.';
