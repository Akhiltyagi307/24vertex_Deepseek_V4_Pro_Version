import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const listTeacherPerformanceDirectoryStudents = vi.fn();
const getTeacherClassPerformanceSummaryForRoster = vi.fn();
const listTeacherAtRiskStudentsForRoster = vi.fn();
const rlConsume = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/teachers/teacher-performance-directory-queries", () => ({
	listTeacherPerformanceDirectoryStudents,
}));
vi.mock("@/lib/teachers/teacher-class-performance-summary", () => ({
	getTeacherClassPerformanceSummaryForRoster,
}));
vi.mock("@/lib/teachers/teacher-at-risk-queries", () => ({
	listTeacherAtRiskStudentsForRoster,
}));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));

describe("teacher dashboard actions", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("loads the scoped roster once and returns summary plus at-risk rows", async () => {
		const roster = [{ id: "student-1", fullName: "A Student", grade: 8, section: "A", studentLinkCode: null }];
		const summary = {
			studentsInScope: 1,
			studentsWithRecentScores: 1,
			classAveragePercent: 82,
			recentGradedItemsUsed: 1,
			recentWindowSize: 5,
			performanceBands: [],
			upliftOpportunities: [],
		};
		const atRiskRows = [{ studentId: "student-1", fullName: "A Student", summary: "Needs attention" }];

		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
		});
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 119,
			resetAt: new Date("2026-05-16T12:00:00.000Z"),
		});
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: "org-1" });
		listTeacherPerformanceDirectoryStudents.mockResolvedValue(roster);
		getTeacherClassPerformanceSummaryForRoster.mockResolvedValue(summary);
		listTeacherAtRiskStudentsForRoster.mockResolvedValue(atRiskRows);

		const { fetchTeacherDashboardBundle } = await import("@/app/teacher/(protected)/dashboard/teacher-dashboard-actions");
		const result = await fetchTeacherDashboardBundle({
			grade: 8,
			section: "A",
			subjectId: "11111111-1111-4111-8111-111111111111",
		});

		expect(result).toEqual({ summary, atRiskRows });
		expect(listTeacherPerformanceDirectoryStudents).toHaveBeenCalledTimes(1);
		expect(listTeacherPerformanceDirectoryStudents).toHaveBeenCalledWith({
			teacherId: "teacher-1",
			activeOrganizationId: "org-1",
			grade: 8,
			section: "A",
			subjectId: "11111111-1111-4111-8111-111111111111",
		});
		expect(getTeacherClassPerformanceSummaryForRoster).toHaveBeenCalledWith({
			teacherId: "teacher-1",
			roster,
			subjectId: "11111111-1111-4111-8111-111111111111",
		});
		expect(listTeacherAtRiskStudentsForRoster).toHaveBeenCalledWith({
			teacherId: "teacher-1",
			roster,
			subjectId: "11111111-1111-4111-8111-111111111111",
		});
		expect(rlConsume).toHaveBeenCalledWith({
			key: "teacher-portal-actions:user:teacher-1",
			limit: 120,
			windowSec: 60,
		});
	});

	it("returns a sign-in error before loading scoped dashboard data", async () => {
		getServerUser.mockResolvedValue(null);

		const { fetchTeacherDashboardBundle } = await import("@/app/teacher/(protected)/dashboard/teacher-dashboard-actions");
		const result = await fetchTeacherDashboardBundle({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Not signed in." });
		expect(listTeacherPerformanceDirectoryStudents).not.toHaveBeenCalled();
	});

	it("rejects non-teacher sessions before loading scoped dashboard data", async () => {
		getServerUser.mockResolvedValue({ id: "student-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "student-1",
			role: "student",
			is_verified: true,
			is_suspended: false,
		});

		const { fetchTeacherDashboardBundle } = await import("@/app/teacher/(protected)/dashboard/teacher-dashboard-actions");
		const result = await fetchTeacherDashboardBundle({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Sign in as a teacher to continue." });
		expect(listTeacherPerformanceDirectoryStudents).not.toHaveBeenCalled();
	});

	it("rejects unverified teachers before loading scoped dashboard data", async () => {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: false,
			is_suspended: false,
		});

		const { fetchTeacherDashboardBundle } = await import("@/app/teacher/(protected)/dashboard/teacher-dashboard-actions");
		const result = await fetchTeacherDashboardBundle({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Your teacher account must be verified before using this feature." });
		expect(listTeacherPerformanceDirectoryStudents).not.toHaveBeenCalled();
	});

	it("returns a rate-limit error before loading scoped dashboard data", async () => {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
		});
		rlConsume.mockResolvedValue({
			allowed: false,
			remaining: 0,
			resetAt: new Date("2026-05-16T12:00:00.000Z"),
		});

		const { fetchTeacherDashboardBundle } = await import("@/app/teacher/(protected)/dashboard/teacher-dashboard-actions");
		const result = await fetchTeacherDashboardBundle({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Too many teacher portal requests. Slow down and try again shortly." });
		expect(listTeacherPerformanceDirectoryStudents).not.toHaveBeenCalled();
	});
});
