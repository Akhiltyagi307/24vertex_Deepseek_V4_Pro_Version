import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminGetUserById = vi.fn<(id: string) => Promise<{
	role: string;
	email: string | null;
	full_name: string;
} | null>>();
const setTeacherVerified = vi.fn(async () => true);
const insertTeacherWelcomeNotification = vi.fn(async () => {});
const sendTeacherApprovedEmail = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({
	writeAdminActionStrict,
	AdminAuditWriteError: class extends Error {},
}));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEACHER_APPROVE: "teacher_approve" },
}));
vi.mock("@/lib/admin/teacher-approval", () => ({
	setTeacherVerified,
	insertTeacherWelcomeNotification,
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));
vi.mock("@/lib/email/teacher-approved-email", () => ({ sendTeacherApprovedEmail }));

const VALID_UUID = "77777777-7777-4777-8777-777777777777";

describe("D32 Sprint B · POST /api/admin/teachers/[id]/approve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		adminGetUserById.mockReset();
		setTeacherVerified.mockClear();
		setTeacherVerified.mockResolvedValue(true);
		insertTeacherWelcomeNotification.mockClear();
		sendTeacherApprovedEmail.mockClear();
		sendTeacherApprovedEmail.mockResolvedValue({ ok: true });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/approve`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(setTeacherVerified).not.toHaveBeenCalled();
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest("/api/admin/teachers/bad/approve"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target is not a teacher", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "student", email: "s@x", full_name: "S" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/approve`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
		expect(setTeacherVerified).not.toHaveBeenCalled();
	});

	it("500 when setTeacherVerified fails", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "teacher", email: "t@x", full_name: "T" });
		setTeacherVerified.mockResolvedValueOnce(false);
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/approve`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(500);
	});

	it("happy path: verifies + emails + notifies + audits strictly", async () => {
		adminGetUserById.mockResolvedValueOnce({
			role: "teacher",
			email: "t@example.com",
			full_name: "Teach",
		});
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/approve`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(setTeacherVerified).toHaveBeenCalledWith(VALID_UUID, true);
		expect(sendTeacherApprovedEmail).toHaveBeenCalledWith("t@example.com", "Teach");
		expect(insertTeacherWelcomeNotification).toHaveBeenCalledWith(
			VALID_UUID,
			expect.any(String),
			expect.any(String),
		);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("teacher_approve");
		expect(audit.targetId).toBe(VALID_UUID);
	});

	it("succeeds even when teacher email is null (no email sent)", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "teacher", email: null, full_name: "Teach" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/approve/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/approve`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(sendTeacherApprovedEmail).not.toHaveBeenCalled();
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
	});
});
