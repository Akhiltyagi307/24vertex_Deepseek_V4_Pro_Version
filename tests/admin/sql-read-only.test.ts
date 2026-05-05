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
