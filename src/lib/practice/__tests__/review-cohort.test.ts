import { describe, expect, it } from "vitest";

import { isStudentInRolloutPct, studentInReviewCohort } from "@/lib/practice/review-cohort";

describe("isStudentInRolloutPct", () => {
	it("0% excludes everyone, 100% includes everyone", () => {
		expect(isStudentInRolloutPct("any-student", 0)).toBe(false);
		expect(isStudentInRolloutPct("any-student", 100)).toBe(true);
	});

	it("is deterministic per student", () => {
		expect(isStudentInRolloutPct("student-xyz", 50)).toBe(isStudentInRolloutPct("student-xyz", 50));
	});

	it("includes roughly pct% of a large population", () => {
		const ids = Array.from({ length: 2000 }, (_, i) => `student-${i}`);
		const included = ids.filter((id) => isStudentInRolloutPct(id, 30)).length;
		// ~600 expected; generous tolerance for hash distribution.
		expect(included).toBeGreaterThan(480);
		expect(included).toBeLessThan(720);
	});

	it("is monotonic — included at p% ⇒ included at a higher %", () => {
		const id = "student-42";
		if (isStudentInRolloutPct(id, 20)) {
			expect(isStudentInRolloutPct(id, 60)).toBe(true);
		}
	});
});

describe("studentInReviewCohort", () => {
	it("includes an allowlisted org regardless of pct", () => {
		expect(
			studentInReviewCohort({ studentId: "s", orgId: "org-1", rolloutPct: 0, cohortOrgIds: ["org-1"] }),
		).toBe(true);
	});

	it("excludes when org not allowlisted and pct is 0", () => {
		expect(
			studentInReviewCohort({ studentId: "s", orgId: "org-2", rolloutPct: 0, cohortOrgIds: ["org-1"] }),
		).toBe(false);
	});

	it("falls back to the percentage rollout when no org match", () => {
		expect(
			studentInReviewCohort({ studentId: "s", orgId: null, rolloutPct: 100, cohortOrgIds: [] }),
		).toBe(true);
	});
});
