import { describe, expect, it } from "vitest";

import {
	compareDashboardSubjectsWorstFirst,
	partitionDashboardSubjectsByPriority,
	type SubjectCardForPriority,
} from "@/lib/student/dashboard-subject-priority";

function card(partial: Partial<SubjectCardForPriority> & Pick<SubjectCardForPriority, "subjectId">): SubjectCardForPriority {
	return {
		subjectName: partial.subjectId,
		percentCovered: 0,
		topicTotal: 10,
		attemptedCount: 0,
		status: "Satisfactory",
		scorePercent: 50,
		...partial,
	};
}

describe("compareDashboardSubjectsWorstFirst", () => {
	it("orders Bad before Satisfactory before Good", () => {
		const a = card({ subjectId: "a", status: "Good" });
		const b = card({ subjectId: "b", status: "Bad" });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeGreaterThan(0);
		expect(compareDashboardSubjectsWorstFirst(b, a)).toBeLessThan(0);
	});

	it("uses lower score as tie-breaker", () => {
		const a = card({ subjectId: "a", status: "Bad", scorePercent: 20, percentCovered: 50 });
		const b = card({ subjectId: "b", status: "Bad", scorePercent: 80, percentCovered: 50 });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeLessThan(0);
	});

	it("treats null score as worse than any number", () => {
		const a = card({ subjectId: "a", status: "Bad", scorePercent: 0, percentCovered: 10 });
		const b = card({ subjectId: "b", status: "Bad", scorePercent: null, percentCovered: 10 });
		expect(compareDashboardSubjectsWorstFirst(b, a)).toBeLessThan(0);
	});

	it("uses lower percentCovered as tie-breaker", () => {
		const a = card({ subjectId: "a", status: "Bad", scorePercent: 50, percentCovered: 20 });
		const b = card({ subjectId: "b", status: "Bad", scorePercent: 50, percentCovered: 60 });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeLessThan(0);
	});

	it("breaks ties with subjectName", () => {
		const a = card({ subjectId: "a", status: "Bad", scorePercent: 50, percentCovered: 50, subjectName: "Zeta" });
		const b = card({ subjectId: "b", status: "Bad", scorePercent: 50, percentCovered: 50, subjectName: "Alpha" });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeGreaterThan(0);
	});
});

describe("partitionDashboardSubjectsByPriority", () => {
	it("excludes zero-topic subjects from priority and keeps them in rest", () => {
		const a = card({ subjectId: "a", status: "Bad", topicTotal: 5, percentCovered: 10, scorePercent: 10 });
		const b = card({ subjectId: "b", status: "Good", topicTotal: 0 });
		const { priority, rest } = partitionDashboardSubjectsByPriority([b, a]);
		expect(priority).toEqual([a]);
		expect(rest.map((c) => c.subjectId).sort()).toEqual([b.subjectId].sort());
	});

	it("takes the two worst eligible subjects for priority", () => {
		const good = card({ subjectId: "g", status: "Good", scorePercent: 90, percentCovered: 90 });
		const bad = card({ subjectId: "b", status: "Bad", scorePercent: 10, percentCovered: 20 });
		const sat = card({ subjectId: "s", status: "Satisfactory", scorePercent: 60, percentCovered: 50 });
		const { priority, rest } = partitionDashboardSubjectsByPriority([good, sat, bad]);
		expect(priority.map((c) => c.subjectId)).toEqual([bad.subjectId, sat.subjectId]);
		expect(rest).toEqual([good]);
	});

	it("returns empty when given no cards", () => {
		expect(partitionDashboardSubjectsByPriority([])).toEqual({ priority: [], rest: [] });
	});
});
