import {
	addCalendarDaysToAppTimeZoneDateKey,
	appTimeZoneDateKey,
} from "@/lib/datetime/app-timezone";

export type LeaderboardScopeId = "overall" | string;

export type LeaderboardScopeLabel = {
	id: LeaderboardScopeId;
	label: string;
};

export type LeaderboardRankedStudent = {
	rank: number;
	studentId: string;
	displayName: string;
	averagePercent: number;
	testsCount: number;
};

export type LeaderboardViewerEntry = {
	rank: number;
	averagePercent: number | null;
	testsCount: number;
	inTopFive: boolean;
};

export type LeaderboardScopeResult = {
	topFive: LeaderboardRankedStudent[];
	viewer: LeaderboardViewerEntry | null;
	/** Students with at least one scored test in this scope (last 30 days). */
	rankedCount: number;
	cohortSize: number;
};

export type LeaderboardCohortKind = "organization" | "independent";

export type StudentDashboardLeaderboardPayload = {
	viewerStudentId: string;
	cohortLabel: string;
	cohortKind: LeaderboardCohortKind;
	cohortSize: number;
	scopeLabels: LeaderboardScopeLabel[];
	byScope: Record<string, LeaderboardScopeResult>;
};

/** Student- and parent-friendly cohort line for the dashboard card subtitle. */
export function formatLeaderboardCohortDescription(
	leaderboard: Pick<StudentDashboardLeaderboardPayload, "cohortKind" | "cohortLabel">,
	variant: "student" | "parent",
): string {
	if (leaderboard.cohortKind === "organization") {
		return variant === "parent"
			? `Students at ${leaderboard.cohortLabel}`
			: `Students at ${leaderboard.cohortLabel}`;
	}
	return variant === "parent"
		? "All 24Vertex students in their grade"
		: "All students on 24Vertex in your grade";
}

export type LeaderboardTestEvent = {
	studentId: string;
	subjectId: string;
	percent: number;
	dateKey: string;
};

export type LeaderboardCohortMember = {
	id: string;
	displayName: string;
};

export function formatLeaderboardDisplayName(fullName: string | null | undefined): string {
	const trimmed = fullName?.trim();
	if (!trimmed) return "Student";
	const parts = trimmed.split(/\s+/).filter(Boolean);
	if (parts.length === 1) return parts[0]!;
	const first = parts[0]!;
	const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase();
	return `${first} ${lastInitial}.`;
}

export function filterTestsInLast30Days(
	events: LeaderboardTestEvent[],
	now: Date = new Date(),
): LeaderboardTestEvent[] {
	const endKey = appTimeZoneDateKey(now);
	const startKey = addCalendarDaysToAppTimeZoneDateKey(endKey, -29);
	return events.filter((e) => e.dateKey >= startKey && e.dateKey <= endKey);
}

export function buildLeaderboardScopeResult(params: {
	cohort: LeaderboardCohortMember[];
	events: LeaderboardTestEvent[];
	viewerStudentId: string;
	scopeSubjectId?: string;
}): LeaderboardScopeResult {
	const { cohort, events, viewerStudentId, scopeSubjectId } = params;
	const scopedEvents =
		scopeSubjectId == null ? events : events.filter((e) => e.subjectId === scopeSubjectId);

	const byStudent = new Map<string, { sum: number; count: number }>();
	for (const event of scopedEvents) {
		const bucket = byStudent.get(event.studentId) ?? { sum: 0, count: 0 };
		bucket.sum += event.percent;
		bucket.count += 1;
		byStudent.set(event.studentId, bucket);
	}

	const ranked: Omit<LeaderboardRankedStudent, "rank">[] = [];
	for (const member of cohort) {
		const stats = byStudent.get(member.id);
		if (!stats || stats.count === 0) continue;
		ranked.push({
			studentId: member.id,
			displayName: member.displayName,
			averagePercent: Math.round(stats.sum / stats.count),
			testsCount: stats.count,
		});
	}

	ranked.sort((a, b) => {
		if (b.averagePercent !== a.averagePercent) return b.averagePercent - a.averagePercent;
		if (b.testsCount !== a.testsCount) return b.testsCount - a.testsCount;
		return a.displayName.localeCompare(b.displayName);
	});

	const topFive: LeaderboardRankedStudent[] = ranked.slice(0, 5).map((row, index) => ({
		...row,
		rank: index + 1,
	}));

	const viewerIndex = ranked.findIndex((r) => r.studentId === viewerStudentId);
	const viewerInTopFive = viewerIndex >= 0 && viewerIndex < 5;

	let viewer: LeaderboardViewerEntry | null = null;
	if (viewerIndex >= 0) {
		const row = ranked[viewerIndex]!;
		viewer = {
			rank: viewerIndex + 1,
			averagePercent: row.averagePercent,
			testsCount: row.testsCount,
			inTopFive: viewerInTopFive,
		};
	} else {
		viewer = {
			rank: 0,
			averagePercent: null,
			testsCount: 0,
			inTopFive: false,
		};
	}

	return {
		topFive,
		viewer,
		rankedCount: ranked.length,
		cohortSize: cohort.length,
	};
}
