import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const dbUpdateReturning = vi.fn();
const dbUpdate = vi.fn(() => ({
	set: () => ({
		where: () => ({ returning: dbUpdateReturning }),
	}),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { USER_SUSPEND: "user_suspend" },
}));
vi.mock("@/db", () => ({ db: { update: dbUpdate } }));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("D32 Sprint A · POST /api/admin/users/[id]/suspend", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		dbUpdateReturning.mockReset();
		writeAdminAction.mockClear();
		dbUpdate.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/suspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/suspend`, { body: { reason: "test" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(writeAdminAction).not.toHaveBeenCalled();
	});

	it("rejects invalid UUID with 400", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/suspend/route");
		const res = await POST(
			adminRequest("/api/admin/users/not-a-uuid/suspend", { body: { reason: "x" } }),
			{ params: Promise.resolve({ id: "not-a-uuid" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects unknown keys (D14 .strict() schema)", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/suspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/suspend`, {
				body: { reason: "ok", extraneous: "field" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target profile not found", async () => {
		dbUpdateReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/users/[id]/suspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/suspend`, { body: { reason: "test" } }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("suspends and audits when valid", async () => {
		dbUpdateReturning.mockResolvedValueOnce([{ id: VALID_UUID }]);
		const { POST } = await import("@/app/api/admin/users/[id]/suspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/suspend`, {
				body: { reason: "policy violation" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminAction).toHaveBeenCalledTimes(1);
		const call = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { reason: string };
		};
		expect(call.action).toBe("user_suspend");
		expect(call.targetId).toBe(VALID_UUID);
		expect(call.payload.reason).toBe("policy violation");
	});
});
