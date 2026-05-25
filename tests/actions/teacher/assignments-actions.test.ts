import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const teacherFilterAccessibleStudentIdsForSession = vi.fn();
const validatePracticeAssignmentConfigForStudents = vi.fn();
const createPublishedPracticeAssignment = vi.fn();
const notifyAssignmentPublished = vi.fn();
const triggerPracticeWorkerInBackground = vi.fn();
const rlConsume = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/teachers/teacher-student-access", () => ({
	teacherFilterAccessibleStudentIdsForSession,
}));
vi.mock("@/lib/assignments/queries", () => ({
	validatePracticeAssignmentConfigForStudents,
	createPublishedPracticeAssignment,
}));
vi.mock("@/lib/notifications/assignment-events", () => ({ notifyAssignmentPublished }));
vi.mock("@/lib/admin/practice-worker-trigger", () => ({ triggerPracticeWorkerInBackground }));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logSupabaseError: vi.fn(), logServerError: vi.fn() }));

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const TOPIC = "22222222-2222-4222-8222-222222222222";
const STUDENT_A = "33333333-3333-4333-8333-333333333333";

function makeFormData(overrides: Record<string, string | string[]> = {}): FormData {
	const fd = new FormData();
	fd.set("title", overrides.title as string ?? "Algebra week 1");
	fd.set("instructions", overrides.instructions as string ?? "");
	fd.set("due_at", overrides.due_at as string ?? "");
	fd.set("subject_id", overrides.subject_id as string ?? SUBJECT);
	fd.set("time_limit_seconds", overrides.time_limit_seconds as string ?? "3600");
	fd.set("difficulty", overrides.difficulty as string ?? "medium");
	const topics = (overrides.topic_ids as string[]) ?? [TOPIC];
	for (const t of topics) fd.append("topic_ids", t);
	const students = (overrides.student_ids as string[]) ?? [STUDENT_A];
	for (const s of students) fd.append("student_ids", s);
	return fd;
}

describe("createTeacherAssignmentAction", () => {
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
		rlConsume.mockResolvedValue({ allowed: true, remaining: 119, resetAt: new Date() });
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: "org-1" });
	});

	it("rejects an assignment whose students are outside the teacher's roster", async () => {
		teacherFilterAccessibleStudentIdsForSession.mockResolvedValue(new Set());
		const { createTeacherAssignmentAction } = await import(
			"@/app/teacher/(protected)/assignments/actions"
		);
		const result = await createTeacherAssignmentAction(
			{ ok: false, message: "" },
			makeFormData(),
		);
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/roster/i);
		expect(createPublishedPracticeAssignment).not.toHaveBeenCalled();
	});

	it("returns rate-limit error before doing any further work", async () => {
		rlConsume.mockResolvedValue({ allowed: false, remaining: 0, resetAt: new Date() });
		const { createTeacherAssignmentAction } = await import(
			"@/app/teacher/(protected)/assignments/actions"
		);
		const result = await createTeacherAssignmentAction(
			{ ok: false, message: "" },
			makeFormData(),
		);
		expect(result.ok).toBe(false);
		expect(teacherFilterAccessibleStudentIdsForSession).not.toHaveBeenCalled();
		expect(createPublishedPracticeAssignment).not.toHaveBeenCalled();
	});

	it("publishes the assignment and notifies students on the happy path", async () => {
		teacherFilterAccessibleStudentIdsForSession.mockResolvedValue(new Set([STUDENT_A]));
		validatePracticeAssignmentConfigForStudents.mockResolvedValue({ ok: true });
		createPublishedPracticeAssignment.mockResolvedValue({ assignmentId: "assignment-1" });
		notifyAssignmentPublished.mockResolvedValue(undefined);
		triggerPracticeWorkerInBackground.mockResolvedValue(undefined);

		const { createTeacherAssignmentAction } = await import(
			"@/app/teacher/(protected)/assignments/actions"
		);
		const result = await createTeacherAssignmentAction(
			{ ok: false, message: "" },
			makeFormData(),
		);
		expect(result.ok).toBe(true);
		expect(result.assignmentId).toBe("assignment-1");
		expect(result.studentCount).toBe(1);
		expect(createPublishedPracticeAssignment).toHaveBeenCalledWith(
			expect.objectContaining({ teacherId: "teacher-1", organizationId: "org-1" }),
		);
		expect(notifyAssignmentPublished).toHaveBeenCalledWith(
			expect.objectContaining({ assignmentId: "assignment-1" }),
		);
		expect(revalidatePath).toHaveBeenCalledWith("/teacher/assignments");
		expect(revalidatePath).toHaveBeenCalledWith("/teacher/submissions");
	});
});
