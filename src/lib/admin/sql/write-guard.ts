import "server-only";

import { createHash } from "node:crypto";

import { stripTrailingSemicolons } from "@/lib/admin/sql/read-only";

export type WritableSqlParseResult =
	| { ok: true; verb: "INSERT" | "UPDATE" | "DELETE"; table: string; statementHash: string }
	| { ok: false; error: string };

/** Short stable hash for audit payloads (not reversible). */
export function hashSqlStatement(sqlText: string): string {
	return createHash("sha256").update(sqlText).digest("hex").slice(0, 24);
}

/**
 * Pull the target table out of an INSERT / UPDATE / DELETE statement.
 *
 * Previously this regex only matched bare lowercase identifiers
 * (`[a-zA-Z0-9_]+`), which silently dropped:
 *   - quoted identifiers with hyphens ("user-audit"), spaces, or punctuation
 *   - schema-qualified names (public.profiles)
 *
 * In both cases, a legitimate operator-typed statement was rejected with
 * "Could not parse target table". Worse, anyone wanting to bypass the
 * allowlist could quote a table name and slip through without the verb
 * being matched at all (the regex returned null and the guard refused —
 * defensive but a footgun).
 *
 * The new extractor:
 *   - Accepts an optional schema prefix (`schema.` or `"sch ema".`).
 *   - Accepts a bare or quoted target identifier.
 *   - Inside double quotes, allows any character except the closing quote
 *     itself (Postgres rule); `""` is the literal-quote escape.
 *   - Returns the table name lowercased and unquoted, so it can be matched
 *     verbatim against `ADMIN_SQL_WRITE_ALLOWLIST_TABLES`.
 *
 * Schema is captured but not currently used for allowlisting — schemas in
 * 24Vertex's admin context are always `public`, so we ignore it. If we ever
 * allow non-public schemas, extend the allowlist key to `schema.table`.
 */
const VERB_PATTERN = /^(?:update|delete\s+from|insert\s+into)\s+(?:only\s+)?(?:(?:"((?:[^"]|"")+)"|([a-zA-Z_][a-zA-Z0-9_]*))\s*\.\s*)?(?:"((?:[^"]|"")+)"|([a-zA-Z_][a-zA-Z0-9_]*))/i;

function unquotePgIdentifier(s: string): string {
	return s.replace(/""/g, '"');
}

function firstDmlTable(inner: string): string | null {
	const s = inner.trim();
	const m = VERB_PATTERN.exec(s);
	if (!m) return null;
	const quotedTable = m[3];
	const unquotedTable = m[4];
	const raw = quotedTable !== undefined ? unquotePgIdentifier(quotedTable) : unquotedTable;
	return raw ? raw.toLowerCase() : null;
}

/**
 * D31 / SQL-3: writable SQL must end with `RETURNING …` so the route can
 * capture an OLD/NEW row snapshot for the audit log without parsing the
 * statement's WHERE clause. Strings are stripped before the lookup so an
 * accidental `'RETURNING'` literal doesn't pass.
 */
export function statementHasReturningClause(inner: string): boolean {
	const stringsStripped = inner.replace(/'(?:[^']|'')*'/g, "''");
	return /\breturning\b/i.test(stringsStripped);
}

export function parseWritableAdminSql(
	sqlText: string,
	allowTables: Set<string>,
): WritableSqlParseResult {
	const inner = stripTrailingSemicolons(sqlText);
	if (!inner) return { ok: false, error: "Empty SQL" };
	if (inner.includes(";")) return { ok: false, error: "Multiple statements are not allowed" };
	const low = inner.toLowerCase();
	if (low.startsWith("select") || low.startsWith("with") || low.startsWith("explain")) {
		return { ok: false, error: "SELECT/WITH/EXPLAIN use read-only mode (writable off)" };
	}
	const verb: "INSERT" | "UPDATE" | "DELETE" | null = low.startsWith("insert") ? "INSERT"
		: low.startsWith("update") ? "UPDATE"
		: low.startsWith("delete") ? "DELETE"
		: null;
	if (!verb) return { ok: false, error: "Only INSERT, UPDATE, or DELETE are allowed in writable mode" };

	const table = firstDmlTable(inner);
	if (!table) return { ok: false, error: "Could not parse target table" };
	if (!allowTables.has(table)) {
		return { ok: false, error: `Table "${table}" is not in ADMIN_SQL_WRITE_ALLOWLIST_TABLES` };
	}

	// D31 / SQL-3: writable SQL must include RETURNING so the route can capture
	// the OLD/NEW row snapshot in the audit log. The operator burden is small —
	// add `RETURNING *` — and the upside is full diff visibility on every write.
	if (!statementHasReturningClause(inner)) {
		return {
			ok: false,
			error:
				"Writable SQL must include a RETURNING clause (e.g. `RETURNING *`) so the audit log can capture the affected rows.",
		};
	}

	return {
		ok: true,
		verb,
		table,
		statementHash: hashSqlStatement(inner),
	};
}

export function parseAllowlistTablesEnv(raw: string | undefined): Set<string> {
	const s = raw?.trim() ?? "";
	if (!s) return new Set();
	return new Set(
		s
			.split(",")
			.map((t) => t.trim().toLowerCase())
			.filter(Boolean),
	);
}
