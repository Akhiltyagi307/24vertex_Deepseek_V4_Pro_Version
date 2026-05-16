import "server-only";

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

/**
 * Server-only dashboard loader. `teacherId` must come from the authenticated,
 * verified teacher session guard; this module is not a direct request boundary.
 */
export async function loadTeacherDashboardBundleForTeacher(params: {
	teacherId: string;
	activeOrganizationId: string | null;
	filters: TeacherDashboardFilters;
}): Promise<TeacherDashboardBundle> {
	const { teacherId, activeOrganizationId, filters } = params;
	const grade = filters.grade === "all" ? undefined : filters.grade;
	const section = filters.section === "all" ? undefined : filters.section;
	const subjectId = filters.subjectId === "all" ? undefined : filters.subjectId;

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
