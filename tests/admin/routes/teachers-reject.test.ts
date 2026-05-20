import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const adminGetUserById = vi.fn<(id: string) => Promise<{ role: string } | null>>();
const setTeacherVerified = vi.fn(async () => true);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEACHER_REJECT: "teacher_reject" },
}));
vi.mock("@/lib/admin/teacher-approval", () => ({ setTeacherVerified }));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));

const VALID_UUID = "88888888-8888-4888-8888-888888888888";

describe("D32 Sprint B · POST /api/admin/teachers/[id]/reject", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		adminGetUserById.mockReset();
		setTeacherVerified.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/reject`, { body: { reason: "x" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest("/api/admin/teachers/bad/reject", { body: { reason: "x" } }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects empty reason (min length)", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/reject`, { body: { reason: "" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 .strict() schema)", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/reject`, {
				body: { reason: "ok", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target is not a teacher", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "student" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/reject`, { body: { reason: "test" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects + audits with reason on success", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "teacher" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/reject`, {
				body: { reason: "incomplete credentials" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(setTeacherVerified).toHaveBeenCalledWith(VALID_UUID, false);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { reason: string };
		};
		expect(audit.action).toBe("teacher_reject");
		expect(audit.payload.reason).toBe("incomplete credentials");
	});
});
