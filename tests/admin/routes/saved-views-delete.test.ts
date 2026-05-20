import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const deleteWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SAVED_VIEW_DELETE: "saved_view_delete" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		delete: () => ({ where: deleteWhere }),
	},
}));

const VIEW = "33333333-3333-4333-8333-333333333333";

describe("D32 Sprint C · DELETE /api/admin/saved-views/[id]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		deleteWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { DELETE } = await import("@/app/api/admin/saved-views/[id]/route");
		const res = await DELETE(adminRequest(`/api/admin/saved-views/${VIEW}`, { method: "DELETE" }), {
			params: Promise.resolve({ id: VIEW }),
		});
		expect(res.status).toBe(401);
	});

	it("400 invalid id", async () => {
		const { DELETE } = await import("@/app/api/admin/saved-views/[id]/route");
		const res = await DELETE(adminRequest("/api/admin/saved-views/bad", { method: "DELETE" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("happy path: deletes + audits when row existed", async () => {
		selectLimit.mockResolvedValueOnce([{ id: VIEW, listId: "users", name: "All students" }]);
		const { DELETE } = await import("@/app/api/admin/saved-views/[id]/route");
		const res = await DELETE(adminRequest(`/api/admin/saved-views/${VIEW}`, { method: "DELETE" }), {
			params: Promise.resolve({ id: VIEW }),
		});
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { list_id: string; name: string };
		};
		expect(audit.action).toBe("saved_view_delete");
		expect(audit.payload.list_id).toBe("users");
		expect(audit.payload.name).toBe("All students");
	});

	it("noop delete (row missing) still returns 200 without audit", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { DELETE } = await import("@/app/api/admin/saved-views/[id]/route");
		const res = await DELETE(adminRequest(`/api/admin/saved-views/${VIEW}`, { method: "DELETE" }), {
			params: Promise.resolve({ id: VIEW }),
		});
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		expect(writeAdminAction).not.toHaveBeenCalled();
	});
});
