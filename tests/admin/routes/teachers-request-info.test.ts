import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const adminGetUserById = vi.fn<(id: string) => Promise<{ role: string } | null>>();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEACHER_REQUEST_INFO: "teacher_request_info" },
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));

const VALID_UUID = "99999999-9999-4999-8999-999999999999";

describe("D32 Sprint B · POST /api/admin/teachers/[id]/request-info", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		adminGetUserById.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: ["q?"] },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects empty questions array (min(1))", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: [] },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects >20 questions (max(20))", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: Array.from({ length: 21 }, (_, i) => `q${i}`) },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 .strict() schema)", async () => {
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: ["ok"], extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target is not a teacher", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "student" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: ["please clarify"] },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("audits with questions on success", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "teacher" });
		const { POST } = await import("@/app/api/admin/teachers/[id]/request-info/route");
		const res = await POST(
			adminRequest(`/api/admin/teachers/${VALID_UUID}/request-info`, {
				body: { questions: ["clarify subject", "upload credential"] },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { questions: string[] };
		};
		expect(audit.action).toBe("teacher_request_info");
		expect(audit.payload.questions).toHaveLength(2);
	});
});
