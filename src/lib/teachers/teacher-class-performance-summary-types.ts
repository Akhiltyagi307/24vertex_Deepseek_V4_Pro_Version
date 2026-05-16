export type TeacherClassPerformanceScope = {
	teacherId: string;
	activeOrganizationId: string | null;
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
};

export type TeacherPerformanceBandId = "strong" | "near_target" | "needs_support" | "at_risk";

export type TeacherPerformanceBandStudent = {
	studentId: string;
	fullName: string;
	grade: number | null;
	section: string | null;
	averagePercent: number;
	recentGradedItemsUsed: number;
};

export type TeacherPerformanceBandSummary = {
	id: TeacherPerformanceBandId;
	label: string;
	rangeLabel: string;
	description: string;
	count: number;
	students: TeacherPerformanceBandStudent[];
};

export type TeacherClassUpliftOpportunity = {
	topicId: string;
	topicName: string;
	subjectName: string;
	averagePercent: number;
	studentsTested: number;
	testsTaken: number;
	studentsBelowSupportLine: number;
};

export type TeacherClassPerformanceSummary = {
	studentsInScope: number;
	studentsWithRecentScores: number;
	classAveragePercent: number | null;
	recentGradedItemsUsed: number;
	recentWindowSize: number;
	performanceBands: TeacherPerformanceBandSummary[];
	upliftOpportunity: TeacherClassUpliftOpportunity | null;
};
