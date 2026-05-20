import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const selectLimit = vi.fn();
const joinedSelectLimit = vi.fn();
const usagePeriodsOffset = vi.fn();
const updateWhere = vi.fn(async () => undefined);
let nextSelect: "clear" | "recompute-join" | "recompute-periods" = "clear";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		SUBSCRIPTION_CLEAR_CANCEL_AT_PERIOD_END: "subscription_clear_cancel_at_period_end",
		SUBSCRIPTION_RECOMPUTE_USAGE: "subscription_recompute_usage",
	},
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "recompute-join") {
				return {
					from: () => ({
						innerJoin: () => ({
							innerJoin: () => ({
								where: () => ({ limit: joinedSelectLimit }),
							}),
						}),
					}),
				};
			}
			if (nextSelect === "recompute-periods") {
				return {
					from: () => ({
						where: () => ({
							orderBy: () => ({ limit: usagePeriodsOffset }),
						}),
					}),
				};
			}
			return { from: () => ({ where: () => ({ limit: selectLimit }) }) };
		}),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const SUB = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint C · subscriptions/[id] clear-cancel-at-period-end + recompute-usage", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		joinedSelectLimit.mockReset();
		usagePeriodsOffset.mockReset();
		updateWhere.mockClear();
		nextSelect = "clear";
	});

	it("clear: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/clear-cancel-at-period-end`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(401);
	});

	it("clear: 400 invalid id", async () => {
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest("/api/admin/subscriptions/bad/clear-cancel-at-period-end", { method: "POST" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("clear: 404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/clear-cancel-at-period-end`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(404);
	});

	it("clear: 400 when linked to Razorpay", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB, cancelAtPeriodEnd: true, razorpaySubscriptionId: "sub_x" },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/clear-cancel-at-period-end`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(400);
	});

	it("clear: noop when already not pending cancel", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB, cancelAtPeriodEnd: false, razorpaySubscriptionId: null },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/clear-cancel-at-period-end`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { noop?: boolean };
		expect(body.noop).toBe(true);
	});

	it("clear: happy path clears + audits", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB, cancelAtPeriodEnd: true, razorpaySubscriptionId: null },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/clear-cancel-at-period-end`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("subscription_clear_cancel_at_period_end");
	});

	it("recompute: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		nextSelect = "recompute-join";
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/recompute-usage/route");
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/recompute-usage`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(401);
	});

	it("recompute: 400 invalid id", async () => {
		nextSelect = "recompute-join";
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/recompute-usage/route");
		const res = await POST(adminRequest("/api/admin/subscriptions/bad/recompute-usage", { method: "POST" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("recompute: 404 when subscription join misses", async () => {
		nextSelect = "recompute-join";
		joinedSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/recompute-usage/route");
		const res = await POST(adminRequest(`/api/admin/subscriptions/${SUB}/recompute-usage`, { method: "POST" }), {
			params: Promise.resolve({ id: SUB }),
		});
		expect(res.status).toBe(404);
	});
});
