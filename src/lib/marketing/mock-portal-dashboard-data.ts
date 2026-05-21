import type { StudentDashboardViewProps } from "@/components/student/student-dashboard-view";
import type { TeacherDashboardBundle } from "@/app/teacher/(protected)/dashboard/teacher-dashboard-data";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { StudentDashboardLeaderboardPayload } from "@/lib/student/dashboard-leaderboard";

/** Fictional personas for marketing screenshots — no real PII. */
export const MOCK_SCHOOL = "Delhi Public School";

export const MOCK_STUDENT = {
	fullName: "Aanya Sharma",
	email: "aanya.sharma@student.demo",
	gradeLabel: "Grade 10 · Section A",
	linkCode: "VRTX-4821",
} as const;

export const MOCK_PARENT = {
	fullName: "Rajesh Sharma",
	email: "rajesh.sharma@parent.demo",
} as const;

export const MOCK_TEACHER = {
	fullName: "Mrs. Kavita Menon",
	email: "kavita.menon@teacher.demo",
	contextLabel: "Science · Grade 10",
} as const;

const SUBJECT_IDS = {
	math: "mock-math",
	physics: "mock-physics",
	chemistry: "mock-chemistry",
	biology: "mock-biology",
	english: "mock-english",
	social: "mock-social",
} as const;

function buildMockLeaderboard(): StudentDashboardLeaderboardPayload {
	const topFive = [
		{ rank: 1, studentId: "mock-s-2", displayName: "Ishaan V.", averagePercent: 91, testsCount: 8 },
		{ rank: 2, studentId: "mock-s-3", displayName: "Meera K.", averagePercent: 88, testsCount: 7 },
		{ rank: 3, studentId: "mock-s-1", displayName: "Aanya S.", averagePercent: 86, testsCount: 9 },
		{ rank: 4, studentId: "mock-s-4", displayName: "Arjun P.", averagePercent: 84, testsCount: 6 },
		{ rank: 5, studentId: "mock-s-5", displayName: "Sneha R.", averagePercent: 82, testsCount: 5 },
	];
	const scopeResult = {
		topFive,
		viewer: { rank: 3, averagePercent: 86, testsCount: 9, inTopFive: true },
		rankedCount: 5,
		cohortSize: 28,
	};
	return {
		viewerStudentId: "mock-s-1",
		cohortLabel: MOCK_SCHOOL,
		cohortKind: "organization" as const,
		cohortSize: 28,
		scopeLabels: [
			{ id: "overall", label: "Overall" },
			{ id: SUBJECT_IDS.math, label: "Mathematics" },
			{ id: SUBJECT_IDS.physics, label: "Physics" },
			{ id: SUBJECT_IDS.biology, label: "Biology" },
		],
		byScope: {
			overall: scopeResult,
			[SUBJECT_IDS.math]: scopeResult,
			[SUBJECT_IDS.physics]: scopeResult,
			[SUBJECT_IDS.biology]: scopeResult,
		},
	};
}

export function buildMockStudentDashboardPayload(): Omit<StudentDashboardViewProps, "variant"> {
	return {
		headerGreeting: "You're on a 12-day streak — strong work in Biology and English. Physics and a few Chemistry topics still need a focused pass.",
		performanceStats: {
			testsCompleted: 34,
			averageScoreLast30Days: 78,
			topicsMasteredCount: 42,
			topicsNeedingImprovementCount: 8,
			studyStreakDays: 12,
			timeSpentMinutesLast30Days: 840,
		},
		subjectCards: [
			{
				subjectId: SUBJECT_IDS.physics,
				subjectName: "Physics",
				percentCovered: 76,
				topicTotal: 48,
				attemptedCount: 36,
				testsTaken: 9,
				lastTestDateIso: new Date(Date.now() - 2 * 864e5).toISOString(),
				status: "Bad",
				scorePercent: 62,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 12, satisfactory: 8, bad: 16, notTested: 12 },
			},
			{
				subjectId: SUBJECT_IDS.chemistry,
				subjectName: "Chemistry",
				percentCovered: 82,
				topicTotal: 44,
				attemptedCount: 36,
				testsTaken: 8,
				lastTestDateIso: new Date(Date.now() - 4 * 864e5).toISOString(),
				status: "Satisfactory",
				scorePercent: 71,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 14, satisfactory: 14, bad: 8, notTested: 8 },
			},
			{
				subjectId: SUBJECT_IDS.math,
				subjectName: "Mathematics",
				percentCovered: 88,
				topicTotal: 52,
				attemptedCount: 46,
				testsTaken: 11,
				lastTestDateIso: new Date(Date.now() - 1 * 864e5).toISOString(),
				status: "Good",
				scorePercent: 84,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 28, satisfactory: 10, bad: 8, notTested: 6 },
			},
			{
				subjectId: SUBJECT_IDS.biology,
				subjectName: "Biology",
				percentCovered: 90,
				topicTotal: 40,
				attemptedCount: 36,
				testsTaken: 7,
				lastTestDateIso: new Date(Date.now() - 3 * 864e5).toISOString(),
				status: "Good",
				scorePercent: 88,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 22, satisfactory: 8, bad: 6, notTested: 4 },
			},
			{
				subjectId: SUBJECT_IDS.english,
				subjectName: "English",
				percentCovered: 85,
				topicTotal: 32,
				attemptedCount: 28,
				testsTaken: 5,
				lastTestDateIso: new Date(Date.now() - 6 * 864e5).toISOString(),
				status: "Good",
				scorePercent: 91,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 18, satisfactory: 6, bad: 4, notTested: 4 },
			},
			{
				subjectId: SUBJECT_IDS.social,
				subjectName: "Social Science",
				percentCovered: 79,
				topicTotal: 36,
				attemptedCount: 28,
				testsTaken: 4,
				lastTestDateIso: new Date(Date.now() - 8 * 864e5).toISOString(),
				status: "Good",
				scorePercent: 79,
				practiceHref: "#",
				performanceHref: "#",
				topicStatusCounts: { good: 14, satisfactory: 8, bad: 6, notTested: 8 },
			},
		],
		topicProgressRadar: [
			{ subject: "Math", coverage: 88, perfected: 72 },
			{ subject: "Physics", coverage: 76, perfected: 48 },
			{ subject: "Chemistry", coverage: 82, perfected: 55 },
			{ subject: "Biology", coverage: 90, perfected: 78 },
			{ subject: "English", coverage: 85, perfected: 70 },
		],
		subjectsLoadError: null,
		openAssignments: [
			{
				id: "mock-assign-1",
				assignmentId: "mock-a-1",
				title: "Thermodynamics checkpoint",
				instructions: "Complete before Friday lab.",
				lifecycleStatus: "ready",
				testId: "mock-test-1",
				score: null,
				dueAt: new Date(Date.now() + 2 * 864e5).toISOString(),
				createdAt: new Date(Date.now() - 3 * 864e5).toISOString(),
				submittedAt: null,
				gradedAt: null,
				subjectName: "Physics",
			},
			{
				id: "mock-assign-2",
				assignmentId: "mock-a-2",
				title: "Organic reactions set",
				instructions: null,
				lifecycleStatus: "in_progress",
				testId: "mock-test-2",
				score: null,
				dueAt: new Date(Date.now() - 864e5).toISOString(),
				createdAt: new Date(Date.now() - 5 * 864e5).toISOString(),
				submittedAt: null,
				gradedAt: null,
				subjectName: "Chemistry",
			},
		],
		leaderboard: buildMockLeaderboard(),
		trackerNeedsHydration: false,
	};
}

export const MOCK_TEACHER_SCOPE_LABEL = "Grade 10 · All subjects · Section A";

export function buildMockTeacherDashboardBundle(): TeacherDashboardBundle {
	const summary: TeacherClassPerformanceSummary = {
		studentsInScope: 28,
		studentsWithRecentScores: 26,
		classAveragePercent: 74,
		recentGradedItemsUsed: 5,
		recentWindowSize: 5,
		upliftOpportunity: {
			topicId: "mock-topic-thermo",
			topicName: "Thermodynamics",
			subjectName: "Physics",
			averagePercent: 54,
			studentsTested: 24,
			testsTaken: 41,
			studentsBelowSupportLine: 8,
		},
		performanceBands: [
			{
				id: "strong",
				label: "Strong",
				rangeLabel: "80%+",
				description: "Consistently above target",
				count: 9,
				students: [
					{
						studentId: "mock-s-2",
						fullName: "Ishaan Verma",
						grade: 10,
						section: "A",
						averagePercent: 86,
						recentGradedItemsUsed: 5,
					},
					{
						studentId: "mock-s-3",
						fullName: "Meera Kapoor",
						grade: 10,
						section: "A",
						averagePercent: 84,
						recentGradedItemsUsed: 4,
					},
				],
			},
			{
				id: "near_target",
				label: "Near target",
				rangeLabel: "65–79%",
				description: "On track with small gaps",
				count: 11,
				students: [
					{
						studentId: "mock-s-1",
						fullName: "Aanya Sharma",
						grade: 10,
						section: "A",
						averagePercent: 78,
						recentGradedItemsUsed: 5,
					},
					{
						studentId: "mock-s-4",
						fullName: "Arjun Patel",
						grade: 10,
						section: "A",
						averagePercent: 72,
						recentGradedItemsUsed: 5,
					},
					{
						studentId: "mock-s-5",
						fullName: "Sneha Reddy",
						grade: 10,
						section: "A",
						averagePercent: 68,
						recentGradedItemsUsed: 5,
					},
				],
			},
			{
				id: "needs_support",
				label: "Needs support",
				rangeLabel: "50–64%",
				description: "Targeted practice recommended",
				count: 4,
				students: [
					{
						studentId: "mock-s-6",
						fullName: "Karan Singh",
						grade: 10,
						section: "A",
						averagePercent: 58,
						recentGradedItemsUsed: 5,
					},
				],
			},
			{
				id: "at_risk",
				label: "At risk",
				rangeLabel: "<50%",
				description: "Intervention this week",
				count: 2,
				students: [
					{
						studentId: "mock-s-7",
						fullName: "Rohan Mehta",
						grade: 10,
						section: "A",
						averagePercent: 44,
						recentGradedItemsUsed: 5,
					},
					{
						studentId: "mock-s-8",
						fullName: "Priya Nair",
						grade: 10,
						section: "A",
						averagePercent: 47,
						recentGradedItemsUsed: 4,
					},
				],
			},
		],
	};

	const atRiskRows: TeacherAtRiskStudentRow[] = [
		{
			studentId: "mock-s-7",
			fullName: "Rohan Mehta",
			severityScore: 92,
			lastFiveAveragePercent: 44,
			gradedItemsUsed: 5,
			overdueAssignments: 2,
			lateAssignments: 1,
			lowScoredAssignments: 3,
			summary: "Below 50% on recent graded work; 2 overdue assignments.",
		},
		{
			studentId: "mock-s-8",
			fullName: "Priya Nair",
			severityScore: 78,
			lastFiveAveragePercent: 47,
			gradedItemsUsed: 4,
			overdueAssignments: 0,
			lateAssignments: 2,
			lowScoredAssignments: 2,
			summary: "Trending low on Physics and Chemistry practice tests.",
		},
	];

	return { summary, atRiskRows };
}
