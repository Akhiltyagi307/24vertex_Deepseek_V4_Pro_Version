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
	ADMIN_ACTIONS: { USER_UNSUSPEND: "user_unsuspend" },
}));
vi.mock("@/db", () => ({ db: { update: dbUpdate } }));

const VALID_UUID = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint A · POST /api/admin/users/[id]/unsuspend", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		dbUpdateReturning.mockReset();
		writeAdminAction.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/users/[id]/unsuspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/unsuspend`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID with 400", async () => {
		const { POST } = await import("@/app/api/admin/users/[id]/unsuspend/route");
		const res = await POST(
			adminRequest("/api/admin/users/bad/unsuspend"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when target not found", async () => {
		dbUpdateReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/users/[id]/unsuspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/unsuspend`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("unsuspends and writes audit on success", async () => {
		dbUpdateReturning.mockResolvedValueOnce([{ id: VALID_UUID }]);
		const { POST } = await import("@/app/api/admin/users/[id]/unsuspend/route");
		const res = await POST(
			adminRequest(`/api/admin/users/${VALID_UUID}/unsuspend`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminAction).toHaveBeenCalledTimes(1);
		const call = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(call.action).toBe("user_unsuspend");
		expect(call.targetId).toBe(VALID_UUID);
	});
});
