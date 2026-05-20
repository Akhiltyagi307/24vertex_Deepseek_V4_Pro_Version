import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint C · GET /api/admin/email-log/[id]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/email-log/[id]/route");
		const res = await GET(adminRequest("/api/admin/email-log/m1"), {
			params: Promise.resolve({ id: "m1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/email-log/[id]/route");
		const res = await GET(adminRequest("/api/admin/email-log/m1"), {
			params: Promise.resolve({ id: "m1" }),
		});
		expect(res.status).toBe(404);
	});

	it("happy path returns row", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "m1", subject: "Hi" }]);
		const { GET } = await import("@/app/api/admin/email-log/[id]/route");
		const res = await GET(adminRequest("/api/admin/email-log/m1"), {
			params: Promise.resolve({ id: "m1" }),
		});
		expect(res.status).toBe(200);
	});
});
