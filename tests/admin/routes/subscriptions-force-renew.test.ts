import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const txUpdateWhere = vi.fn(async () => undefined);
const txSelectLimit = vi.fn();
const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
	cb({
		update: () => ({ set: () => ({ where: txUpdateWhere }) }),
		select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: txSelectLimit }) }) }) }),
	}),
);
const dbSelectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBSCRIPTION_FORCE_RENEW: "subscription_force_renew" },
}));
vi.mock("@/lib/billing/add-plan-billing-interval", () => ({
	addPlanBillingInterval: (anchor: Date) => new Date(anchor.getTime() + 30 * 86_400_000),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				innerJoin: () => ({ where: () => ({ limit: dbSelectLimit }) }),
			}),
		}),
		transaction,
	},
}));

const VALID_UUID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("D32 Sprint B · POST /api/admin/subscriptions/[id]/force-renew", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		dbSelectLimit.mockReset();
		transaction.mockClear();
		txSelectLimit.mockReset();
		delete process.env.ADMIN_BILLING_FORCE_RENEW_RZP;
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, { body: {} }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid extend_days (out of range)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, {
				body: { extend_days: 9999 },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra body keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, {
				body: { extend_days: 30, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when subscription not found", async () => {
		dbSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, { body: {} }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects Razorpay-linked sub without break-glass env", async () => {
		dbSelectLimit.mockResolvedValueOnce([
			{
				sub: {
					id: VALID_UUID,
					currentPeriodEnd: new Date(),
					razorpaySubscriptionId: "sub_rzp_x",
				},
				interval: "month",
			},
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, { body: {} }),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(transaction).not.toHaveBeenCalled();
	});

	it("happy path: pushes current_period_end + strict audit", async () => {
		const now = new Date();
		dbSelectLimit.mockResolvedValueOnce([
			{
				sub: {
					id: VALID_UUID,
					currentPeriodEnd: now,
					razorpaySubscriptionId: null,
				},
				interval: "month",
			},
		]);
		txSelectLimit.mockResolvedValueOnce([{ id: "usage-1" }]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/force-renew/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${VALID_UUID}/force-renew`, {
				body: { extend_days: 7 },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(transaction).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { extend_days: number | null; razorpay_linked: boolean };
		};
		expect(audit.action).toBe("subscription_force_renew");
		expect(audit.payload.extend_days).toBe(7);
		expect(audit.payload.razorpay_linked).toBe(false);
	});
});
