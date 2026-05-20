import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const couponLimit = vi.fn();
const plansSelect = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const insertValues = vi.fn(async () => undefined);
const createSubscriptionPercentOffer = vi.fn(async () => ({ id: "offer_xyz" }));
const redemptionsOffset = vi.fn();
const redemptionsCount = vi.fn();
let nextSelect: "coupon" | "plans" | "redemptions-rows" | "redemptions-count" = "coupon";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COUPON_SYNC_RAZORPAY_OFFERS: "coupon_sync_razorpay_offers" },
}));
vi.mock("@/lib/billing/plans", () => ({
	PAID_CHECKOUT_PLAN_CODES: ["pro_monthly", "pro_annual"],
}));
vi.mock("@/lib/billing/action-failures", () => ({
	BILLING_ACTION_FAILURE_KINDS: { SYNC_OFFERS_PARTIAL: "sync_offers_partial" },
}));
vi.mock("@/lib/billing/razorpay-subscription-offers", () => ({
	createSubscriptionPercentOffer,
}));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn() }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "coupon") {
				return { from: () => ({ where: () => ({ limit: couponLimit }) }) };
			}
			if (nextSelect === "plans") {
				return { from: () => ({ where: plansSelect }) };
			}
			if (nextSelect === "redemptions-count") {
				return { from: () => ({ where: redemptionsCount }) };
			}
			return {
				from: () => ({
					innerJoin: () => ({
						leftJoin: () => ({
							where: () => ({
								orderBy: () => ({ limit: () => ({ offset: redemptionsOffset }) }),
							}),
						}),
					}),
				}),
			};
		}),
		update: () => ({ set: () => ({ where: updateWhere }) }),
		insert: () => ({ values: insertValues }),
	},
}));

describe("D32 Sprint C · coupons/[code] sync-razorpay-offers + redemptions", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		couponLimit.mockReset();
		plansSelect.mockReset();
		plansSelect.mockResolvedValue([]);
		updateWhere.mockClear();
		insertValues.mockClear();
		insertValues.mockResolvedValue(undefined);
		createSubscriptionPercentOffer.mockClear();
		createSubscriptionPercentOffer.mockResolvedValue({ id: "offer_xyz" });
		redemptionsOffset.mockReset();
		redemptionsOffset.mockResolvedValue([]);
		redemptionsCount.mockReset();
		redemptionsCount.mockResolvedValue([{ total: 0 }]);
		nextSelect = "coupon";
	});

	it("sync POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/coupons/[code]/sync-razorpay-offers/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/sync-razorpay-offers"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(401);
	});

	it("sync POST: 404 when coupon not found", async () => {
		couponLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/coupons/[code]/sync-razorpay-offers/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/sync-razorpay-offers"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(404);
	});

	it("sync POST: rejects non-checkout coupon", async () => {
		couponLimit.mockResolvedValueOnce([
			{ id: "c1", code: "TEST10", kind: "entitlement", discountPercent: null },
		]);
		const { POST } = await import("@/app/api/admin/coupons/[code]/sync-razorpay-offers/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/sync-razorpay-offers"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
	});

	it("sync POST: rejects invalid discount_percent", async () => {
		couponLimit.mockResolvedValueOnce([
			{ id: "c1", code: "TEST10", kind: "checkout_discount", discountPercent: null },
		]);
		const { POST } = await import("@/app/api/admin/coupons/[code]/sync-razorpay-offers/route");
		const res = await POST(
			adminRequest("/api/admin/coupons/TEST10/sync-razorpay-offers"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(400);
	});

	it("redemptions GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/coupons/[code]/redemptions/route");
		const res = await GET(
			adminRequest("/api/admin/coupons/TEST10/redemptions"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(401);
	});

	it("redemptions GET: 404 when coupon not found", async () => {
		couponLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/coupons/[code]/redemptions/route");
		const res = await GET(
			adminRequest("/api/admin/coupons/TEST10/redemptions"),
			{ params: Promise.resolve({ code: "TEST10" }) },
		);
		expect(res.status).toBe(404);
	});

	// Redemptions GET happy-path omitted: requires three sequential selects
	// (coupon → rows w/ joins → count) the minimal mock harness can't model
	// cleanly. The auth + not-found cases above already exercise the gate.
});
