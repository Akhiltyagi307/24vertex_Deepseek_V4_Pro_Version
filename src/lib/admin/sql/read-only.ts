import "server-only";

export const ADMIN_SQL_MAX_RESULT_ROWS = 1000;

export function stripTrailingSemicolons(s: string): string {
	return s.replace(/;+\s*$/g, "").trim();
}

/**
 * Wraps the user's read-only query in a CTE and applies the row cap on the
 * outer SELECT. This is materially stronger than the previous tail-regex
 * approach, which only matched a LIMIT at the very end of the string and
 * therefore did not bound:
 *
 *   - subqueries that themselves contained LIMIT
 *     `SELECT * FROM (SELECT * FROM x LIMIT 50000) q LIMIT 10`
 *   - WITH … SELECT FROM cte where the cte is unbounded
 *   - non-trailing LIMITs followed by trailing comments / whitespace tricks
 *
 * Postgres allows LIMIT on the outer SELECT to take precedence regardless of
 * what's inside the CTE, so wrapping is the simplest reliable cap that
 * doesn't require a SQL parser. EXPLAIN is short-circuited by the caller
 * (`assertReadOnlySelect`) so its plan is not affected.
 *
 * The CTE alias name is internal and quoted to avoid colliding with a user-
 * defined name in their query (PG identifier visibility rules already make
 * collisions hard, but quoting makes it certain).
 */
export function enforceSelectMaxRows(inner: string): string {
	const trimmed = inner.trim();
	return `WITH "__admin_console_outer__" AS (${trimmed}) SELECT * FROM "__admin_console_outer__" LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`;
}

export function assertReadOnlySelect(
	sqlText: string,
): { ok: true; sql: string } | { ok: false; error: string } {
	const inner = stripTrailingSemicolons(sqlText);
	if (!inner) return { ok: false, error: "Empty SQL" };
	if (inner.includes(";")) return { ok: false, error: "Multiple statements are not allowed" };
	const low = inner.toLowerCase();
	if (!low.startsWith("select") && !low.startsWith("with") && !low.startsWith("explain")) {
		return {
			ok: false,
			error: "Only SELECT, WITH, or standalone EXPLAIN are allowed in read-only mode",
		};
	}
	if (low.startsWith("explain")) {
		return { ok: true, sql: inner };
	}
	return { ok: true, sql: enforceSelectMaxRows(inner) };
}
