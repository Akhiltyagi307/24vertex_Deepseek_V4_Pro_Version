import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"supabase",
	"migrations",
	"20260618143000_teacher_portal_performance_indexes.sql",
);

describe("teacher portal performance index migration", () => {
	it("adds narrow indexes for roster, topic, practice, and graded assignment paths", () => {
		const sql = readFileSync(migrationPath, "utf8");

		expect(sql).toContain("idx_profiles_teacher_org_roster");
		expect(sql).toContain("WHERE role = 'student' AND deleted_at IS NULL");
		expect(sql).toContain("idx_performance_tracker_teacher_topic_scope");
		expect(sql).toContain("WHERE average_score IS NOT NULL AND tests_taken > 0");
		expect(sql).toContain("idx_tests_teacher_recent_self_practice");
		expect(sql).toContain("assignment_submission_id IS NULL");
		expect(sql).toContain("idx_assignment_submissions_teacher_recent_graded");
		expect(sql).toContain("lifecycle_status = 'graded'");
	});
});
