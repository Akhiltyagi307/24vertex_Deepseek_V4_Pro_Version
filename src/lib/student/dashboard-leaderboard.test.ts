import { describe, expect, it } from "vitest";

import {
	buildLeaderboardScopeResult,
	filterTestsInLast30Days,
	formatLeaderboardCohortDescription,
	formatLeaderboardDisplayName,
	type LeaderboardCohortMember,
	type LeaderboardTestEvent,
} from "@/lib/student/dashboard-leaderboard";

const cohort: LeaderboardCohortMember[] = [
	{ id: "s1", displayName: "Alex M." },
	{ id: "s2", displayName: "Blake T." },
	{ id: "s3", displayName: "Casey R." },
	{ id: "viewer", displayName: "You V." },
];

describe("dashboard-leaderboard", () => {
	it("formats cohort description for dashboard card", () => {
		expect(
			formatLeaderboardCohortDescription(
				{ cohortKind: "organization", cohortLabel: "North High" },
				"student",
			),
		).toBe("Students at North High");
		expect(
			formatLeaderboardCohortDescription(
				{ cohortKind: "independent", cohortLabel: "Independent learners" },
				"student",
			),
		).toBe("All students on 24Vertex in your grade");
		expect(
			formatLeaderboardCohortDescription(
				{ cohortKind: "independent", cohortLabel: "Independent learners" },
				"parent",
			),
		).toBe("All 24Vertex students in their grade");
	});

	it("formats display names", () => {
		expect(formatLeaderboardDisplayName("Aanya Sharma")).toBe("Aanya S.");
		expect(formatLeaderboardDisplayName(null)).toBe("Student");
		expect(formatLeaderboardDisplayName("Madonna")).toBe("Madonna");
	});

	it("filters events to last 30 days by date key", () => {
		const now = new Date("2026-05-21T12:00:00Z");
		const events: LeaderboardTestEvent[] = [
			{ studentId: "s1", subjectId: "math", percent: 80, dateKey: "2026-04-20" },
			{ studentId: "s1", subjectId: "math", percent: 90, dateKey: "2026-05-15" },
		];
		const filtered = filterTestsInLast30Days(events, now);
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.dateKey).toBe("2026-05-15");
	});

	it("ranks by average desc with top five and viewer row", () => {
		const events: LeaderboardTestEvent[] = [
			{ studentId: "s1", subjectId: "math", percent: 90, dateKey: "2026-05-10" },
			{ studentId: "s2", subjectId: "math", percent: 70, dateKey: "2026-05-11" },
			{ studentId: "viewer", subjectId: "math", percent: 60, dateKey: "2026-05-12" },
			{ studentId: "s3", subjectId: "math", percent: 50, dateKey: "2026-05-13" },
		];
		const result = buildLeaderboardScopeResult({
			cohort,
			events,
			viewerStudentId: "viewer",
		});
		expect(result.topFive.map((r) => r.studentId)).toEqual(["s1", "s2", "viewer", "s3"]);
		expect(result.rankedCount).toBe(4);
		expect(result.cohortSize).toBe(4);
		expect(result.viewer).toEqual({
			rank: 3,
			averagePercent: 60,
			testsCount: 1,
			inTopFive: true,
		});
	});

	it("shows viewer outside top five when rank is lower", () => {
		const events: LeaderboardTestEvent[] = [
			{ studentId: "s1", subjectId: "math", percent: 95, dateKey: "2026-05-10" },
			{ studentId: "s2", subjectId: "math", percent: 94, dateKey: "2026-05-10" },
			{ studentId: "s3", subjectId: "math", percent: 93, dateKey: "2026-05-10" },
			{ studentId: "s4", subjectId: "math", percent: 92, dateKey: "2026-05-10" },
			{ studentId: "s5", subjectId: "math", percent: 91, dateKey: "2026-05-10" },
			{ studentId: "viewer", subjectId: "math", percent: 50, dateKey: "2026-05-10" },
		];
		const extra = [
			...cohort,
			{ id: "s4", displayName: "Dana L." },
			{ id: "s5", displayName: "Evan K." },
		];
		const result = buildLeaderboardScopeResult({
			cohort: extra,
			events,
			viewerStudentId: "viewer",
		});
		expect(result.topFive).toHaveLength(5);
		expect(result.topFive.some((r) => r.studentId === "viewer")).toBe(false);
		expect(result.viewer?.inTopFive).toBe(false);
		expect(result.viewer?.rank).toBe(6);
	});

	it("filters by subject scope", () => {
		const events: LeaderboardTestEvent[] = [
			{ studentId: "s1", subjectId: "math", percent: 90, dateKey: "2026-05-10" },
			{ studentId: "s1", subjectId: "physics", percent: 40, dateKey: "2026-05-10" },
		];
		const math = buildLeaderboardScopeResult({
			cohort,
			events,
			viewerStudentId: "s1",
			scopeSubjectId: "math",
		});
		expect(math.topFive[0]?.averagePercent).toBe(90);
	});
});
