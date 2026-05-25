import type {
	TeacherSubmissionAssignmentBundle,
	TopicSubmissionAggRow,
} from "@/lib/assignments/teacher-submissions-hub-types";

export type TeacherSubmissionBucket = "ongoing" | "completed" | "past";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseDueAtMs(dueAt: string | null): number | null {
	if (!dueAt) return null;
	const ms = new Date(dueAt).getTime();
	return Number.isFinite(ms) ? ms : null;
}

/**
 * Classifies a published assignment into Ongoing, Completed, or Past.
 * Past wins when due more than 7 days ago; otherwise Ongoing if still before due
 * (or no due) with outstanding hand-ins; else Completed.
 */
export function classifyTeacherSubmissionBucket(
	bundle: Pick<TeacherSubmissionAssignmentBundle, "dueAt" | "counts">,
	now: Date = new Date(),
): TeacherSubmissionBucket {
	const dueMs = parseDueAtMs(bundle.dueAt);
	const nowMs = now.getTime();

	if (dueMs != null && dueMs < nowMs - ONE_WEEK_MS) {
		return "past";
	}

	if (bundle.counts.notSubmitted > 0 && (dueMs == null || dueMs >= nowMs)) {
		return "ongoing";
	}

	return "completed";
}

export function partitionTeacherSubmissionBundles(
	bundles: TeacherSubmissionAssignmentBundle[],
	now: Date = new Date(),
): Record<TeacherSubmissionBucket, TeacherSubmissionAssignmentBundle[]> {
	const result: Record<TeacherSubmissionBucket, TeacherSubmissionAssignmentBundle[]> = {
		ongoing: [],
		completed: [],
		past: [],
	};
	for (const bundle of bundles) {
		result[classifyTeacherSubmissionBucket(bundle, now)].push(bundle);
	}
	return result;
}

export function getWeakTopicsPreview(
	bundle: Pick<TeacherSubmissionAssignmentBundle, "topicAnalytics">,
	limit = 3,
): TopicSubmissionAggRow[] {
	const withSamples = bundle.topicAnalytics.filter((row) => row.sampleStudents > 0);
	return [...withSamples]
		.sort((a, b) => {
			if (b.badCount !== a.badCount) return b.badCount - a.badCount;
			const aPct = a.cumulativePercent ?? Number.POSITIVE_INFINITY;
			const bPct = b.cumulativePercent ?? Number.POSITIVE_INFINITY;
			return aPct - bPct;
		})
		.slice(0, limit);
}
