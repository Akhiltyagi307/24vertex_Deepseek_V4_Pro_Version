import { describe, expect, it } from "vitest";

import {
	compareDashboardSubjectsWorstFirst,
	partitionDashboardSubjectsByPriority,
	type SubjectCardForPriority,
} from "@/lib/student/dashboard-subject-priority";
import { TRACKER_STATUS_LABELS } from "@/lib/student/tracker-status-labels";

function card(overrides: Partial<SubjectCardForPriority>): SubjectCardForPriority {
	return {
		subjectId: "default",
		subjectName: "Subject",
		percentCovered: 50,
		topicTotal: 10,
		attemptedCount: 5,
		status: TRACKER_STATUS_LABELS.satisfactory,
		scorePercent: 50,
		...overrides,
	};
}

describe("dashboard-subject-priority", () => {
	it("orders Strengthen before On track before Strong", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.good });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeGreaterThan(0);
		expect(compareDashboardSubjectsWorstFirst(b, a)).toBeLessThan(0);
	});

	it("breaks ties by lower scorePercent", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.bad, scorePercent: 20, percentCovered: 50 });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad, scorePercent: 80, percentCovered: 50 });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeLessThan(0);
	});

	it("treats null scorePercent as worse than any number", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.bad, scorePercent: 0, percentCovered: 10 });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad, scorePercent: null, percentCovered: 10 });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeGreaterThan(0);
	});

	it("breaks ties by lower percentCovered", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.bad, scorePercent: 50, percentCovered: 20 });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad, scorePercent: 50, percentCovered: 60 });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeLessThan(0);
	});

	it("breaks ties by subject name", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.bad, scorePercent: 50, percentCovered: 50, subjectName: "Zeta" });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad, scorePercent: 50, percentCovered: 50, subjectName: "Alpha" });
		expect(compareDashboardSubjectsWorstFirst(a, b)).toBeGreaterThan(0);
	});

	it("partition picks up to two eligible worst-first subjects", () => {
		const a = card({ subjectId: "a", status: TRACKER_STATUS_LABELS.bad, topicTotal: 5, percentCovered: 10, scorePercent: 10 });
		const b = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.good, topicTotal: 0 });
		const c = card({ subjectId: "c", status: TRACKER_STATUS_LABELS.satisfactory, topicTotal: 8, percentCovered: 40, scorePercent: 55 });
		const { priority, rest } = partitionDashboardSubjectsByPriority([a, b, c], 2);
		expect(priority.map((x) => x.subjectId)).toEqual(["a", "c"]);
		expect(rest.map((x) => x.subjectId)).toEqual(["b"]);
	});

	it("sorts mixed list worst-first in rest", () => {
		const good = card({ subjectId: "g", status: TRACKER_STATUS_LABELS.good, scorePercent: 90, percentCovered: 90 });
		const bad = card({ subjectId: "b", status: TRACKER_STATUS_LABELS.bad, scorePercent: 10, percentCovered: 20 });
		const sat = card({ subjectId: "s", status: TRACKER_STATUS_LABELS.satisfactory, scorePercent: 60, percentCovered: 50 });
		const { priority, rest } = partitionDashboardSubjectsByPriority([good, bad, sat], 1);
		expect(priority[0]?.subjectId).toBe("b");
		expect(rest.map((x) => x.subjectId)).toEqual(["s", "g"]);
	});
});
