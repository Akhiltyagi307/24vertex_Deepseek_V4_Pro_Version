import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
	},
}));

const REQ_UUID = "77777777-7777-4777-8777-777777777777";

describe("D32 Sprint C · GET /api/admin/compliance/requests/[id]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/compliance/requests/[id]/route");
		const res = await GET(adminRequest(`/api/admin/compliance/requests/${REQ_UUID}`), {
			params: Promise.resolve({ id: REQ_UUID }),
		});
		expect(res.status).toBe(401);
	});

	it("400 invalid UUID", async () => {
		const { GET } = await import("@/app/api/admin/compliance/requests/[id]/route");
		const res = await GET(adminRequest("/api/admin/compliance/requests/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/compliance/requests/[id]/route");
		const res = await GET(adminRequest(`/api/admin/compliance/requests/${REQ_UUID}`), {
			params: Promise.resolve({ id: REQ_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("happy path returns row", async () => {
		selectLimit.mockResolvedValueOnce([{ id: REQ_UUID, status: "open" }]);
		const { GET } = await import("@/app/api/admin/compliance/requests/[id]/route");
		const res = await GET(adminRequest(`/api/admin/compliance/requests/${REQ_UUID}`), {
			params: Promise.resolve({ id: REQ_UUID }),
		});
		expect(res.status).toBe(200);
	});
});
