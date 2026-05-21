import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";

export function studentAssignmentCardHref(
	card: StudentAssignmentCard,
	portal: "student" | "parent",
): string | null {
	if (portal === "student" && card.testId && ["ready", "in_progress"].includes(card.lifecycleStatus)) {
		return `/student/practice/${card.testId}`;
	}
	if (portal === "student" && card.testId && card.lifecycleStatus === "graded") {
		return `/student/reports?test=${encodeURIComponent(card.testId)}`;
	}
	if (portal === "student" && card.testId && card.lifecycleStatus === "grading_failed") {
		return `/student/practice/${card.testId}/grading`;
	}
	if (portal === "parent" && card.testId && card.lifecycleStatus === "graded") {
		return `/parent/reports?test=${encodeURIComponent(card.testId)}`;
	}
	return null;
}
