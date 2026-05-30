/**
 * Behavioral tests for `POST /api/billing/pause` and `/api/billing/resume` (H-4).
 * Customer-facing subscription mutations with no prior executing coverage.
 * Covers auth, rate-limit, subscription lookup, the not-linked / wrong-status
 * guards, the idempotent short-circuit, the Razorpay-failure path, and success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase, type MockSupabaseClient } from "../../factories/supabase";

const { authMock, sbHolder, rlMock, pauseSpy, resumeSpy } = vi.hoisted(() => ({
	authMock: { current: { user: { id: "user-1" } } as { user: { id: string } } | null },
	sbHolder: { current: null as unknown },
	rlMock: { current: { allowed: true, resetAt: new Date() } as { allowed: boolean; resetAt: Date } },
	pauseSpy: vi.fn(async (_id: string, _opts: unknown): Promise<void> => {}),
	resumeSpy: vi.fn(async (_id: string, _opts: unknown): Promise<void> => {}),
}));

vi.mock("@/lib/auth/api-request-user", () => ({ getApiRequestUser: async () => authMock.current }));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume: async () => rlMock.current }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => sbHolder.current }));
vi.mock("@/lib/billing/razorpay", () => ({
	pauseSubscription: (id: string, opts: unknown) => pauseSpy(id, opts),
	resumeSubscription: (id: string, opts: unknown) => resumeSpy(id, opts),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({ logServerError: vi.fn(), logSupabaseError: vi.fn() }));

import { POST as PAUSE } from "@/app/api/billing/pause/route";
import { POST as RESUME } from "@/app/api/billing/resume/route";

type SubRow = { id: string; status: string; razorpay_subscription_id: string | null };

function setSub(sub: SubRow | null) {
	sbHolder.current = makeMockSupabase({
		tables: {
			subscriptions: { data: sub },
			usage_periods: { data: { id: "p1", tests_quota: 30, tokens_quota: 1000, pre_pause_quota: { testsQuota: 30, tokensQuota: 1000 } } },
			practice_analytics_events: { data: null },
		},
	}) as MockSupabaseClient;
}

function req(): Request {
	return new Request("http://localhost/api/billing/x", { method: "POST" });
}

beforeEach(() => {
	authMock.current = { user: { id: "user-1" } };
	rlMock.current = { allowed: true, resetAt: new Date(Date.now() + 60_000) };
	pauseSpy.mockReset();
	pauseSpy.mockResolvedValue(undefined);
	resumeSpy.mockReset();
	resumeSpy.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/billing/pause", () => {
	it("401 when unauthenticated", async () => {
		authMock.current = null;
		setSub({ id: "s1", status: "active", razorpay_subscription_id: "rzp1" });
		expect((await PAUSE(req())).status).toBe(401);
		expect(pauseSpy).not.toHaveBeenCalled();
	});

	it("429 when rate-limited", async () => {
		rlMock.current = { allowed: false, resetAt: new Date(Date.now() + 30_000) };
		setSub({ id: "s1", status: "active", razorpay_subscription_id: "rzp1" });
		const res = await PAUSE(req());
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBeTruthy();
	});

	it("404 when no subscription", async () => {
		setSub(null);
		expect((await PAUSE(req())).status).toBe(404);
	});

	it("409 when subscription has no Razorpay id", async () => {
		setSub({ id: "s1", status: "active", razorpay_subscription_id: null });
		expect((await PAUSE(req())).status).toBe(409);
	});

	it("idempotent: already paused → 200 deduped, no Razorpay call", async () => {
		setSub({ id: "s1", status: "paused", razorpay_subscription_id: "rzp1" });
		const res = await PAUSE(req());
		expect(res.status).toBe(200);
		expect((await res.json()).deduped).toBe(true);
		expect(pauseSpy).not.toHaveBeenCalled();
	});

	it("409 when status is not active", async () => {
		setSub({ id: "s1", status: "cancelled", razorpay_subscription_id: "rzp1" });
		expect((await PAUSE(req())).status).toBe(409);
		expect(pauseSpy).not.toHaveBeenCalled();
	});

	it("pauses an active subscription → 200, calls Razorpay", async () => {
		setSub({ id: "s1", status: "active", razorpay_subscription_id: "rzp1" });
		const res = await PAUSE(req());
		expect(res.status).toBe(200);
		expect(pauseSpy).toHaveBeenCalledTimes(1);
	});

	it("502 when Razorpay rejects the pause", async () => {
		setSub({ id: "s1", status: "active", razorpay_subscription_id: "rzp1" });
		pauseSpy.mockRejectedValueOnce(new Error("rzp"));
		expect((await PAUSE(req())).status).toBe(502);
	});
});

describe("POST /api/billing/resume", () => {
	it("404 when no subscription", async () => {
		setSub(null);
		expect((await RESUME(req())).status).toBe(404);
	});

	it("idempotent: already active → 200 deduped, no Razorpay call", async () => {
		setSub({ id: "s1", status: "active", razorpay_subscription_id: "rzp1" });
		const res = await RESUME(req());
		expect(res.status).toBe(200);
		expect((await res.json()).deduped).toBe(true);
		expect(resumeSpy).not.toHaveBeenCalled();
	});

	it("409 when status is not paused", async () => {
		setSub({ id: "s1", status: "cancelled", razorpay_subscription_id: "rzp1" });
		expect((await RESUME(req())).status).toBe(409);
		expect(resumeSpy).not.toHaveBeenCalled();
	});

	it("resumes a paused subscription → 200, calls Razorpay", async () => {
		setSub({ id: "s1", status: "paused", razorpay_subscription_id: "rzp1" });
		const res = await RESUME(req());
		expect(res.status).toBe(200);
		expect(resumeSpy).toHaveBeenCalledTimes(1);
	});

	it("502 when Razorpay rejects the resume", async () => {
		setSub({ id: "s1", status: "paused", razorpay_subscription_id: "rzp1" });
		resumeSpy.mockRejectedValueOnce(new Error("rzp"));
		expect((await RESUME(req())).status).toBe(502);
	});
});
