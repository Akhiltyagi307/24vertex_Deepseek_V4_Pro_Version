import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getVerifiedTeacherSession = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const listOrganizationStudentsWithFilters = vi.fn();
const getOrganizationRosterFilterOptions = vi.fn();
const listTeacherPerformanceDirectoryStudents = vi.fn();
const listTeacherPerformanceDirectoryRows = vi.fn();
const listTeacherTopicPerformanceRows = vi.fn();
const consumeTeacherPortalDataActionRateLimit = vi.fn();

vi.mock("@/lib/auth/require-verified-teacher", () => ({ getVerifiedTeacherSession }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/teachers/roster-queries", () => ({
	listOrganizationStudentsWithFilters,
	getOrganizationRosterFilterOptions,
}));
vi.mock("@/lib/teachers/teacher-performance-directory-queries", () => ({
	listTeacherPerformanceDirectoryStudents,
	listTeacherPerformanceDirectoryRows,
}));
vi.mock("@/lib/teachers/teacher-topic-performance-queries", () => ({
	listTeacherTopicPerformanceRows,
}));
vi.mock("@/lib/teachers/teacher-portal-action-rate-limit", () => ({
	consumeTeacherPortalDataActionRateLimit,
}));

describe("teacher roster and directory actions", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		consumeTeacherPortalDataActionRateLimit.mockResolvedValue({ ok: true });
	});

	it("rejects organization roster requests before loading students when the teacher guard fails", async () => {
		getVerifiedTeacherSession.mockResolvedValue({ ok: false, message: "Sign in as a teacher to continue." });

		const { fetchTeacherOrganizationRoster } = await import(
			"@/app/teacher/(protected)/settings/org-roster-actions"
		);
		const result = await fetchTeacherOrganizationRoster({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Sign in as a teacher to continue." });
		expect(listOrganizationStudentsWithFilters).not.toHaveBeenCalled();
	});

	it("rejects student performance directory requests before loading rows when the teacher guard fails", async () => {
		getVerifiedTeacherSession.mockResolvedValue({
			ok: false,
			message: "Your teacher account must be verified before using this feature.",
		});

		const { fetchTeacherPerformanceDirectory } = await import(
			"@/app/teacher/(protected)/student-performance/teacher-performance-directory-actions"
		);
		const result = await fetchTeacherPerformanceDirectory({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Your teacher account must be verified before using this feature." });
		expect(listTeacherPerformanceDirectoryRows).not.toHaveBeenCalled();
	});

	it("rejects topic performance directory requests before loading rows when rate limited", async () => {
		getVerifiedTeacherSession.mockResolvedValue({ ok: true, user: { id: "teacher-1" }, profile: { id: "teacher-1" } });
		consumeTeacherPortalDataActionRateLimit.mockResolvedValue({
			ok: false,
			message: "Too many teacher portal requests. Slow down and try again shortly.",
		});

		const { fetchTeacherTopicPerformanceDirectory } = await import(
			"@/app/teacher/(protected)/topic-performance/teacher-topic-performance-actions"
		);
		const result = await fetchTeacherTopicPerformanceDirectory({ grade: "all", section: "all", subjectId: "all" });

		expect(result).toEqual({ error: "Too many teacher portal requests. Slow down and try again shortly." });
		expect(listTeacherTopicPerformanceRows).not.toHaveBeenCalled();
	});
});

