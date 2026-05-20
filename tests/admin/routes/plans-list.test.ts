import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const orderBy = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ orderBy }) }) },
}));

describe("D32 Sprint C · GET /api/admin/plans", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		orderBy.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/plans/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("returns plans ordered by sort_order + code", async () => {
		orderBy.mockResolvedValueOnce([
			{ code: "pro_monthly", name: "Pro Monthly", sortOrder: 1 },
			{ code: "pro_annual", name: "Pro Annual", sortOrder: 2 },
		]);
		const { GET } = await import("@/app/api/admin/plans/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { code: string }[] };
		expect(body.data).toHaveLength(2);
		expect(body.data[0]?.code).toBe("pro_monthly");
	});
});
