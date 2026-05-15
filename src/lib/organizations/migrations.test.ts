import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { describe, expect, it } from "vitest";

// Anchor to this file's location so the path is stable regardless of cwd.
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "supabase", "migrations");

function readMigration(fileName: string) {
	return readFileSync(join(migrationsDir, fileName), "utf8");
}

describe("organization SQL migration invariants", () => {
	it("preserves Option A by not revoking independent teacher links when a student changes org", () => {
		const sql = readMigration("20260616170000_organizations_access.sql");
		const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.student_set_organization");
		const end = sql.indexOf("CREATE OR REPLACE FUNCTION public.teacher_join_organization");
		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);

		const studentSetOrganization = sql.slice(start, end);
		expect(studentSetOrganization).toContain("UPDATE public.profiles");
		expect(studentSetOrganization).not.toContain("teacher_student_links");
	});

	it("keeps teacher access limited to same active org or direct active teacher-student link", () => {
		const sql = readMigration("20260616170000_organizations_access.sql");
		const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.teacher_can_access_student");
		const end = sql.indexOf("REVOKE ALL ON FUNCTION public.teacher_can_access_student");
		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);

		const accessFunction = sql.slice(start, end);
		expect(accessFunction).toContain("public.teacher_organization_memberships tom");
		expect(accessFunction).toContain("tom.status = 'active'");
		expect(accessFunction).toContain("tom.organization_id = s.organization_id");
		expect(accessFunction).toContain("public.teacher_student_links tsl");
		expect(accessFunction).toContain("tsl.status = 'active'");
	});

	it("cleans students and active teacher memberships when an organization is deactivated", () => {
		const sql = readMigration("20260616191000_organization_deactivation_cleanup_trigger.sql");
		expect(sql).toContain("UPDATE public.profiles");
		expect(sql).toContain("organization_id = NULL");
		expect(sql).toContain("UPDATE public.teacher_organization_memberships");
		expect(sql).toContain("status = 'revoked'");
		expect(sql).toContain("organizations_cleanup_on_deactivate_trigger");
	});

	it("keeps public organization favicons on raster/icon formats only", () => {
		const sql = readMigration("20260616190000_restrict_organization_favicon_mimes.sql");
		expect(sql).toContain("image/png");
		expect(sql).toContain("image/jpeg");
		expect(sql).toContain("image/webp");
		expect(sql).not.toContain("image/svg+xml");
	});
});
