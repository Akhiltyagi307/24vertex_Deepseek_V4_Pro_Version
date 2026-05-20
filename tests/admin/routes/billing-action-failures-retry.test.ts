import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const consumeAdminActionRateLimit = vi.fn(async () => ({
	allowed: true,
	remaining: 19,
	resetAt: new Date(Date.now() + 60_000),
	degraded: false,
}));

const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const rpc = vi.fn<
	(name: string, args: unknown) => Promise<{
		data: { ok: boolean; applied: boolean } | null;
		error: { message: string } | null;
	}>
>(async () => ({ data: { ok: true, applied: true }, error: null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BILLING_ACTION_FAILURE_RETRY: "billing_action_failure_retry" },
}));
vi.mock("@/lib/admin/rate-limit-action", () => ({
	consumeAdminActionRateLimit,
	adminActionScope: ({ jti }: { jti?: string }) => `jti:${jti ?? "anon"}`,
}));
vi.mock("@/lib/billing/action-failures", () => ({
	BILLING_ACTION_FAILURE_KINDS: { COUPON_REDEMPTION: "coupon_redemption" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({ rpc }),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const FAILURE_UUID = "60606060-6060-4606-8060-606060606060";

describe("D32 Sprint B · POST /api/admin/billing/action-failures/[id]/retry", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		consumeAdminActionRateLimit.mockClear();
		consumeAdminActionRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 19,
			resetAt: new Date(Date.now() + 60_000),
			degraded: false,
		});
		selectLimit.mockReset();
		updateWhere.mockClear();
		rpc.mockClear();
		rpc.mockResolvedValue({ data: { ok: true, applied: true }, error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest("/api/admin/billing/action-failures/bad/retry"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("429 when rate-limited; no retry attempted", async () => {
		consumeAdminActionRateLimit.mockResolvedValueOnce({
			allowed: false,
			remaining: 0,
			resetAt: new Date(Date.now() + 30_000),
			degraded: false,
		});
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(429);
		expect(selectLimit).not.toHaveBeenCalled();
	});

	it("404 when failure row not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when already resolved", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: FAILURE_UUID, resolvedAt: new Date(), kind: "coupon_redemption", retryCount: 1 },
		]);
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(409);
	});

	it("happy path: retry succeeds, marks resolved + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: FAILURE_UUID,
				resolvedAt: null,
				kind: "coupon_redemption",
				couponId: "c1",
				profileId: "p1",
				subscriptionId: "s1",
				retryCount: 0,
				errorMessage: "old err",
			},
		]);
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(rpc).toHaveBeenCalledWith(
			"billing_apply_checkout_coupon_redemption_atomic",
			expect.objectContaining({ p_coupon_id: "c1" }),
		);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { succeeded: boolean };
		};
		expect(audit.action).toBe("billing_action_failure_retry");
		expect(audit.payload.succeeded).toBe(true);
	});

	it("502 when retry fails (RPC error)", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: FAILURE_UUID,
				resolvedAt: null,
				kind: "coupon_redemption",
				couponId: "c1",
				profileId: "p1",
				subscriptionId: "s1",
				retryCount: 1,
				errorMessage: "previous error",
			},
		]);
		rpc.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } });
		const { POST } = await import("@/app/api/admin/billing/action-failures/[id]/retry/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/action-failures/${FAILURE_UUID}/retry`),
			{ params: Promise.resolve({ id: FAILURE_UUID }) },
		);
		expect(res.status).toBe(502);
		// Audit still fires (it's outside the retry-success branch).
		expect(writeAdminActionStrict).toHaveBeenCalled();
	});
});
