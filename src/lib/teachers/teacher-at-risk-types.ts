/** Shared shape for teacher dashboard at-risk list (client + server). */

export type TeacherAtRiskStudentRow = {
	studentId: string;
	fullName: string;
	severityScore: number;
	lastFiveAveragePercent: number | null;
	gradedItemsUsed: number;
	overdueAssignments: number;
	lateAssignments: number;
	lowScoredAssignments: number;
	summary: string;
};
