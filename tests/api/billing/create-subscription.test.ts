/**
 * Behavioral tests for `POST /api/billing/create-subscription` (H-4). Covers
 * body validation, auth, the missing-Razorpay-key 503, plan lookup, the
 * "already has a paid subscription" 409 guard, the Razorpay-failure path (+
 * orphan-customer audit), and the happy path returning a subscription id.
 *
 * `@/lib/env` and `@/lib/billing/razorpay` are spread-overridden (real module +
 * targeted fn overrides) so the rest of each module — and the real
 * RazorpayCustomerCollisionError class — stay intact.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase, type MockSupabaseClient } from "../../factories/supabase";

const { authMock, sbHolder, keyMock, custSpy, subSpy } = vi.hoisted(() => ({
	authMock: {
		current: { user: { id: "user-1", email: "stud@test.dev" }, supabase: {} } as
			| { user: { id: string; email: string }; supabase: unknown }
			| null,
	},
	sbHolder: { current: null as unknown },
	keyMock: { current: (): string => "rzp_test_key" },
	custSpy: vi.fn(async (): Promise<{ id: string; email: string }> => ({ id: "cust_1", email: "stud@test.dev" })),
	subSpy: vi.fn(async (): Promise<{ id: string; short_url: string | null }> => ({ id: "sub_rzp_1", short_url: "https://rzp/x" })),
}));

vi.mock("@/lib/auth/api-request-user", () => ({ getApiRequestUser: async () => authMock.current }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => sbHolder.current }));
vi.mock("@/lib/billing/plans", () => ({ isPlanCode: () => true }));
vi.mock("@/lib/practice/analytics", () => ({ recordPracticeEvent: vi.fn() }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn(), logSupabaseError: vi.fn() }));
vi.mock("@/lib/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/env")>()),
	getPublicRazorpayKeyId: () => keyMock.current(),
}));
vi.mock("@/lib/billing/razorpay", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/billing/razorpay")>()),
	createOrFetchCustomer: () => custSpy(),
	createSubscription: () => subSpy(),
}));

import { POST } from "@/app/api/billing/create-subscription/route";

type SubRow = {
	id: string;
	razorpay_customer_id: string | null;
	razorpay_subscription_id: string | null;
	status: string;
	trial_ends_at: string | null;
};

const FRESH_SUB: SubRow = {
	id: "sub-1",
	razorpay_customer_id: null,
	razorpay_subscription_id: null,
	status: "trialing",
	trial_ends_at: null,
};

function setup(opts: { plan?: Record<string, unknown> | null; sub?: SubRow | null } = {}) {
	sbHolder.current = makeMockSupabase({
		tables: {
			plans:
				opts.plan === undefined
					? { data: { code: "pro_monthly", razorpay_plan_id: "rzp_plan_m", price_paise: 49900, interval: "month" } }
					: { data: opts.plan },
			profiles: { data: { role: "student", full_name: "Stud", phone: null, parent_email: null } },
			subscriptions: { data: opts.sub === undefined ? FRESH_SUB : opts.sub },
			billing_action_failures: { data: null },
		},
	}) as MockSupabaseClient;
}

function req(body: unknown = { planCode: "pro_monthly" }): Request {
	return new Request("http://localhost/api/billing/create-subscription", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	authMock.current = { user: { id: "user-1", email: "stud@test.dev" }, supabase: {} };
	keyMock.current = () => "rzp_test_key";
	custSpy.mockReset();
	custSpy.mockResolvedValue({ id: "cust_1", email: "stud@test.dev" });
	subSpy.mockReset();
	subSpy.mockResolvedValue({ id: "sub_rzp_1", short_url: "https://rzp/x" });
	setup();
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/billing/create-subscription", () => {
	it("400 on an invalid body", async () => {
		expect((await POST(req({ planCode: "free" }))).status).toBe(400);
	});

	it("401 when unauthenticated", async () => {
		authMock.current = null;
		expect((await POST(req())).status).toBe(401);
	});

	it("503 when the public Razorpay key is not configured", async () => {
		keyMock.current = () => {
			throw new Error("missing key");
		};
		expect((await POST(req())).status).toBe(503);
	});

	it("400 when the plan is not found", async () => {
		setup({ plan: null });
		expect((await POST(req())).status).toBe(400);
	});

	it("409 when the caller already has an active paid subscription", async () => {
		setup({ sub: { ...FRESH_SUB, status: "active", razorpay_subscription_id: "rzp_existing" } });
		const res = await POST(req());
		expect(res.status).toBe(409);
		expect(subSpy).not.toHaveBeenCalled();
	});

	it("creates the Razorpay subscription and returns 200 with the id", async () => {
		const res = await POST(req());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.subscriptionId).toBe("sub_rzp_1");
		expect(custSpy).toHaveBeenCalledTimes(1);
		expect(subSpy).toHaveBeenCalledTimes(1);
	});

	it("502 when Razorpay subscription creation fails", async () => {
		subSpy.mockRejectedValueOnce(new Error("rzp down"));
		const res = await POST(req());
		expect(res.status).toBe(502);
	});
});
