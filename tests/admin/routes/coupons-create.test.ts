import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const insertReturning = vi.fn();
const listSelectOffset = vi.fn();
const countSelect = vi.fn();
let nextSelectShape: "list" | "count" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COUPON_CREATE: "coupon_create" },
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((args?: unknown) => {
			if (args && typeof args === "object" && "total" in (args as object)) {
				nextSelectShape = "count";
			} else {
				nextSelectShape = "list";
			}
			if (nextSelectShape === "count") {
				return { from: () => ({ where: countSelect }) };
			}
			return {
				from: () => ({
					where: () => ({
						orderBy: () => ({ limit: () => ({ offset: listSelectOffset }) }),
					}),
					orderBy: () => ({ limit: () => ({ offset: listSelectOffset }) }),
				}),
			};
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint B · POST /api/admin/coupons (create + discriminated union)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		insertReturning.mockReset();
		listSelectOffset.mockReset();
		countSelect.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/coupons/route");
		const res = await POST(
			adminRequest("/api/admin/coupons", {
				body: {
					kind: "entitlement",
					code: "TEST10",
					grants_plan_code: "pro_monthly",
					max_redemptions: 100,
				},
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects unknown discriminant", async () => {
		const { POST } = await import("@/app/api/admin/coupons/route");
		const res = await POST(
			adminRequest("/api/admin/coupons", {
				body: { kind: "totally-fake", code: "X", max_redemptions: 100 },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys on union member (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/coupons/route");
		const res = await POST(
			adminRequest("/api/admin/coupons", {
				body: {
					kind: "entitlement",
					code: "TEST10",
					grants_plan_code: "pro_monthly",
					max_redemptions: 100,
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects entitlement coupon granting free plan (W2.3)", async () => {
		const { POST } = await import("@/app/api/admin/coupons/route");
		const res = await POST(
			adminRequest("/api/admin/coupons", {
				body: {
					kind: "entitlement",
					code: "FREEPLAN",
					grants_plan_code: "free",
					max_redemptions: 100,
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects ≥95% checkout discount without confirm flag (W2.4)", async () => {
		const { POST } = await import("@/app/api/admin/coupons/route");
		const res = await POST(
			adminRequest("/api/admin/coupons", {
				body: {
					kind: "checkout_discount",
					code: "HUGE",
					max_redemptions: 100,
					discount_percent: 99,
				},
			}),
		);
		expect(res.status).toBe(400);
	});
});
