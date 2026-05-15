import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "supabase", "migrations");

function readAssignmentMigration() {
	const fileName = readdirSync(migrationsDir).find((name) =>
		name.endsWith("_educator_practice_assignments.sql"),
	);
	expect(fileName).toBeDefined();
	return readFileSync(join(migrationsDir, fileName!), "utf8");
}

function readAssignmentHardeningMigration() {
	const fileName = readdirSync(migrationsDir).find((name) =>
		name.endsWith("_harden_educator_practice_assignments.sql"),
	);
	expect(fileName).toBeDefined();
	return readFileSync(join(migrationsDir, fileName!), "utf8");
}

function readFinalAssignmentMigration() {
	const fileName = readdirSync(migrationsDir).find((name) =>
		name.endsWith("_educator_practice_assignments_final_hardening.sql"),
	);
	expect(fileName).toBeDefined();
	return readFileSync(join(migrationsDir, fileName!), "utf8");
}

describe("educator practice assignment migration", () => {
	it("creates a flexible assignment spine with per-student lifecycle rows", () => {
		const sql = readAssignmentMigration();

		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignments");
		expect(sql).toContain("assignment_kind");
		expect(sql).toContain("config JSONB NOT NULL");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignment_submissions");
		expect(sql).toContain("lifecycle_status");
		expect(sql).toContain("UNIQUE (assignment_id, student_id)");
	});

	it("links assigned tests and queue jobs without widening direct client writes", () => {
		const sql = readAssignmentMigration();

		expect(sql).toContain("ALTER TABLE public.tests");
		expect(sql).toContain("assignment_submission_id");
		expect(sql).toContain("test_type IN ('self', 'assigned')");
		expect(sql).toContain("'assign_generate_test'");
		expect(sql).toContain("assignment_submission_id uuid");
		expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
		expect(sql).toContain("public.teacher_can_access_student");
	});

	it("keeps self-practice abandonment away from educator-assigned tests", () => {
		const sql = readAssignmentMigration();
		const hardeningSql = readAssignmentHardeningMigration();

		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.practice_generate_test");
		expect(sql).toContain("COALESCE(test_type, 'self') = 'self'");
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.practice_generate_assigned_test");
		expect(sql).toContain("'assigned'");
		expect(hardeningSql).toContain("DROP INDEX IF EXISTS public.tests_one_active_per_subject_uidx");
		expect(hardeningSql).toContain("COALESCE(test_type, 'self') = 'self'");
	});

	it("hardens assigned generation and exposes only narrow lifecycle updates", () => {
		const sql = readAssignmentHardeningMigration();

		expect(sql).toContain("RAISE EXCEPTION 'Workers only'");
		expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.practice_generate_assigned_test");
		expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.practice_generate_assigned_test");
		expect(sql).toContain("TO service_role");
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.assignment_mark_submission_in_progress");
		expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.assignment_mark_submission_in_progress(UUID) TO authenticated");
	});

	it("ships a final post-teardown schema and RPC hardening migration", () => {
		const sql = readFinalAssignmentMigration();

		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignments");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignment_submissions");
		expect(sql).toContain("test_type IN ('self', 'assigned')");
		expect(sql).toContain("idx_tests_assignment_submission_uq");
		expect(sql).toContain("practice_jobs_assignment_generate_active_uq");
		expect(sql).toContain("practice_jobs_required_ids_check");
		expect(sql).toContain("COALESCE(test_type, 'self') = 'self'");
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.practice_claim_jobs");
		expect(sql).toContain("assignment_submission_id uuid");
		expect(sql).toContain("auth.role() <> 'service_role'");
		expect(sql).toContain("REVOKE ALL ON FUNCTION public.practice_claim_jobs(TEXT, TEXT[], INT) FROM PUBLIC, anon, authenticated");
		expect(sql).toContain("DROP FUNCTION IF EXISTS public.assignment_enqueue_generate_test(UUID, TIMESTAMPTZ)");
		expect(sql).toContain("DROP INDEX IF EXISTS public.idx_assignment_submissions_assignment_student_uq");
	});
});
