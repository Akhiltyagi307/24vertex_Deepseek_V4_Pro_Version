import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { OrganizationRosterStudentRow } from "@/lib/teachers/roster-types";

export type TeacherPerformanceStudentRow = OrganizationRosterStudentRow;

/** Days without any graded event before a student is considered inactive on the directory. */
export const TEACHER_DIRECTORY_INACTIVE_THRESHOLD_DAYS = 7;

export type TeacherPerformanceDirectoryRow = TeacherPerformanceStudentRow & {
	recentAveragePercent: number | null;
	recentItemsUsed: number;
	band: TeacherPerformanceBandId | null;
	overdueAssignments: number;
	lateAssignments: number;
	lastActivityMs: number | null;
};
