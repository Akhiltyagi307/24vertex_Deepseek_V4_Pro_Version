import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";

/** Kanban "To do" + "In progress" — not yet submitted. */
export const OPEN_ASSIGNMENT_LIFECYCLE_STATUSES = new Set([
	"pending_materialize",
	"ready",
	"failed_generation",
	"in_progress",
]);

export type AssignmentUrgency = "overdue" | "due_soon" | "on_track" | "no_due";

export function isOpenAssignmentLifecycleStatus(status: string): boolean {
	return OPEN_ASSIGNMENT_LIFECYCLE_STATUSES.has(status);
}

export function filterOpenAssignments(assignments: StudentAssignmentCard[]): StudentAssignmentCard[] {
	return assignments.filter((a) => isOpenAssignmentLifecycleStatus(a.lifecycleStatus));
}

export function classifyAssignmentUrgency(dueAt: string | null, now: Date = new Date()): AssignmentUrgency {
	if (!dueAt) return "no_due";
	const due = new Date(dueAt);
	if (Number.isNaN(due.getTime())) return "no_due";
	if (due.getTime() < now.getTime()) return "overdue";
	const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
	if (due.getTime() - now.getTime() <= threeDaysMs) return "due_soon";
	return "on_track";
}

function urgencySortRank(urgency: AssignmentUrgency): number {
	switch (urgency) {
		case "overdue":
			return 0;
		case "due_soon":
			return 1;
		case "on_track":
			return 2;
		case "no_due":
			return 3;
	}
}

/** Overdue first, then nearest due date, null due last, then newest created. */
export type OpenAssignmentsSummary = {
	open: number;
	overdue: number;
	dueSoon: number;
};

export function summarizeOpenAssignments(
	assignments: StudentAssignmentCard[],
	now: Date = new Date(),
): OpenAssignmentsSummary {
	let overdue = 0;
	let dueSoon = 0;
	for (const assignment of assignments) {
		const urgency = classifyAssignmentUrgency(assignment.dueAt, now);
		if (urgency === "overdue") overdue += 1;
		if (urgency === "due_soon") dueSoon += 1;
	}
	return { open: assignments.length, overdue, dueSoon };
}

/** Compact header line; omits zero segments. */
export function formatOpenAssignmentsSummaryLine(
	summary: OpenAssignmentsSummary,
	variant: "student" | "parent",
): string {
	const parts: string[] = [];
	if (summary.overdue > 0) {
		parts.push(
			`${summary.overdue} overdue`,
		);
	}
	if (summary.dueSoon > 0) {
		parts.push(`${summary.dueSoon} due this week`);
	}
	if (summary.open > 0) {
		parts.push(`${summary.open} open`);
	}
	if (parts.length === 0) {
		return variant === "parent" ? "No open assignments for them" : "No open assignments";
	}
	return parts.join(" · ");
}

/** Card title: positive empty state; urgency title only when due soon or overdue. */
export function formatAssignmentsCardTitle(
	summary: OpenAssignmentsSummary,
	hasOpen: boolean,
	variant: "student" | "parent",
): string {
	if (variant === "parent") {
		return hasOpen ? "Child's open work" : "All caught up";
	}
	if (!hasOpen) return "All caught up";
	if (summary.overdue > 0 || summary.dueSoon > 0) return "Due soon";
	return "Assignments";
}

export function sortOpenAssignmentsByUrgency(
	assignments: StudentAssignmentCard[],
	now: Date = new Date(),
): StudentAssignmentCard[] {
	return [...assignments].sort((a, b) => {
		const ua = classifyAssignmentUrgency(a.dueAt, now);
		const ub = classifyAssignmentUrgency(b.dueAt, now);
		const byUrgency = urgencySortRank(ua) - urgencySortRank(ub);
		if (byUrgency !== 0) return byUrgency;

		const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
		const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
		if (dueA !== dueB) return dueA - dueB;

		const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		return createdB - createdA;
	});
}

