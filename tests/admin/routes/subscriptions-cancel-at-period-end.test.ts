import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const cancelSubscription = vi.fn(async () => {});
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBSCRIPTION_CANCEL_AT_PERIOD_END: "subscription_cancel_at_period_end" },
}));
vi.mock("@/lib/billing/razorpay", () => ({ cancelSubscription }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const VALID_UUID = "30303030-3030-4303-8030-303030303030";

describe("D32 Sprint B · POST /api/admin/subscriptions/[id]/cancel-at-period-end", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		cancelSubscription.mockClear();
		cancelSubscription.mockResolvedValue(undefined);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-at-period-end`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest("/api/admin/subscriptions/bad/cancel-at-period-end"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when sub not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-at-period-end`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("noop when already cancelAtPeriodEnd", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, cancelAtPeriodEnd: true, razorpaySubscriptionId: null },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-at-period-end`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).not.toHaveBeenCalled();
	});

	it("502 when Razorpay cancel-at-cycle fails", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, cancelAtPeriodEnd: false, razorpaySubscriptionId: "sub_rzp_x" },
		]);
		cancelSubscription.mockRejectedValueOnce(new Error("rzp 500"));
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-at-period-end`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(502);
	});

	it("happy path: cancels at cycle + strict audit + DB update", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, cancelAtPeriodEnd: false, razorpaySubscriptionId: "sub_rzp_x" },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-at-period-end/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-at-period-end`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(cancelSubscription).toHaveBeenCalledWith("sub_rzp_x", { cancelAtCycleEnd: true });
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { synced_razorpay: boolean };
		};
		expect(audit.action).toBe("subscription_cancel_at_period_end");
		expect(audit.payload.synced_razorpay).toBe(true);
	});
});
