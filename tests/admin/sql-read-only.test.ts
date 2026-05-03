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
	it("appends LIMIT when missing", () => {
		expect(enforceSelectMaxRows("SELECT 1")).toBe(`SELECT 1 LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
	});
	it("caps an oversized trailing LIMIT", () => {
		expect(enforceSelectMaxRows("SELECT 1 LIMIT 99999")).toBe(`SELECT 1 LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
	});
	it("keeps a small trailing LIMIT", () => {
		expect(enforceSelectMaxRows("SELECT 1 LIMIT 10")).toBe("SELECT 1 LIMIT 10");
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
	it("allows EXPLAIN without adding LIMIT", () => {
		const r = assertReadOnlySelect("EXPLAIN SELECT 1");
		expect(r).toEqual({ ok: true, sql: "EXPLAIN SELECT 1" });
	});
	it("adds LIMIT for SELECT", () => {
		const r = assertReadOnlySelect("SELECT 1");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sql).toContain(`LIMIT ${ADMIN_SQL_MAX_RESULT_ROWS}`);
	});
});
