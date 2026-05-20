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
	ADMIN_ACTIONS: { SUBSCRIPTION_CANCEL_NOW: "subscription_cancel_now" },
}));
vi.mock("@/lib/billing/razorpay", () => ({ cancelSubscription }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const VALID_UUID = "10101010-1010-4101-8010-101010101010";

describe("D32 Sprint B · POST /api/admin/subscriptions/[id]/cancel-now", () => {
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
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest("/api/admin/subscriptions/bad/cancel-now"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when subscription not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("returns noop when already cancelled (idempotent)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "cancelled", razorpaySubscriptionId: null },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).not.toHaveBeenCalled();
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("502 when Razorpay cancel fails (linked subscription)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "active", razorpaySubscriptionId: "sub_rzp_x" },
		]);
		cancelSubscription.mockRejectedValueOnce(new Error("rzp 500"));
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(502);
		expect(updateWhere).not.toHaveBeenCalled();
	});

	it("happy path (no Razorpay link): updates DB + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "active", razorpaySubscriptionId: null },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(cancelSubscription).not.toHaveBeenCalled();
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { synced_razorpay: boolean };
		};
		expect(audit.action).toBe("subscription_cancel_now");
		expect(audit.payload.synced_razorpay).toBe(false);
	});

	it("happy path (Razorpay-linked): cancels at Razorpay first, then DB", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "active", razorpaySubscriptionId: "sub_rzp_x" },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/cancel-now/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/cancel-now`),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(cancelSubscription).toHaveBeenCalledWith("sub_rzp_x", { cancelAtCycleEnd: false });
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			payload: { synced_razorpay: boolean };
		};
		expect(audit.payload.synced_razorpay).toBe(true);
	});
});
