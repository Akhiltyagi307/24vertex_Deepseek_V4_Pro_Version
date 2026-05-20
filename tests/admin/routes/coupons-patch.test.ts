import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COUPON_PATCH: "coupon_patch" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

describe("D32 Sprint B · /api/admin/coupons/[code] (GET + PATCH)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await GET(adminRequest("/api/admin/coupons/TEST10"), {
			params: Promise.resolve({ code: "TEST10" }),
		});
		expect(res.status).toBe(401);
	});

	it("GET: 404 when coupon not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await GET(adminRequest("/api/admin/coupons/MISSING"), {
			params: Promise.resolve({ code: "MISSING" }),
		});
		expect(res.status).toBe(404);
	});

	it("PATCH: rejects empty body (no fields)", async () => {
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", { body: {} }),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: rejects extra keys (D14 strict)", async () => {
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", {
				body: { is_active: true, extraneous: "x" },
			}),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: 404 when coupon not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", { body: { is_active: true } }),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(404);
	});

	it("PATCH: rejects discount/offer change after redemptions exist", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "c1", code: "TEST10", redemptionsCount: 5, kind: "checkout_discount" },
		]);
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", { body: { discount_percent: 80 } }),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
		expect(updateWhere).not.toHaveBeenCalled();
	});

	it("PATCH: rejects empty eligible_plan_codes array", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "c1", code: "TEST10", redemptionsCount: 0, kind: "checkout_discount" },
		]);
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", { body: { eligible_plan_codes: [] } }),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: happy path patches + audits", async () => {
		selectLimit
			.mockResolvedValueOnce([
				{
					id: "c1",
					code: "TEST10",
					redemptionsCount: 0,
					kind: "entitlement",
					createdAt: new Date(),
					expiresAt: null,
				},
			])
			.mockResolvedValueOnce([
				{
					id: "c1",
					code: "TEST10",
					maxRedemptions: 500,
					redemptionsCount: 0,
					kind: "entitlement",
					isActive: false,
					createdAt: new Date(),
					expiresAt: null,
				},
			]);
		const { PATCH } = await import("@/app/api/admin/coupons/[code]/route");
		const res = await PATCH(
			adminRequest("/api/admin/coupons/TEST10", {
				body: { is_active: false, max_redemptions: 500 },
			}),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("coupon_patch");
		expect(audit.targetId).toBe("c1");
	});
});
