import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminListTests = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/tests-admin", () => ({ adminListTests }));

describe("D32 Sprint C · GET /api/admin/tests", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminListTests.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/tests/route");
		const res = await GET(adminRequest("/api/admin/tests"));
		expect(res.status).toBe(401);
	});

	it("happy path with pagination + status filter", async () => {
		adminListTests.mockResolvedValueOnce({
			rows: [{ id: "t1" }, { id: "t2" }],
			total: 2,
		});
		const { GET } = await import("@/app/api/admin/tests/route");
		const res = await GET(adminRequest("/api/admin/tests?status=in_progress&page=1&page_size=10"));
		expect(res.status).toBe(200);
		expect(adminListTests).toHaveBeenCalledWith({
			page: 1,
			pageSize: 10,
			status: "in_progress",
			q: null,
		});
	});

	it("clamps page_size to 100", async () => {
		adminListTests.mockResolvedValueOnce({ rows: [], total: 0 });
		const { GET } = await import("@/app/api/admin/tests/route");
		const res = await GET(adminRequest("/api/admin/tests?page_size=99999"));
		expect(res.status).toBe(200);
		expect(adminListTests).toHaveBeenCalledWith(
			expect.objectContaining({ pageSize: 100 }),
		);
	});
});
