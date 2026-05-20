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

	it("accepts allowlisted UPDATE with RETURNING", () => {
		const r = parseWritableAdminSql(
			`UPDATE profiles SET full_name = full_name WHERE false RETURNING *`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.verb).toBe("UPDATE");
			expect(r.table).toBe("profiles");
		}
	});

	it("rejects non-allowlisted table", () => {
		const r = parseWritableAdminSql("DELETE FROM tests WHERE false RETURNING *", allow);
		expect(r.ok).toBe(false);
	});

	it("parses quoted identifiers with hyphens (previously rejected as unparseable)", () => {
		const r = parseWritableAdminSql(
			`UPDATE "user-audit" SET note = '' WHERE false RETURNING *`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.table).toBe("user-audit");
		}
	});

	it("parses schema-qualified table names", () => {
		const r = parseWritableAdminSql(
			`UPDATE public.profiles SET full_name = '' WHERE false RETURNING *`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});

	it("parses quoted schema + quoted table", () => {
		const r = parseWritableAdminSql(
			`UPDATE "public"."profiles" SET full_name = '' WHERE false RETURNING *`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});

	it("handles INSERT INTO with quoted table", () => {
		const r = parseWritableAdminSql(
			`INSERT INTO "user-audit" (note) VALUES ('x') RETURNING id`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.verb).toBe("INSERT");
			expect(r.table).toBe("user-audit");
		}
	});

	it("handles DELETE FROM ONLY", () => {
		const r = parseWritableAdminSql(
			`DELETE FROM ONLY profiles WHERE false RETURNING id`,
			allow,
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.table).toBe("profiles");
	});

	// D31 / SQL-3: writable SQL must include a RETURNING clause for audit-diff capture.
	describe("D31 / SQL-3: RETURNING enforcement", () => {
		it("rejects UPDATE without RETURNING", () => {
			const r = parseWritableAdminSql(
				`UPDATE profiles SET full_name = '' WHERE false`,
				allow,
			);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.error).toMatch(/RETURNING/i);
		});

		it("rejects INSERT without RETURNING", () => {
			const r = parseWritableAdminSql(
				`INSERT INTO profiles (full_name) VALUES ('x')`,
				allow,
			);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.error).toMatch(/RETURNING/i);
		});

		it("rejects DELETE without RETURNING", () => {
			const r = parseWritableAdminSql(`DELETE FROM profiles WHERE false`, allow);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.error).toMatch(/RETURNING/i);
		});

		it("rejects when RETURNING appears only inside a string literal", () => {
			const r = parseWritableAdminSql(
				`UPDATE profiles SET full_name = 'I want RETURNING' WHERE false`,
				allow,
			);
			expect(r.ok).toBe(false);
			if (!r.ok) expect(r.error).toMatch(/RETURNING/i);
		});

		it("accepts RETURNING <columns>", () => {
			const r = parseWritableAdminSql(
				`UPDATE profiles SET full_name = '' WHERE false RETURNING id, full_name`,
				allow,
			);
			expect(r.ok).toBe(true);
		});
	});
});
