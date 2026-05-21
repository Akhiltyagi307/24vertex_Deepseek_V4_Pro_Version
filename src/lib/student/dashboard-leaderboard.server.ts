import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { tests } from "@/db/schema/assessment";
import { profiles } from "@/db/schema/profiles";
import { getProfileOrganizationSnapshot } from "@/lib/organizations/queries";
import { localDateKey } from "@/lib/student/dashboard-performance-stats";
import {
	buildLeaderboardScopeResult,
	filterTestsInLast30Days,
	formatLeaderboardDisplayName,
	type LeaderboardCohortKind,
	type LeaderboardCohortMember,
	type LeaderboardScopeLabel,
	type LeaderboardTestEvent,
	type StudentDashboardLeaderboardPayload,
	type LeaderboardScopeResult,
} from "@/lib/student/dashboard-leaderboard";

function parseScore(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}

export async function buildStudentDashboardLeaderboardPayload(params: {
	studentId: string;
	organizationId: string | null;
	enrolledSubjects: { id: string; name: string }[];
}): Promise<StudentDashboardLeaderboardPayload> {
	const orgSnapshot =
		params.organizationId != null ? await getProfileOrganizationSnapshot(params.studentId) : null;
	const cohortKind: LeaderboardCohortKind = params.organizationId != null ? "organization" : "independent";
	const cohortLabel = orgSnapshot?.name ?? "Independent learners";

	const cohortCondition =
		params.organizationId != null
			? eq(profiles.organizationId, params.organizationId)
			: isNull(profiles.organizationId);

	const cohortRows = await db
		.select({ id: profiles.id, fullName: profiles.fullName })
		.from(profiles)
		.where(and(eq(profiles.role, "student"), cohortCondition));

	const cohort: LeaderboardCohortMember[] = cohortRows.map((row) => ({
		id: row.id,
		displayName: formatLeaderboardDisplayName(row.fullName),
	}));

	const cohortIds = cohort.map((c) => c.id);
	const testEvents: LeaderboardTestEvent[] = [];

	if (cohortIds.length > 0) {
		const testRows = await db
			.select({
				studentId: tests.studentId,
				subjectId: tests.subjectId,
				totalScore: tests.totalScore,
				testDate: tests.testDate,
			})
			.from(tests)
			.where(
				and(
					inArray(tests.studentId, cohortIds),
					eq(tests.isDraft, false),
					inArray(tests.status, ["submitted", "graded"]),
				),
			);

		for (const row of testRows) {
			if (!row.testDate) continue;
			const td = row.testDate instanceof Date ? row.testDate : new Date(row.testDate);
			if (Number.isNaN(td.getTime())) continue;
			const percent = parseScore(row.totalScore);
			if (percent == null) continue;
			testEvents.push({
				studentId: row.studentId,
				subjectId: row.subjectId,
				percent,
				dateKey: localDateKey(td),
			});
		}
	}

	const events30d = filterTestsInLast30Days(testEvents);

	const scopeLabels: LeaderboardScopeLabel[] = [{ id: "overall", label: "Overall" }];
	for (const subject of params.enrolledSubjects) {
		scopeLabels.push({ id: subject.id, label: subject.name });
	}

	const byScope: Record<string, LeaderboardScopeResult> = {};
	for (const scope of scopeLabels) {
		byScope[scope.id] = buildLeaderboardScopeResult({
			cohort,
			events: events30d,
			viewerStudentId: params.studentId,
			scopeSubjectId: scope.id === "overall" ? undefined : scope.id,
		});
	}

	return {
		viewerStudentId: params.studentId,
		cohortLabel,
		cohortKind,
		cohortSize: cohort.length,
		scopeLabels,
		byScope,
	};
}
