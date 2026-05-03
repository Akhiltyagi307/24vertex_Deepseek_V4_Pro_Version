import { describe, expect, it } from "vitest";

import { parseAllowlistTablesEnv, parseWritableAdminSql } from "@/lib/admin/sql/write-guard";

describe("parseAllowlistTablesEnv", () => {
	it("parses comma list", () => {
		const s = parseAllowlistTablesEnv(" Foo , bar ");
		expect(s.has("foo")).toBe(true);
		expect(s.has("bar")).toBe(true);
	});
});

describe("parseWritableAdminSql", () => {
	const allow = new Set(["profiles"]);

	it("rejects SELECT", () => {
		expect(parseWritableAdminSql("SELECT 1", allow).ok).toBe(false);
	});

	it("accepts allowlisted UPDATE", () => {
		const r = parseWritableAdminSql(`UPDATE profiles SET full_name = full_name WHERE false`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.verb).toBe("UPDATE");
			expect(r.table).toBe("profiles");
		}
	});

	it("rejects non-allowlisted table", () => {
		const r = parseWritableAdminSql("DELETE FROM tests WHERE false", allow);
		expect(r.ok).toBe(false);
	});
});
