import { describe, expect, it } from "vitest";

import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import {
	classifyAssignmentUrgency,
	filterOpenAssignments,
	formatAssignmentsCardTitle,
	formatOpenAssignmentsSummaryLine,
	isOpenAssignmentLifecycleStatus,
	sortOpenAssignmentsByUrgency,
	summarizeOpenAssignments,
} from "@/lib/student/dashboard-open-assignments";

function card(partial: Partial<StudentAssignmentCard> & Pick<StudentAssignmentCard, "id" | "lifecycleStatus">): StudentAssignmentCard {
	return {
		assignmentId: "a1",
		title: "Test",
		instructions: null,
		testId: null,
		score: null,
		dueAt: null,
		createdAt: null,
		submittedAt: null,
		gradedAt: null,
		subjectName: null,
		...partial,
	};
}

describe("dashboard-open-assignments", () => {
	it("filters to open lifecycle statuses only", () => {
		const rows = [
			card({ id: "1", lifecycleStatus: "ready" }),
			card({ id: "2", lifecycleStatus: "graded" }),
			card({ id: "3", lifecycleStatus: "in_progress" }),
		];
		expect(filterOpenAssignments(rows).map((r) => r.id)).toEqual(["1", "3"]);
	});

	it("classifies urgency from due date", () => {
		const now = new Date("2026-05-21T12:00:00Z");
		expect(classifyAssignmentUrgency(null, now)).toBe("no_due");
		expect(classifyAssignmentUrgency("2026-05-20T12:00:00Z", now)).toBe("overdue");
		expect(classifyAssignmentUrgency("2026-05-22T12:00:00Z", now)).toBe("due_soon");
		expect(classifyAssignmentUrgency("2026-06-01T12:00:00Z", now)).toBe("on_track");
	});

	it("sorts overdue before due soon, then by nearest due date", () => {
		const now = new Date("2026-05-21T12:00:00Z");
		const rows = [
			card({ id: "later", lifecycleStatus: "ready", dueAt: "2026-05-25T12:00:00Z", createdAt: "2026-05-01T00:00:00Z" }),
			card({ id: "overdue", lifecycleStatus: "in_progress", dueAt: "2026-05-19T12:00:00Z", createdAt: "2026-05-10T00:00:00Z" }),
			card({ id: "soon", lifecycleStatus: "ready", dueAt: "2026-05-22T12:00:00Z", createdAt: "2026-05-15T00:00:00Z" }),
			card({ id: "nodue", lifecycleStatus: "ready", dueAt: null, createdAt: "2026-05-20T00:00:00Z" }),
		];
		expect(sortOpenAssignmentsByUrgency(rows, now).map((r) => r.id)).toEqual([
			"overdue",
			"soon",
			"later",
			"nodue",
		]);
	});

	it("recognizes open statuses", () => {
		expect(isOpenAssignmentLifecycleStatus("ready")).toBe(true);
		expect(isOpenAssignmentLifecycleStatus("submitted")).toBe(false);
	});

	it("summarizes open assignments by urgency", () => {
		const now = new Date("2026-05-21T12:00:00Z");
		const rows = [
			card({ id: "1", lifecycleStatus: "ready", dueAt: "2026-05-19T12:00:00Z" }),
			card({ id: "2", lifecycleStatus: "in_progress", dueAt: "2026-05-22T12:00:00Z" }),
			card({ id: "3", lifecycleStatus: "ready", dueAt: null }),
		];
		expect(summarizeOpenAssignments(rows, now)).toEqual({ open: 3, overdue: 1, dueSoon: 1 });
	});

	it("formats summary line and omits zero segments", () => {
		expect(formatOpenAssignmentsSummaryLine({ open: 0, overdue: 0, dueSoon: 0 }, "student")).toBe(
			"No open assignments",
		);
		expect(formatOpenAssignmentsSummaryLine({ open: 2, overdue: 1, dueSoon: 1 }, "student")).toBe(
			"1 overdue · 1 due this week · 2 open",
		);
	});

	it("formats card title by urgency and variant", () => {
		const empty = { open: 0, overdue: 0, dueSoon: 0 };
		const urgent = { open: 2, overdue: 1, dueSoon: 0 };
		const calm = { open: 1, overdue: 0, dueSoon: 0 };

		expect(formatAssignmentsCardTitle(empty, false, "student")).toBe("All caught up");
		expect(formatAssignmentsCardTitle(urgent, true, "student")).toBe("Due soon");
		expect(formatAssignmentsCardTitle(calm, true, "student")).toBe("Assignments");
		expect(formatAssignmentsCardTitle(empty, false, "parent")).toBe("All caught up");
		expect(formatAssignmentsCardTitle(urgent, true, "parent")).toBe("Child's open work");
	});
});
