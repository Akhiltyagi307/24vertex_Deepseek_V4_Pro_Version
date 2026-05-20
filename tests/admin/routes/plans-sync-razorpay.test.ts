import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();
const fetchRazorpayPlan = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/billing/razorpay", () => ({ fetchRazorpayPlan }));
vi.mock("@/db", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }) },
}));

describe("D32 Sprint C · POST /api/admin/plans/[code]/sync-razorpay", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
		fetchRazorpayPlan.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans/pro_monthly/sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(401);
	});

	it("400 when code is invalid (empty after decode)", async () => {
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans//sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "" }),
		});
		expect(res.status).toBe(400);
	});

	it("404 when plan not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans/pro_monthly/sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(404);
	});

	it("400 when plan has no razorpay_plan_id", async () => {
		selectLimit.mockResolvedValueOnce([
			{ code: "pro_monthly", name: "Pro", interval: "monthly", pricePaise: 99900, razorpayPlanId: null },
		]);
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans/pro_monthly/sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(400);
	});

	it("502 when Razorpay fetch fails", async () => {
		selectLimit.mockResolvedValueOnce([
			{ code: "pro_monthly", name: "Pro", interval: "monthly", pricePaise: 99900, razorpayPlanId: "plan_X" },
		]);
		fetchRazorpayPlan.mockRejectedValueOnce(new Error("rzp down"));
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans/pro_monthly/sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(502);
	});

	it("happy path: reports drift when remote price differs", async () => {
		selectLimit.mockResolvedValueOnce([
			{ code: "pro_monthly", name: "Pro", interval: "monthly", pricePaise: 99900, razorpayPlanId: "plan_X" },
		]);
		fetchRazorpayPlan.mockResolvedValueOnce({
			id: "plan_X",
			period: "monthly",
			interval: 1,
			item: { amount: 109900, currency: "INR", name: "Pro" },
		});
		const { POST } = await import("@/app/api/admin/plans/[code]/sync-razorpay/route");
		const res = await POST(adminRequest("/api/admin/plans/pro_monthly/sync-razorpay", { method: "POST" }), {
			params: Promise.resolve({ code: "pro_monthly" }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { drift: { price_paise: boolean; interval: boolean; name: boolean } };
		};
		expect(body.data.drift.price_paise).toBe(true);
		expect(body.data.drift.interval).toBe(false);
		expect(body.data.drift.name).toBe(false);
	});
});
