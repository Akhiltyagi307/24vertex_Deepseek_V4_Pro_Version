import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const orderByLimit = vi.fn();
let selectShape: "limit" | "orderby" = "limit";

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
			if (selectShape === "limit") {
				return { from: () => ({ where: () => ({ limit: selectLimit }) }) };
			}
			return {
				from: () => ({
					innerJoin: () => ({ innerJoin: () => ({ where: () => ({ limit: selectLimit }) }) }),
					where: () => ({ orderBy: () => ({ limit: orderByLimit }) }),
				}),
			};
		}),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const SUB_UUID = "70707070-7070-4707-8070-707070707070";

describe("D32 Sprint B · subscriptions/clear-cancel-at-period-end + recompute-usage", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		orderByLimit.mockReset();
		updateWhere.mockClear();
		selectShape = "limit";
	});

	it("clear-cancel: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/clear-cancel-at-period-end`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("clear-cancel: 404 when sub not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/clear-cancel-at-period-end`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("clear-cancel: rejects when sub is Razorpay-linked", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB_UUID, cancelAtPeriodEnd: true, razorpaySubscriptionId: "sub_rzp_x" },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/clear-cancel-at-period-end`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("clear-cancel: noop when already not scheduled to cancel", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB_UUID, cancelAtPeriodEnd: false, razorpaySubscriptionId: null },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/clear-cancel-at-period-end`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).not.toHaveBeenCalled();
	});

	it("clear-cancel: happy path updates + audits", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB_UUID, cancelAtPeriodEnd: true, razorpaySubscriptionId: null },
		]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/clear-cancel-at-period-end/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/clear-cancel-at-period-end`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("subscription_clear_cancel_at_period_end");
	});

	it("recompute-usage: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/recompute-usage/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/recompute-usage`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("recompute-usage: 404 when sub join missing", async () => {
		selectShape = "orderby";
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import(
			"@/app/api/admin/subscriptions/[id]/recompute-usage/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/recompute-usage`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(404);
	});
});
