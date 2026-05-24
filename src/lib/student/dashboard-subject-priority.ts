import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { subjectStatusLabelRank } from "@/lib/student/tracker-status-labels";

/**
 * Subset of dashboard subject card fields used for worst-first ordering.
 * Keep in sync with `StudentDashboardSubjectCard` in the dashboard view.
 */
export type SubjectCardForPriority = {
	subjectId: string;
	subjectName: string;
	percentCovered: number;
	topicTotal: number;
	attemptedCount: number;
	status: SubjectStatusLabel;
	scorePercent: number | null;
};

function statusRank(status: SubjectStatusLabel): number {
	return subjectStatusLabelRank(status);
}

/**
 * `null` average score is treated as strictly worse than any numeric score
 * (we map it to -1 for comparison).
 */
function scoreKey(scorePercent: number | null): number {
	return scorePercent == null ? -1 : scorePercent;
}

/** Lower return value = worse performance (comes first in “worst first” list). */
export function compareDashboardSubjectsWorstFirst(a: SubjectCardForPriority, b: SubjectCardForPriority): number {
	const byStatus = statusRank(a.status) - statusRank(b.status);
	if (byStatus !== 0) return byStatus;
	const as = scoreKey(a.scorePercent);
	const bs = scoreKey(b.scorePercent);
	if (as !== bs) return as - bs;
	if (a.percentCovered !== b.percentCovered) {
		return a.percentCovered - b.percentCovered;
	}
	return a.subjectName.localeCompare(b.subjectName);
}

export type PartitionDashboardSubjectsResult<T extends SubjectCardForPriority> = {
	priority: T[];
	rest: T[];
};

/**
 * Splits subjects into up to two “priority” full cards (only subjects with
 * `topicTotal > 0`) and the rest, all ordered worst-first.
 */
export function partitionDashboardSubjectsByPriority<T extends SubjectCardForPriority>(
	cards: ReadonlyArray<T>,
	maxPriority: number = 2,
): PartitionDashboardSubjectsResult<T> {
	if (cards.length === 0) {
		return { priority: [], rest: [] };
	}

	const eligible = cards.filter((c) => c.topicTotal > 0);
	const ineligible: T[] = cards.filter((c) => c.topicTotal <= 0);
	const eligibleSorted = [...eligible].sort(compareDashboardSubjectsWorstFirst);

	const priority = eligibleSorted.slice(0, maxPriority) as T[];
	const priorityIds = new Set(priority.map((c) => c.subjectId));
	const notChosenEligible = eligibleSorted.filter((c) => !priorityIds.has(c.subjectId)) as T[];
	const restCandidates = [...notChosenEligible, ...ineligible];
	const rest = restCandidates.sort(compareDashboardSubjectsWorstFirst);

	return { priority, rest };
}
