import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const canFlipSubscriptionStatusOffline = vi.fn(() => true);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBSCRIPTION_FLIP_STATUS: "subscription_flip_status" },
}));
vi.mock("@/lib/billing/subscription-admin-transitions", () => ({
	canFlipSubscriptionStatusOffline,
	isSubscriptionStatus: (s: string) =>
		["created", "active", "grace", "past_due", "cancelled", "expired", "trialing"].includes(s),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({ where: () => ({ limit: selectLimit }) }),
		}),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const VALID_UUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("D32 Sprint B · POST /api/admin/subscriptions/[id]/flip-status", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		canFlipSubscriptionStatusOffline.mockReturnValue(true);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects unknown target_status", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "totally-fake-status" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra body keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when subscription not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects Razorpay-linked subscription (offline-only invariant)", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: VALID_UUID,
				status: "active",
				razorpaySubscriptionId: "sub_rzp_1",
			},
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(updateWhere).not.toHaveBeenCalled();
	});

	it("rejects disallowed transition", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "active", razorpaySubscriptionId: null },
		]);
		canFlipSubscriptionStatusOffline.mockReturnValueOnce(false);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("flips status and audits with from/to + offline_only", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, status: "active", razorpaySubscriptionId: null },
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/flip-status/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/flip-status`, {
				body: { target_status: "cancelled", reason: "user request" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { from: string; to: string; offline_only: boolean; reason: string | null };
		};
		expect(audit.action).toBe("subscription_flip_status");
		expect(audit.payload.from).toBe("active");
		expect(audit.payload.to).toBe("cancelled");
		expect(audit.payload.offline_only).toBe(true);
	});
});
