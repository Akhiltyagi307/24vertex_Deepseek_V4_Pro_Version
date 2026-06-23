import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const getTeacherSubjectScope = vi.fn();
const listTeacherAssignableStudents = vi.fn();
const getTeacherStudentPerformanceBandsForSubject = vi.fn();
const rlConsume = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/teachers/teacher-subject-scope", () => ({
	getTeacherSubjectScope,
	isSubjectOutOfScope: (scope: { isScoped: boolean; subjectIds: string[] }, subjectId: string) =>
		scope.isScoped && !scope.subjectIds.includes(subjectId),
}));
vi.mock("@/lib/assignments/queries", () => ({ listTeacherAssignableStudents }));
vi.mock("@/lib/teachers/teacher-class-performance-summary", () => ({
	getTeacherStudentPerformanceBandsForSubject,
}));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));

describe("fetchAssignableStudentPerformanceBands", () => {
	const subjectId = "11111111-1111-4111-8111-111111111111";
	const subjectOut = "99999999-9999-4999-8999-999999999999";
	const studentA = "22222222-2222-4222-8222-222222222222";
	const studentB = "33333333-3333-4333-8333-333333333333";

	beforeEach(() => {
		vi.resetAllMocks();
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
			subjects_taught: null,
		});
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 119,
			resetAt: new Date("2026-05-19T00:00:00.000Z"),
		});
		getActiveTeacherOrganizationSnapshot.mockResolvedValue(null);
		// Default: unscoped teacher (whole school) — existing cases are unaffected by scope.
		getTeacherSubjectScope.mockResolvedValue({ isScoped: false, subjectIds: [], grades: [] });
	});

	it("returns bands only for accessible students", async () => {
		listTeacherAssignableStudents.mockResolvedValue([
			{ id: studentA, fullName: "A" },
		]);
		getTeacherStudentPerformanceBandsForSubject.mockResolvedValue(new Map([[studentA, "strong"]]));

		const { fetchAssignableStudentPerformanceBands } = await import(
			"@/app/teacher/(protected)/assignments/student-band-filters-actions"
		);
		const result = await fetchAssignableStudentPerformanceBands({
			subjectId,
			// studentB is NOT in the teacher's roster — must be filtered out before query.
			studentIds: [studentA, studentB],
		});
		expect(result).toEqual({ bands: { [studentA]: "strong" } });
		expect(getTeacherStudentPerformanceBandsForSubject).toHaveBeenCalledWith({
			teacherId: "teacher-1",
			studentIds: [studentA],
			subjectId,
		});
	});

	it("returns an empty bands map when no candidate is accessible", async () => {
		listTeacherAssignableStudents.mockResolvedValue([]);
		const { fetchAssignableStudentPerformanceBands } = await import(
			"@/app/teacher/(protected)/assignments/student-band-filters-actions"
		);
		const result = await fetchAssignableStudentPerformanceBands({
			subjectId,
			studentIds: [studentA, studentB],
		});
		expect(result).toEqual({ bands: {} });
		expect(getTeacherStudentPerformanceBandsForSubject).not.toHaveBeenCalled();
	});

	it("rejects extra payload fields", async () => {
		const { fetchAssignableStudentPerformanceBands } = await import(
			"@/app/teacher/(protected)/assignments/student-band-filters-actions"
		);
		const result = await fetchAssignableStudentPerformanceBands({
			subjectId,
			studentIds: [studentA],
			extra: "nope",
		});
		expect("error" in result).toBe(true);
	});

	it("drops an out-of-scope subjectId before querying bands", async () => {
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: "org-1" });
		getTeacherSubjectScope.mockResolvedValue({ isScoped: true, subjectIds: [subjectId], grades: [9] });

		const { fetchAssignableStudentPerformanceBands } = await import(
			"@/app/teacher/(protected)/assignments/student-band-filters-actions"
		);
		const result = await fetchAssignableStudentPerformanceBands({
			subjectId: subjectOut,
			studentIds: [studentA],
		});
		expect(result).toEqual({ error: expect.stringMatching(/subjects you teach/i) });
		expect(listTeacherAssignableStudents).not.toHaveBeenCalled();
		expect(getTeacherStudentPerformanceBandsForSubject).not.toHaveBeenCalled();
	});
});
