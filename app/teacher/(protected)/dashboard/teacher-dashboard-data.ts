import "server-only";

import { unstable_cache } from "next/cache";

import { listTeacherAtRiskStudentsForRoster } from "@/lib/teachers/teacher-at-risk-queries";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";
import { getTeacherClassPerformanceSummaryForRoster } from "@/lib/teachers/teacher-class-performance-summary";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import { listTeacherPerformanceDirectoryStudents } from "@/lib/teachers/teacher-performance-directory-queries";

export type TeacherDashboardFilters = {
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
};

export type TeacherDashboardBundle = {
	summary: TeacherClassPerformanceSummary;
	atRiskRows: TeacherAtRiskStudentRow[];
};

/** Tag a teacher's dashboard cache so org/student-link mutations can bust it. */
export function teacherDashboardCacheTag(teacherId: string): string {
	return `teacher-dashboard:${teacherId}`;
}

async function computeTeacherDashboardBundle(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	filters: TeacherDashboardFilters;
}): Promise<TeacherDashboardBundle> {
	const { teacherId, activeOrganizationId, filters } = params;
	const grade = filters.grade === "all" ? undefined : filters.grade;
	const section = filters.section === "all" ? undefined : filters.section;
	const subjectId = filters.subjectId === "all" ? undefined : filters.subjectId;

	// Roster is the input dependency for both downstream queries; run it serially
	// first, then fan out summary + at-risk in parallel. Confirmed optimal — see
	// audit reconciliation notes (D14): no further parallelization possible.
	const roster = await listTeacherPerformanceDirectoryStudents({
		teacherId,
		activeOrganizationId,
		grade,
		section,
		subjectId,
	});

	const [summary, atRiskRows] = await Promise.all([
		getTeacherClassPerformanceSummaryForRoster({
			teacherId,
			roster,
			subjectId,
		}),
		listTeacherAtRiskStudentsForRoster({
			teacherId,
			roster,
			subjectId,
		}),
	]);

	return { summary, atRiskRows };
}

/**
 * Server-only dashboard loader. `teacherId` must come from the authenticated,
 * verified teacher session guard; this module is not a direct request boundary.
 *
 * The unfiltered (grade/section/subject all = "all") path is the dominant
 * initial-render shape, so we cache that case for 60 seconds and tag with
 * `teacher-dashboard:${teacherId}` so org/student-link mutations can bust it.
 * Filter-scoped reads bypass the cache — their hit rate would be near zero
 * with high-cardinality keys.
 */
export async function loadTeacherDashboardBundleForTeacher(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	filters: TeacherDashboardFilters;
}): Promise<TeacherDashboardBundle> {
	const isUnfiltered =
		params.filters.grade === "all" &&
		params.filters.section === "all" &&
		params.filters.subjectId === "all";

	if (!isUnfiltered) {
		return computeTeacherDashboardBundle(params);
	}

	const cached = unstable_cache(
		async () => computeTeacherDashboardBundle(params),
		[
			"teacher-dashboard-bundle",
			params.teacherId,
			params.activeOrganizationId ?? "none",
		],
		{
			revalidate: 60,
			tags: [teacherDashboardCacheTag(params.teacherId)],
		},
	);
	return cached();
}
