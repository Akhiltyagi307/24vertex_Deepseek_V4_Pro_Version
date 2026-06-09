import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "supabase", "migrations");

function readManualMigration(): string {
	const fileName = readdirSync(migrationsDir).find((name) => name.endsWith("_manual_assignment_authoring.sql"));
	expect(fileName).toBeDefined();
	return readFileSync(join(migrationsDir, fileName!), "utf8");
}

describe("manual assignment authoring migration", () => {
	it("creates the assignment_questions template table with RLS", () => {
		const sql = readManualMigration();
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.assignment_questions");
		expect(sql).toContain("assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE");
		expect(sql).toContain("answer_key JSONB NOT NULL");
		expect(sql).toContain("question_type IN");
		expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
		expect(sql).toContain("public.auth_is_verified_teacher(auth.uid())");
	});

	it("creates a worker-only manual materialization RPC", () => {
		const sql = readManualMigration();
		expect(sql).toContain("CREATE OR REPLACE FUNCTION public.practice_create_manual_assigned_test");
		expect(sql).toContain("auth.role() <> 'service_role'");
		expect(sql).toContain("FROM public.assignment_questions");
		expect(sql).toContain("test_type");
		expect(sql).toContain("lifecycle_status = 'ready'");
		expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.practice_create_manual_assigned_test(UUID) TO service_role");
	});
});
