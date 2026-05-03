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

function firstDmlTable(inner: string): string | null {
	const s = inner.trim();
	let m = /^update\s+(only\s+)?("?)([a-zA-Z0-9_]+)\2/i.exec(s);
	if (m) return m[3].toLowerCase();
	m = /^delete\s+from\s+(only\s+)?("?)([a-zA-Z0-9_]+)\2/i.exec(s);
	if (m) return m[3].toLowerCase();
	m = /^insert\s+into\s+(only\s+)?("?)([a-zA-Z0-9_]+)\2/i.exec(s);
	if (m) return m[3].toLowerCase();
	return null;
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
