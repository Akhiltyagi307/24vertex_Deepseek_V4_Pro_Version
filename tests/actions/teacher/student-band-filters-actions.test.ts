import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const listTeacherAssignableStudents = vi.fn();
const getTeacherStudentPerformanceBandsForSubject = vi.fn();
const rlConsume = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/assignments/queries", () => ({ listTeacherAssignableStudents }));
vi.mock("@/lib/teachers/teacher-class-performance-summary", () => ({
	getTeacherStudentPerformanceBandsForSubject,
}));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));

describe("fetchAssignableStudentPerformanceBands", () => {
	beforeEach(() => {
		vi.resetAllMocks();
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
			resetAt: new Date("2026-05-19T00:00:00.000Z"),
		});
	});

	const subjectId = "11111111-1111-4111-8111-111111111111";
	const studentA = "22222222-2222-4222-8222-222222222222";
	const studentB = "33333333-3333-4333-8333-333333333333";

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
});
