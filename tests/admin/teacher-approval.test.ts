import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireAdminApi = vi.fn();
const adminGetUserById = vi.fn();
const setTeacherVerified = vi.fn();
const sendTeacherApprovedEmail = vi.fn();
const insertTeacherWelcomeNotification = vi.fn();
const writeAdminActionStrict = vi.fn();
const recordTeacherApprovalHistory = vi.fn();
const captureMessage = vi.fn();
const captureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
	withScope: async (fn: (scope: { setTag: () => void }) => Promise<unknown>) =>
		fn({ setTag: () => {} }),
	captureMessage,
	captureException,
}));
vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));
vi.mock("@/lib/admin/teacher-approval", () => ({
	setTeacherVerified,
	insertTeacherWelcomeNotification,
}));
vi.mock("@/lib/admin/teacher-approval-history", () => ({ recordTeacherApprovalHistory }));
vi.mock("@/lib/email/teacher-approved-email", () => ({ sendTeacherApprovedEmail }));
vi.mock("@/lib/admin/audit", async () => {
	const actual = await vi.importActual<typeof import("@/lib/admin/audit")>("@/lib/admin/audit");
	return { ...actual, writeAdminActionStrict };
});
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEACHER_APPROVE: "teacher_approve" },
}));
vi.mock("@/lib/admin/api-request-meta", () => ({
	clientIpFromRequest: () => null,
	userAgentFromRequest: () => null,
}));
vi.mock("@/lib/admin/response", () => ({
	adminAckResponse: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
	adminErrorResponse: (msg: string, opts: { status?: number } = {}) =>
		new Response(JSON.stringify({ ok: false, message: msg }), { status: opts.status ?? 400 }),
}));

const TEACHER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(): import("next/server").NextRequest {
	return new Request("http://localhost/api/admin/teachers/x/approve", {
		method: "POST",
	}) as unknown as import("next/server").NextRequest;
}

describe("POST /api/admin/teachers/[id]/approve", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		requireAdminApi.mockResolvedValue({ jti: "j", sessionId: "s" });
	});

	it("writes audit row with before/after payload on the happy path", async () => {
		adminGetUserById.mockResolvedValue({
			id: TEACHER_ID,
			role: "teacher",
			email: "teacher@example.com",
			full_name: "Jane",
			is_verified: false,
		});
		setTeacherVerified.mockResolvedValue(true);
		sendTeacherApprovedEmail.mockResolvedValue({ ok: true });
		insertTeacherWelcomeNotification.mockResolvedValue(undefined);
		writeAdminActionStrict.mockResolvedValue(undefined);
		recordTeacherApprovalHistory.mockResolvedValue(undefined);

		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(buildRequest(), { params: Promise.resolve({ id: TEACHER_ID }) });
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "teacher_approve",
				targetType: "profile",
				targetId: TEACHER_ID,
				payload: { before: { is_verified: false }, after: { is_verified: true } },
			}),
		);
		expect(recordTeacherApprovalHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				teacherUserId: TEACHER_ID,
				email: "teacher@example.com",
				action: "verified",
			}),
		);
	});

	it("captures Sentry message and returns 500 when setTeacherVerified fails", async () => {
		adminGetUserById.mockResolvedValue({
			id: TEACHER_ID,
			role: "teacher",
			email: "teacher@example.com",
			is_verified: false,
		});
		setTeacherVerified.mockResolvedValue(false);

		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(buildRequest(), { params: Promise.resolve({ id: TEACHER_ID }) });
		expect(res.status).toBe(500);
		expect(captureMessage).toHaveBeenCalledWith(
			"teacher_approve_setverified_failed",
			expect.objectContaining({ level: "error" }),
		);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("rejects non-teacher profiles with 404", async () => {
		adminGetUserById.mockResolvedValue({ id: TEACHER_ID, role: "student" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(buildRequest(), { params: Promise.resolve({ id: TEACHER_ID }) });
		expect(res.status).toBe(404);
		expect(setTeacherVerified).not.toHaveBeenCalled();
	});
});
