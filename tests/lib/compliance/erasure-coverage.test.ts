import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

/**
 * Drift-guard for GDPR erasure coverage (review finding M7).
 *
 * `performComplianceErasure` deletes the subject's rows table-by-table from a
 * HAND-MAINTAINED list. If a new student-identified table is added but not added
 * to that list, the subject's data silently survives erasure — a compliance gap.
 *
 * This test enumerates every schema table that carries a student-identifying
 * column and fails unless each is consciously classified as ERASE (deleted in
 * erasure.ts) or RETAIN (kept, with a documented legal/operational reason). A new
 * unclassified table breaks the build until someone makes the call.
 *
 * Scope: `student_id` / `recipient_id` columns (the columns erasure targets the
 * subject by). Tables keyed indirectly (e.g. by `test_id` → student_answers) are
 * erased transitively and are intentionally out of this column-based guard.
 */
const OWNER_COLUMNS = new Set(["student_id", "recipient_id"]);

/** Tables whose subject rows are DELETED. MUST mirror deletes in src/lib/compliance/erasure.ts. */
const ERASE = new Set<string>([
	"performance_tracker",
	"question_flags",
	"doubt_conversations",
	"parent_student_links",
	"assignment_submissions",
	"notifications",
	"test_reports", // deleted via its test_id (erasure.ts deletes by inArray(testReports.testId, testIds))
	// M7 additions — behavioral / engagement data, no legal retention requirement.
	"practice_analytics_events",
	"practice_generation_runs",
	"practice_jobs",
	"student_activity_streaks",
	"teacher_student_links", // M7 gap fix — parity with parent_student_links
]);

/** Tables RETAINED on erasure, each with a documented reason. */
const RETAIN: Record<string, string> = {
	tests: "FERPA — academic record retained; subject PII is anonymized on the profile",
	quota_grants: "billing / entitlement record",
	parental_consents: "legal proof of consent (COPPA/parental-consent law)",
	// FLAGGED for compliance review (M7): operational email deliverability/suppression
	// log. Retained so unsubscribe/bounce suppression keeps working; the recipient
	// email is residual PII that may warrant column-level scrubbing on erasure.
	email_log: "email deliverability/suppression audit log — FLAGGED for review (recipient PII)",
};

describe("compliance erasure classifies every student-identified table (M7 drift-guard)", () => {
	const ownerTables = (Object.values(schema) as unknown[])
		.filter((v): v is PgTable => is(v, PgTable))
		.filter((t) => Object.values(getTableColumns(t)).some((c) => OWNER_COLUMNS.has(c.name)))
		.map((t) => getTableName(t))
		.sort();

	it("finds student-identified tables to classify", () => {
		expect(ownerTables.length).toBeGreaterThan(5);
	});

	for (const name of ownerTables) {
		it(`${name} is classified ERASE or RETAIN`, () => {
			const classified = ERASE.has(name) || name in RETAIN;
			expect(
				classified,
				`Table "${name}" has a student_id/recipient_id column but is not classified for GDPR erasure. ` +
					`Either add a delete in src/lib/compliance/erasure.ts and list it in ERASE, or add it to RETAIN ` +
					`with a documented legal/operational reason, in tests/lib/compliance/erasure-coverage.test.ts.`,
			).toBe(true);
		});
	}
});
