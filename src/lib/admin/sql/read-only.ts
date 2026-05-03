import "server-only";

export const ADMIN_SQL_MAX_RESULT_ROWS = 1000;

export function stripTrailingSemicolons(s: string): string {
	return s.replace(/;+\s*$/g, "").trim();
}

/**
 * Enforces a trailing LIMIT ≤ {@link ADMIN_SQL_MAX_RESULT_ROWS} for SELECT / WITH queries.
 * Only adjusts a LIMIT at the very end of the string (common admin-console pattern).
 */
export function enforceSelectMaxRows(inner: string): string {
	const trimmed = inner.trimEnd();
	const re = /\blimit\s+(\d+)\s*$/i;
	const m = trimmed.match(re);
	if (m && m.index !== undefined) {
		const n = Number.parseInt(m[1], 10);
		const head = trimmed.slice(0, m.index).trimEnd();
		if (Number.isFinite(n) && n > ADMIN_SQL_MAX_RESULT_ROWS) {
			return `${head} LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`;
		}
		return trimmed;
	}
	return `${trimmed} LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`;
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
