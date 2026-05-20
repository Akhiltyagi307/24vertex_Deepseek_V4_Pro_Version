import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const deleteWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { QUOTA_GRANT_DELETE: "quota_grant_delete" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		delete: () => ({ where: deleteWhere }),
	},
}));

const GRANT_UUID = "66666666-6666-4666-8666-666666666666";

describe("D32 Sprint C · DELETE /api/admin/grants/[grantId]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		deleteWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { DELETE } = await import("@/app/api/admin/grants/[grantId]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/grants/${GRANT_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ grantId: GRANT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("400 invalid UUID", async () => {
		const { DELETE } = await import("@/app/api/admin/grants/[grantId]/route");
		const res = await DELETE(adminRequest("/api/admin/grants/bad", { method: "DELETE" }), {
			params: Promise.resolve({ grantId: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("404 when grant not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { DELETE } = await import("@/app/api/admin/grants/[grantId]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/grants/${GRANT_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ grantId: GRANT_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when grant already partially consumed (accounting safety)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: GRANT_UUID, studentId: "stu-1", grantType: "tests", quantity: 10, consumed: 3 },
		]);
		const { DELETE } = await import("@/app/api/admin/grants/[grantId]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/grants/${GRANT_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ grantId: GRANT_UUID }) },
		);
		expect(res.status).toBe(409);
		expect(deleteWhere).not.toHaveBeenCalled();
	});

	it("happy path: hard-deletes unconsumed grant + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: GRANT_UUID, studentId: "stu-1", grantType: "tests", quantity: 10, consumed: 0 },
		]);
		const { DELETE } = await import("@/app/api/admin/grants/[grantId]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/grants/${GRANT_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ grantId: GRANT_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { student_id: string; grant_type: string; quantity: number };
		};
		expect(audit.action).toBe("quota_grant_delete");
		expect(audit.payload.student_id).toBe("stu-1");
		expect(audit.payload.quantity).toBe(10);
	});
});
