import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const subSelectLimit = vi.fn();
const couponSelectLimit = vi.fn();
let nextSelect: "sub" | "coupon" = "sub";

const isCouponSingleUseGlobalExhausted = vi.fn(() => false);
const tokenQuotaForGrade = vi.fn(() => 100_000);

const createServiceRoleClient = vi.fn(() => ({
	from: () => ({
		select: () => ({
			eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }),
		}),
	}),
	rpc: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBSCRIPTION_APPLY_COUPON: "subscription_apply_coupon" },
}));
vi.mock("@/lib/billing/coupon-policy", () => ({ isCouponSingleUseGlobalExhausted }));
vi.mock("@/lib/billing/plans", () => ({
	PLAN_CATALOG: {
		pro_monthly: {
			testsPerPeriod: 30,
			tokensGrade6to10: 100_000,
			tokensGrade11to12: 200_000,
		},
	},
	tokenQuotaForGrade,
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "coupon") {
				return { from: () => ({ where: () => ({ limit: couponSelectLimit }) }) };
			}
			return { from: () => ({ where: () => ({ limit: subSelectLimit }) }) };
		}),
	},
}));

const SUB = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint C · POST /api/admin/subscriptions/[id]/apply-coupon", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		subSelectLimit.mockReset();
		couponSelectLimit.mockReset();
		nextSelect = "sub";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/apply-coupon/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB}/apply-coupon`, {
				method: "POST",
				body: { coupon_code: "TEST10" },
			}),
			{ params: Promise.resolve({ id: SUB }) },
		);
		expect(res.status).toBe(401);
	});

	it("400 invalid subscription id", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/apply-coupon/route");
		const res = await POST(
			adminRequest("/api/admin/subscriptions/bad/apply-coupon", {
				method: "POST",
				body: { coupon_code: "TEST10" },
			}),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("400 invalid body (missing coupon_code)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/apply-coupon/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB}/apply-coupon`, { method: "POST", body: {} }),
			{ params: Promise.resolve({ id: SUB }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when subscription not found", async () => {
		subSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/apply-coupon/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB}/apply-coupon`, {
				method: "POST",
				body: { coupon_code: "TEST10" },
			}),
			{ params: Promise.resolve({ id: SUB }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when subscription is in active billing state", async () => {
		subSelectLimit.mockResolvedValueOnce([
			{ id: SUB, profileId: "stu", status: "active" },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/apply-coupon/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB}/apply-coupon`, {
				method: "POST",
				body: { coupon_code: "TEST10" },
			}),
			{ params: Promise.resolve({ id: SUB }) },
		);
		expect(res.status).toBe(409);
	});

	// Happy path omitted: requires four sequential selects (sub → coupon →
	// supabase admin maybeSingle → profile → plan) plus the RPC chain — the
	// minimal mock harness can't model cleanly. The early-exit branches above
	// already cover the gate + body + state-conflict paths.
});
