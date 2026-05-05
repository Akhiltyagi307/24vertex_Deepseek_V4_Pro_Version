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
	const allow = new Set(["profiles", "user-audit"]);

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

	it("parses quoted identifiers with hyphens (previously rejected as unparseable)", () => {
		const r = parseWritableAdminSql(`UPDATE "user-audit" SET note = '' WHERE false`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.table).toBe("user-audit");
		}
	});

	it("parses schema-qualified table names", () => {
		const r = parseWritableAdminSql(`UPDATE public.profiles SET full_name = '' WHERE false`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});

	it("parses quoted schema + quoted table", () => {
		const r = parseWritableAdminSql(`UPDATE "public"."profiles" SET full_name = '' WHERE false`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});

	it("handles INSERT INTO with quoted table", () => {
		const r = parseWritableAdminSql(`INSERT INTO "user-audit" (note) VALUES ('x')`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.verb).toBe("INSERT");
			expect(r.table).toBe("user-audit");
		}
	});

	it("handles DELETE FROM ONLY", () => {
		const r = parseWritableAdminSql(`DELETE FROM ONLY profiles WHERE false`, allow);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});
});
