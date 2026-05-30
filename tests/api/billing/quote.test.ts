/**
 * Behavioral tests for `GET /api/billing/quote` (H-4) — the coupon-quote
 * endpoint. Covers the auth gate, the per-user rate limit (anti-enumeration),
 * query validation, and the happy path. Pure-logic route (no DB).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, rlMock, quoteMock, planCodeMock } = vi.hoisted(() => ({
	authMock: { current: { user: { id: "user-1" } } as { user: { id: string } } | null },
	rlMock: { current: { allowed: true, resetAt: new Date() } as { allowed: boolean; resetAt: Date } },
	quoteMock: {
		current: {
			ok: true,
			couponId: "coupon-1",
			planCode: "pro_monthly",
			couponCode: "SAVE10",
			discountPercent: 10,
		} as Record<string, unknown>,
	},
	planCodeMock: { current: true },
}));

vi.mock("@/lib/auth/api-request-user", () => ({ getApiRequestUser: async () => authMock.current }));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume: async () => rlMock.current }));
vi.mock("@/lib/billing/checkout-coupon", () => ({ quoteCheckoutCouponForPlan: async () => quoteMock.current }));
vi.mock("@/lib/billing/plans", () => ({ isPlanCode: () => planCodeMock.current }));

import { GET } from "@/app/api/billing/quote/route";

function req(qs = "planCode=pro_monthly&coupon=SAVE10"): NextRequest {
	return new NextRequest(`http://localhost/api/billing/quote?${qs}`, { method: "GET" });
}

describe("GET /api/billing/quote", () => {
	beforeEach(() => {
		authMock.current = { user: { id: "user-1" } };
		rlMock.current = { allowed: true, resetAt: new Date(Date.now() + 60_000) };
		quoteMock.current = {
			ok: true,
			couponId: "coupon-1",
			planCode: "pro_monthly",
			couponCode: "SAVE10",
			discountPercent: 10,
		};
		planCodeMock.current = true;
	});
	afterEach(() => vi.clearAllMocks());

	it("401 when unauthenticated", async () => {
		authMock.current = null;
		const res = await GET(req());
		expect(res.status).toBe(401);
	});

	it("429 with Retry-After when rate-limited", async () => {
		rlMock.current = { allowed: false, resetAt: new Date(Date.now() + 30_000) };
		const res = await GET(req());
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBeTruthy();
		const body = await res.json();
		expect(body.code).toBe("rate_limited");
	});

	it("400 on an invalid query (bad planCode)", async () => {
		const res = await GET(req("planCode=not_a_plan&coupon=SAVE10"));
		expect(res.status).toBe(400);
	});

	it("returns the quote on a valid coupon", async () => {
		const res = await GET(req());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.coupon_code).toBe("SAVE10");
		expect(body.discount_percent).toBe(10);
	});
});
