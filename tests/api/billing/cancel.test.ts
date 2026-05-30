/**
 * Behavioral tests for `POST /api/billing/cancel` (H-4) — a customer-facing
 * subscription mutation that had zero executing coverage. Exercises the auth
 * gate, body validation, subscription lookup, the idempotent soft-cancel
 * short-circuit, the Razorpay-failure path, and the happy path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase, type MockSupabaseClient, type MockUser } from "../../factories/supabase";

const { authMock, sbHolder, cancelSpy, recordSpy } = vi.hoisted(() => ({
	authMock: { current: { id: "user-1" } as MockUser | null },
	sbHolder: { current: null as unknown },
	cancelSpy: vi.fn(async (_id: string, _opts: unknown): Promise<void> => {}),
	recordSpy: vi.fn(),
}));

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser: async () => authMock.current }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => sbHolder.current }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => sbHolder.current }));
vi.mock("@/lib/billing/razorpay", () => ({ cancelSubscription: (id: string, opts: unknown) => cancelSpy(id, opts) }));
vi.mock("@/lib/practice/analytics", () => ({ recordPracticeEvent: (...a: unknown[]) => recordSpy(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn(), logSupabaseError: vi.fn() }));

import { POST } from "@/app/api/billing/cancel/route";

type SubRow = {
	id: string;
	razorpay_subscription_id: string | null;
	status: string;
	cancel_at_period_end: boolean;
};

function setup(opts: { user?: MockUser | null; role?: string; sub?: SubRow | null }) {
	authMock.current = opts.user === undefined ? { id: "user-1" } : opts.user;
	sbHolder.current = makeMockSupabase({
		tables: {
			profiles: { data: { role: opts.role ?? "student" } },
			subscriptions: { data: opts.sub === undefined ? null : opts.sub },
		},
	}) as MockSupabaseClient;
}

function req(body: unknown = {}): Request {
	return new Request("http://localhost/api/billing/cancel", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

const ACTIVE_SUB: SubRow = {
	id: "sub-1",
	razorpay_subscription_id: "rzp_sub_1",
	status: "active",
	cancel_at_period_end: false,
};

describe("POST /api/billing/cancel", () => {
	beforeEach(() => {
		cancelSpy.mockReset();
		cancelSpy.mockResolvedValue(undefined);
		recordSpy.mockReset();
	});
	afterEach(() => vi.clearAllMocks());

	it("401 when unauthenticated", async () => {
		setup({ user: null });
		const res = await POST(req());
		expect(res.status).toBe(401);
		expect(cancelSpy).not.toHaveBeenCalled();
	});

	it("400 on an invalid body (non-uuid billingProfileId)", async () => {
		setup({ sub: ACTIVE_SUB });
		const res = await POST(req({ billingProfileId: "not-a-uuid" }));
		expect(res.status).toBe(400);
		expect(cancelSpy).not.toHaveBeenCalled();
	});

	it("404 when the caller has no subscription", async () => {
		setup({ sub: null });
		const res = await POST(req());
		expect(res.status).toBe(404);
		expect(cancelSpy).not.toHaveBeenCalled();
	});

	it("soft-cancels an active subscription via Razorpay and returns 200", async () => {
		setup({ sub: ACTIVE_SUB });
		const res = await POST(req());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(cancelSpy).toHaveBeenCalledTimes(1);
		expect(cancelSpy).toHaveBeenCalledWith("rzp_sub_1", { cancelAtCycleEnd: true });
	});

	it("is idempotent: already cancel_at_period_end → 200 deduped, no Razorpay call", async () => {
		setup({ sub: { ...ACTIVE_SUB, cancel_at_period_end: true } });
		const res = await POST(req());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.deduped).toBe(true);
		expect(cancelSpy).not.toHaveBeenCalled();
	});

	it("502 when Razorpay refuses the cancellation", async () => {
		setup({ sub: ACTIVE_SUB });
		cancelSpy.mockRejectedValueOnce(new Error("rzp down"));
		const res = await POST(req());
		expect(res.status).toBe(502);
	});
});
