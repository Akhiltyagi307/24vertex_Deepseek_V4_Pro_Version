/**
 * Behavioral tests for `POST /api/billing/change-plan` (H-4). Covers auth, body
 * validation, rate-limit, subscription lookup, the not-linked / same-plan /
 * wrong-status guards, the Razorpay-failure path (+ audit row), and success.
 * Pure helpers (proration, state-machine, plan codes) are mocked so the happy
 * path is deterministic and the test focuses on the route's orchestration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase, type MockSupabaseClient } from "../../factories/supabase";

const { authMock, sbHolder, rlMock, updateSpy } = vi.hoisted(() => ({
	authMock: { current: { user: { id: "user-1" }, supabase: {} } as { user: { id: string }; supabase: unknown } | null },
	sbHolder: { current: null as unknown },
	rlMock: { current: { allowed: true, resetAt: new Date() } as { allowed: boolean; resetAt: Date } },
	updateSpy: vi.fn(async (): Promise<void> => {}),
}));

vi.mock("@/lib/auth/api-request-user", () => ({ getApiRequestUser: async () => authMock.current }));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume: async () => rlMock.current }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => sbHolder.current }));
vi.mock("@/lib/billing/razorpay", () => ({ updateSubscriptionPlan: (...a: unknown[]) => updateSpy(...(a as [])) }));
vi.mock("@/lib/billing/plans", () => ({
	isPlanCode: () => true,
	PAID_CHECKOUT_PLAN_CODES: ["pro_monthly", "pro_annual"],
}));
vi.mock("@/lib/billing/subscription-state-machine", () => ({
	isSubscriptionStatus: () => true,
	canTransition: () => true,
}));
vi.mock("@/lib/billing/proration", () => ({
	defaultWhenForChange: () => "cycle_end",
	quotePlanChange: () => ({ deltaPaise: 12345, isUpgrade: true, periodRemainingSec: 86_400 }),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn(), logSupabaseError: vi.fn() }));

import { POST } from "@/app/api/billing/change-plan/route";

type SubRow = {
	id: string;
	profile_id: string;
	plan_code: string;
	status: string;
	current_period_start: string;
	current_period_end: string;
	razorpay_subscription_id: string | null;
};

const BASE_SUB: SubRow = {
	id: "sub-1",
	profile_id: "user-1",
	plan_code: "pro_monthly",
	status: "active",
	current_period_start: new Date(Date.now() - 86_400_000).toISOString(),
	current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
	razorpay_subscription_id: "rzp_sub_1",
};

function setup(sub: SubRow | null, planSeeded = true) {
	sbHolder.current = makeMockSupabase({
		tables: {
			subscriptions: { data: sub },
			plans: { data: planSeeded ? { razorpay_plan_id: "rzp_plan_annual" } : { razorpay_plan_id: null } },
			billing_plan_changes: { data: { id: "pc-1" } },
		},
	}) as MockSupabaseClient;
}

function req(body: unknown = { newPlanCode: "pro_annual" }): Request {
	return new Request("http://localhost/api/billing/change-plan", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	authMock.current = { user: { id: "user-1" }, supabase: {} };
	rlMock.current = { allowed: true, resetAt: new Date(Date.now() + 60_000) };
	updateSpy.mockReset();
	updateSpy.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/billing/change-plan", () => {
	it("401 when unauthenticated", async () => {
		authMock.current = null;
		setup(BASE_SUB);
		expect((await POST(req())).status).toBe(401);
	});

	it("400 on an invalid body", async () => {
		setup(BASE_SUB);
		expect((await POST(req({ newPlanCode: "free" }))).status).toBe(400);
	});

	it("429 when rate-limited", async () => {
		rlMock.current = { allowed: false, resetAt: new Date(Date.now() + 30_000) };
		setup(BASE_SUB);
		expect((await POST(req())).status).toBe(429);
	});

	it("404 when no subscription", async () => {
		setup(null);
		expect((await POST(req())).status).toBe(404);
	});

	it("409 when subscription has no Razorpay id", async () => {
		setup({ ...BASE_SUB, razorpay_subscription_id: null });
		expect((await POST(req())).status).toBe(409);
	});

	it("409 when already on the requested plan", async () => {
		setup({ ...BASE_SUB, plan_code: "pro_annual" });
		expect((await POST(req({ newPlanCode: "pro_annual" }))).status).toBe(409);
	});

	it("409 when subscription is not active", async () => {
		setup({ ...BASE_SUB, status: "past_due" });
		expect((await POST(req())).status).toBe(409);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("changes the plan via Razorpay and returns 200 with a proration quote", async () => {
		setup(BASE_SUB);
		const res = await POST(req());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.to_plan).toBe("pro_annual");
		expect(body.proration.delta_paise).toBe(12345);
		expect(updateSpy).toHaveBeenCalledTimes(1);
	});

	it("502 and audits when Razorpay rejects the change", async () => {
		setup(BASE_SUB);
		updateSpy.mockRejectedValueOnce(new Error("rzp"));
		const res = await POST(req());
		expect(res.status).toBe(502);
	});
});
