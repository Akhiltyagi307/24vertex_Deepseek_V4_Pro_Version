import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const getOrganizationById = vi.fn();
const countActiveTeacherStudentLinks = vi.fn();
const writeOrganizationAccessAudit = vi.fn();
const notifyTeacherOrganizationChanged = vi.fn();
const notifyTeacherLinkedStudent = vi.fn();
const resolveStudentProfileIdForLinkRef = vi.fn();
const supabaseRpc = vi.fn();
const revalidatePath = vi.fn();
const revalidateTag = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({
	getActiveTeacherOrganizationSnapshot,
	getOrganizationById,
	countActiveTeacherStudentLinks,
}));
vi.mock("@/lib/organizations/audit", () => ({ writeOrganizationAccessAudit }));
vi.mock("@/lib/notifications/organization-events", () => ({
	notifyTeacherOrganizationChanged,
	notifyTeacherLinkedStudent,
}));
vi.mock("@/lib/auth/resolve-student-link-ref", () => ({ resolveStudentProfileIdForLinkRef }));
vi.mock("@/lib/supabase/server", () => ({
	createClient: () => Promise.resolve({ rpc: (...args: unknown[]) => supabaseRpc(...args) }),
}));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
vi.mock("next/headers", () => ({ headers: async () => new Map<string, string>() }));
vi.mock("@/lib/admin/api-request-meta", () => ({ clientIpFromHeaders: () => null }));
vi.mock("@/lib/organizations/audit-actions", () => ({
	ORGANIZATION_ACCESS_ACTIONS: {
		TEACHER_ORGANIZATION_JOIN: "TEACHER_ORGANIZATION_JOIN",
		TEACHER_ORGANIZATION_LEAVE: "TEACHER_ORGANIZATION_LEAVE",
		TEACHER_STUDENT_LINK_SUCCESS: "TEACHER_STUDENT_LINK_SUCCESS",
		TEACHER_STUDENT_LINK_FAILED: "TEACHER_STUDENT_LINK_FAILED",
	},
}));
vi.mock("@/lib/server/log-supabase-error", () => ({ logSupabaseError: vi.fn() }));

const ORG = "11111111-1111-4111-8111-111111111111";

// Dynamic-import resolution under the full vitest suite pulls a deep transitive
// graph and can exceed the default 5s timeout under cold-cache conditions; the
// happy-path assertions themselves are sub-ms.
describe("teacher settings actions", { timeout: 15_000 }, () => {
	beforeEach(() => {
		vi.resetAllMocks();
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
		});
	});

	it("joinTeacherOrganization rejects an inactive organization", async () => {
		getActiveTeacherOrganizationSnapshot.mockResolvedValue(null);
		getOrganizationById.mockResolvedValue({ id: ORG, is_active: false, name: "X", type_label: "school" });
		countActiveTeacherStudentLinks.mockResolvedValue(0);
		const fd = new FormData();
		fd.set("organizationId", ORG);
		fd.set("organizationLinkingCode", "AB2345CD"); // valid 8-char A-Z 2-9 code shape
		const { joinTeacherOrganization } = await import(
			"@/app/teacher/(protected)/settings/actions"
		);
		const result = await joinTeacherOrganization(undefined, fd);
		expect(result.error).toMatch(/active organization/i);
		expect(supabaseRpc).not.toHaveBeenCalled();
	});

	it("leaveTeacherOrganization invokes the RPC and bumps the dashboard cache tag", async () => {
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: ORG, name: "X" });
		supabaseRpc.mockResolvedValue({ error: null });
		const { leaveTeacherOrganization } = await import(
			"@/app/teacher/(protected)/settings/actions"
		);
		const result = await leaveTeacherOrganization(undefined, new FormData());
		expect(result).toEqual({ success: true });
		expect(supabaseRpc).toHaveBeenCalledWith("teacher_leave_organization");
		expect(revalidateTag).toHaveBeenCalledWith("teacher-dashboard:teacher-1", "max");
	});

	it("linkTeacherToStudent invokes link_teacher_to_student RPC and writes audit on success", async () => {
		supabaseRpc.mockResolvedValue({ error: null });
		resolveStudentProfileIdForLinkRef.mockResolvedValue("student-1");
		const fd = new FormData();
		fd.set("studentId", "AB1234");
		const { linkTeacherToStudent } = await import(
			"@/app/teacher/(protected)/settings/actions"
		);
		const result = await linkTeacherToStudent(undefined, fd);
		expect(result).toEqual({ success: true });
		expect(supabaseRpc).toHaveBeenCalledWith("link_teacher_to_student", { p_student_ref: "AB1234" });
		expect(writeOrganizationAccessAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: "TEACHER_STUDENT_LINK_SUCCESS" }),
		);
	});

	it("unlinkTeacherFromStudent rejects an invalid uuid before touching the RPC", async () => {
		const fd = new FormData();
		fd.set("studentId", "not-a-uuid");
		const { unlinkTeacherFromStudent } = await import(
			"@/app/teacher/(protected)/settings/actions"
		);
		const result = await unlinkTeacherFromStudent(undefined, fd);
		expect(result.error).toMatch(/invalid/i);
		expect(supabaseRpc).not.toHaveBeenCalled();
	});
});
