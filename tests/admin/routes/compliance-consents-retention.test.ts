import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const orderByLimit = vi.fn();
const orderBy = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				orderBy: vi.fn(() => ({ limit: orderByLimit, then: undefined })),
			}),
		}),
	},
}));

describe("D32 Sprint C · compliance/consents + retention list GETs", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		orderByLimit.mockReset();
		orderBy.mockReset();
	});

	it("consents GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/compliance/consents/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("consents GET: returns rows", async () => {
		orderByLimit.mockResolvedValueOnce([
			{ id: "c1", studentId: "stu-1", grantedAt: new Date(), revokedAt: null },
		]);
		const { GET } = await import("@/app/api/admin/compliance/consents/route");
		const res = await GET();
		expect(res.status).toBe(200);
	});

	it("retention GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/compliance/retention/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});
});
