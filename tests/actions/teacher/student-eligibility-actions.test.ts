import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const listTeacherAssignableStudents = vi.fn();
const resolvePracticeAssignmentEligibleStudentIds = vi.fn();
const rlConsume = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/assignments/queries", () => ({
	listTeacherAssignableStudents,
	resolvePracticeAssignmentEligibleStudentIds,
}));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const TOPIC = "22222222-2222-4222-8222-222222222222";
const STUDENT_A = "33333333-3333-4333-8333-333333333333";
const STUDENT_B = "44444444-4444-4444-8444-444444444444";

describe("previewEligibleStudentIdsForPracticeAssignment", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
			teacher_roster_grade: 10,
			teacher_roster_subject_id: SUBJECT,
		});
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 119,
			resetAt: new Date(),
		});
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: "org-1" });
	});

	it("returns eligible student ids after filtering by roster + scope", async () => {
		listTeacherAssignableStudents.mockResolvedValue([
			{ id: STUDENT_A, fullName: "A" },
		]);
		resolvePracticeAssignmentEligibleStudentIds.mockResolvedValue({
			ok: true,
			eligibleStudentIds: [STUDENT_A],
		});

		const { previewEligibleStudentIdsForPracticeAssignment } = await import(
			"@/app/teacher/(protected)/assignments/student-eligibility-actions"
		);
		const result = await previewEligibleStudentIdsForPracticeAssignment({
			subjectId: SUBJECT,
			topicIds: [TOPIC],
			// Student B is NOT in the teacher's assignable set; must be dropped pre-RPC.
			candidateStudentIds: [STUDENT_A, STUDENT_B],
		});
		expect(result).toEqual({ eligibleStudentIds: [STUDENT_A] });
		expect(resolvePracticeAssignmentEligibleStudentIds).toHaveBeenCalledWith(
			expect.objectContaining({
				activeOrganizationId: "org-1",
				teacherRosterGrade: 10,
				teacherRosterSubjectId: SUBJECT,
				studentIds: [STUDENT_A],
			}),
		);
	});

	it("returns empty list when no candidate is assignable", async () => {
		listTeacherAssignableStudents.mockResolvedValue([]);
		const { previewEligibleStudentIdsForPracticeAssignment } = await import(
			"@/app/teacher/(protected)/assignments/student-eligibility-actions"
		);
		const result = await previewEligibleStudentIdsForPracticeAssignment({
			subjectId: SUBJECT,
			topicIds: [TOPIC],
			candidateStudentIds: [STUDENT_A, STUDENT_B],
		});
		expect(result).toEqual({ eligibleStudentIds: [] });
		expect(resolvePracticeAssignmentEligibleStudentIds).not.toHaveBeenCalled();
	});

	it("surfaces the scope-resolver error string", async () => {
		listTeacherAssignableStudents.mockResolvedValue([{ id: STUDENT_A, fullName: "A" }]);
		resolvePracticeAssignmentEligibleStudentIds.mockResolvedValue({
			ok: false,
			message: "Scope check failed.",
		});
		const { previewEligibleStudentIdsForPracticeAssignment } = await import(
			"@/app/teacher/(protected)/assignments/student-eligibility-actions"
		);
		const result = await previewEligibleStudentIdsForPracticeAssignment({
			subjectId: SUBJECT,
			topicIds: [TOPIC],
			candidateStudentIds: [STUDENT_A],
		});
		expect(result).toEqual({ error: "Scope check failed." });
	});
});
