import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const adminListSubscriptions = vi.fn(async () => ({
	rows: [] as Array<Record<string, unknown>>,
	total: 0,
}));
const adminGetSubscriptionById = vi.fn<(id: string) => Promise<unknown>>();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/billing/subscriptions-list", () => ({ adminListSubscriptions }));
vi.mock("@/lib/admin/billing/subscription-detail", () => ({ adminGetSubscriptionById }));

const SUB_UUID = "abcdef01-2345-4789-89ab-cdef01234567";

describe("D32 Sprint C · subscriptions list (GET) + detail (GET)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		adminListSubscriptions.mockClear();
		adminListSubscriptions.mockResolvedValue({ rows: [], total: 0 });
		adminGetSubscriptionById.mockReset();
	});

	it("list: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/subscriptions/route");
		const res = await GET(adminRequest("/api/admin/subscriptions"));
		expect(res.status).toBe(401);
	});

	it("list: returns shaped envelope", async () => {
		const now = new Date();
		adminListSubscriptions.mockResolvedValueOnce({
			rows: [
				{
					id: SUB_UUID,
					profile_id: "stu-1",
					plan_code: "pro_monthly",
					status: "active",
					trial_ends_at: null,
					current_period_start: now,
					current_period_end: now,
					cancel_at_period_end: false,
					razorpay_subscription_id: null,
					staff_override: false,
					full_name: "U",
					email: "u@x.com",
					created_at: now,
					updated_at: now,
				},
			],
			total: 1,
		});
		const { GET } = await import("@/app/api/admin/subscriptions/route");
		const res = await GET(adminRequest("/api/admin/subscriptions?status=active&q=u"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[]; total: number };
		expect(body.data).toHaveLength(1);
		expect(body.total).toBe(1);
	});

	it("detail: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/route");
		const res = await GET(adminRequest(`/api/admin/subscriptions/${SUB_UUID}`), {
			params: Promise.resolve({ id: SUB_UUID }),
		});
		expect(res.status).toBe(401);
	});

	it("detail: 400 when UUID invalid", async () => {
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/route");
		const res = await GET(adminRequest("/api/admin/subscriptions/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("detail: 404 when not found", async () => {
		adminGetSubscriptionById.mockResolvedValueOnce(null);
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/route");
		const res = await GET(adminRequest(`/api/admin/subscriptions/${SUB_UUID}`), {
			params: Promise.resolve({ id: SUB_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("detail: happy path serializes subscription + nested usage_periods", async () => {
		const now = new Date();
		adminGetSubscriptionById.mockResolvedValueOnce({
			subscription: {
				id: SUB_UUID,
				profile_id: "stu-1",
				plan_code: "pro_monthly",
				status: "active",
				trial_ends_at: null,
				current_period_start: now,
				current_period_end: now,
				cancel_at_period_end: false,
				razorpay_subscription_id: null,
				razorpay_customer_id: null,
				pending_plan_code: null,
				staff_override: false,
				metadata: {},
				created_at: now,
				updated_at: now,
			},
			profile: { id: "stu-1", full_name: "U" },
			email: "u@x.com",
			plan_name: "Pro Monthly",
			usage_periods: [],
		});
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/route");
		const res = await GET(adminRequest(`/api/admin/subscriptions/${SUB_UUID}`), {
			params: Promise.resolve({ id: SUB_UUID }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { subscription: { id: string }; plan_name: string };
		};
		expect(body.data.subscription.id).toBe(SUB_UUID);
		expect(body.data.plan_name).toBe("Pro Monthly");
	});
});
