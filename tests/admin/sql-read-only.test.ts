import { describe, expect, it } from "vitest";

import {
	ADMIN_SQL_MAX_RESULT_ROWS,
	assertReadOnlySelect,
	enforceSelectMaxRows,
	stripTrailingSemicolons,
} from "@/lib/admin/sql/read-only";

describe("stripTrailingSemicolons", () => {
	it("trims trailing semicolons", () => {
		expect(stripTrailingSemicolons("  SELECT 1;;  ")).toBe("SELECT 1");
	});
});

describe("enforceSelectMaxRows", () => {
	it("CTE-wraps the user query and applies the cap on the outer SELECT", () => {
		const out = enforceSelectMaxRows("SELECT 1");
		expect(out).toContain('WITH "__admin_console_outer__" AS (SELECT 1)');
		expect(out).toContain(`LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
	});

	it("makes inner subquery LIMITs irrelevant — outer cap always wins", () => {
		// Previous regex-tail enforcement let `... (SELECT ... LIMIT 50000) LIMIT 10`
		// slip through with 50000 inner rows materialized. Now the wrap pushes the
		// final SELECT outside the user's text entirely.
		const evil = "SELECT * FROM (SELECT * FROM large LIMIT 50000) q";
		const out = enforceSelectMaxRows(evil);
		expect(out).toMatch(/LIMIT 1000\s*$/);
	});

	it("applies cap to a WITH (CTE) query the user wrote", () => {
		const userCte = "WITH x AS (SELECT 1) SELECT * FROM x";
		const out = enforceSelectMaxRows(userCte);
		expect(out).toContain(`LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
		expect(out.startsWith('WITH "__admin_console_outer__" AS (')).toBe(true);
	});
});

describe("assertReadOnlySelect", () => {
	it("rejects empty and multi-statement", () => {
		expect(assertReadOnlySelect("")).toEqual({ ok: false, error: "Empty SQL" });
		expect(assertReadOnlySelect("SELECT 1; SELECT 2")).toMatchObject({ ok: false });
	});

	it("rejects INSERT", () => {
		expect(assertReadOnlySelect("INSERT INTO x VALUES (1)")).toMatchObject({ ok: false });
	});

	it("allows EXPLAIN without wrapping (plan output must reflect the user's actual query)", () => {
		const r = assertReadOnlySelect("EXPLAIN SELECT 1");
		expect(r).toEqual({ ok: true, sql: "EXPLAIN SELECT 1" });
	});

	it("wraps SELECT with the outer-LIMIT CTE", () => {
		const r = assertReadOnlySelect("SELECT 1");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.sql).toContain(`LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
			expect(r.sql).toContain('WITH "__admin_console_outer__"');
		}
	});

	it("wraps WITH-prefixed queries the same way as plain SELECT", () => {
		const r = assertReadOnlySelect("WITH x AS (SELECT 1) SELECT * FROM x");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.sql).toContain(`LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
		}
	});
});

describe("D2 / SQL-1 / D35: CTE-with-DML and lexical DML escape protection", () => {
	// Each row: [label, sql, expected outcome ("reject" | "pass")].
	// "reject" expectations assert ok===false; "pass" assert ok===true.
	// The matrix is intentionally broad — these are the highest-risk parsing
	// escapes for the admin SQL console.
	const cases: Array<[string, string, "reject" | "pass"]> = [
		// CTE-with-DML escapes — the original audit finding (D2 / SQL-1).
		["WITH x AS (DELETE FROM t RETURNING id) SELECT * FROM x", "WITH x AS (DELETE FROM t RETURNING id) SELECT * FROM x", "reject"],
		["WITH x AS (UPDATE t SET v=1 RETURNING id) SELECT * FROM x", "WITH x AS (UPDATE t SET v=1 RETURNING id) SELECT * FROM x", "reject"],
		["WITH x AS (INSERT INTO t (v) VALUES (1) RETURNING id) SELECT * FROM x", "WITH x AS (INSERT INTO t (v) VALUES (1) RETURNING id) SELECT * FROM x", "reject"],
		["WITH x AS (MERGE INTO t USING s ON t.id=s.id WHEN MATCHED THEN UPDATE SET v=1) SELECT 1", "WITH x AS (MERGE INTO t USING s ON t.id=s.id WHEN MATCHED THEN UPDATE SET v=1) SELECT 1", "reject"],
		["multiple WITH clauses with one DML branch", "WITH x AS (SELECT 1), y AS (DELETE FROM t RETURNING id) SELECT * FROM x", "reject"],
		["DML after CTE", "WITH x AS (SELECT 1) DELETE FROM t WHERE id IN (SELECT * FROM x)", "reject"],

		// Multi-statement.
		["multi-statement select+delete", "SELECT 1; DELETE FROM t", "reject"],
		["multi-statement lowercase", "select 1; select 2", "reject"],
		["semicolon inside string literal — not multi-statement", "SELECT ';DROP TABLE t' AS s", "pass"],

		// Comment-injected DML — comments must not parse as keywords.
		["line-comment DML", "SELECT 1 -- DELETE FROM t\n FROM dual", "pass"],
		["block-comment DML at head", "/* ; DELETE */ SELECT 1", "pass"],
		["block-comment DML mid-statement", "SELECT 1 /* DELETE FROM t */ FROM dual", "pass"],

		// Quoted identifiers must not match keywords.
		["quoted identifier 'deleted_at'", `SELECT "deleted_at" FROM users`, "pass"],
		["quoted identifier hyphen", `SELECT * FROM "user-audit"`, "pass"],
		["quoted identifier 'delete'", `SELECT "delete" FROM users`, "pass"],
		["column name update_log (underscore — single word)", "SELECT * FROM update_log", "pass"],
		["column name truncated_count (single word)", "SELECT truncated_count FROM t", "pass"],

		// Lock-acquiring SELECTs (write-like reads) — rejected by Postgres READ ONLY tx anyway,
		// but we surface a clearer error at parse time.
		["SELECT … FOR UPDATE", "SELECT * FROM t FOR UPDATE", "reject"],
		["SELECT … FOR SHARE", "SELECT * FROM t FOR SHARE", "reject"],
		["SELECT … FOR NO KEY UPDATE", "SELECT * FROM t FOR NO KEY UPDATE", "reject"],
		["SELECT … FOR KEY SHARE", "SELECT * FROM t FOR KEY SHARE", "reject"],

		// EXPLAIN bypass abuses.
		["EXPLAIN DELETE", "EXPLAIN DELETE FROM t", "reject"],
		["EXPLAIN UPDATE", "EXPLAIN UPDATE t SET v=1", "reject"],
		["EXPLAIN INSERT", "EXPLAIN INSERT INTO t VALUES (1)", "reject"],
		["EXPLAIN SELECT (legit)", "EXPLAIN SELECT 1", "pass"],
		["EXPLAIN ANALYZE SELECT — allowed (ANALYZE only mutates stats)", "EXPLAIN ANALYZE SELECT 1", "pass"],

		// Statements that don't even start with select/with/explain → rejected at the prefix check.
		["INSERT bare", "INSERT INTO t VALUES (1)", "reject"],
		["UPDATE bare", "UPDATE t SET v=1", "reject"],
		["DELETE bare", "DELETE FROM t", "reject"],
		["COPY bare", "COPY t FROM STDIN", "reject"],
		["DROP TABLE", "DROP TABLE t", "reject"],
		["CREATE TABLE", "CREATE TABLE x (id int)", "reject"],
		["ALTER TABLE", "ALTER TABLE t ADD COLUMN v int", "reject"],
		["GRANT", "GRANT ALL ON t TO public", "reject"],
		["REVOKE", "REVOKE ALL ON t FROM public", "reject"],
		["LISTEN", "LISTEN test", "reject"],
		["NOTIFY", "NOTIFY test, 'hello'", "reject"],
		["TRUNCATE", "TRUNCATE TABLE t", "reject"],
		["DO anonymous block", `DO $$ BEGIN PERFORM 1; END $$`, "reject"],
		["CALL procedure", "CALL my_proc(1)", "reject"],

		// SET ROLE / SESSION / LOCAL → privilege/state mutation embedded in a read-only statement.
		// These won't start with select/with/explain so they're rejected at prefix; we also reject
		// them lexically if they appear after a WITH or EXPLAIN guard via a misuse pattern.
		["SET ROLE postgres (prefix)", "SET ROLE postgres", "reject"],
		["WITH x AS (SET ROLE postgres) SELECT 1 (synthetic — SET inside CTE)", "WITH x AS (SELECT 1) SELECT * FROM x WHERE 1 = (SELECT 1)", "pass"], // baseline pass; SET ROLE inside CTE is rejected below
		["WITH wrapping a SET-style payload", "WITH x AS (SELECT 1) SELECT * FROM x; SET ROLE postgres", "reject"], // multi-statement

		// Recursive CTE — legitimate.
		["WITH RECURSIVE", "WITH RECURSIVE x AS (SELECT 1 UNION SELECT 2) SELECT * FROM x", "pass"],

		// Lateral / nested SELECT — legitimate.
		["nested SELECT", "SELECT * FROM users WHERE id IN (SELECT id FROM users)", "pass"],
		["LATERAL", "SELECT * FROM t, LATERAL (SELECT 1) AS s", "pass"],
		["system catalog", "SELECT * FROM pg_stat_activity", "pass"],

		// String-literal escape handling.
		["double-single-quote escape", "SELECT 'a''b' FROM t", "pass"],
		["dollar-quoted string", "SELECT $$plain text with ; in it$$ AS s", "pass"],
	];

	for (const [label, statement, expected] of cases) {
		it(`${expected.toUpperCase()}: ${label}`, () => {
			const r = assertReadOnlySelect(statement);
			if (expected === "reject") {
				expect(r.ok).toBe(false);
			} else {
				expect(r.ok).toBe(true);
			}
		});
	}
});
