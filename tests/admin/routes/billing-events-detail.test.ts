import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const updateReturning = vi.fn(async () => [{ id: "ev-1" }]);
const processRazorpayWebhookPayload = vi.fn(async () => undefined);
const createServiceRoleClient = vi.fn(() => ({}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		BILLING_EVENT_REPLAY: "billing_event_replay",
		BILLING_EVENT_REPLAY_FAILED: "billing_event_replay_failed",
		BILLING_EVENT_RESOLVE: "billing_event_resolve",
	},
}));
vi.mock("@/lib/billing/razorpay-webhook-processor", () => ({
	processRazorpayWebhookPayload,
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({
			set: () => ({
				where: updateWhere,
				returning: () => ({}) as never,
			}),
		}),
	},
}));

const EV = "55555555-5555-4555-8555-555555555555";

describe("D32 Sprint C · billing/events/[id] GET + replay + resolve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		updateReturning.mockReset();
		updateReturning.mockResolvedValue([{ id: "ev-1" }]);
		processRazorpayWebhookPayload.mockReset();
		processRazorpayWebhookPayload.mockResolvedValue(undefined);
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/billing/events/[id]/route");
		const res = await GET(adminRequest(`/api/admin/billing/events/${EV}`), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(401);
	});

	it("GET: 400 invalid id", async () => {
		const { GET } = await import("@/app/api/admin/billing/events/[id]/route");
		const res = await GET(adminRequest("/api/admin/billing/events/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("GET: 404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/billing/events/[id]/route");
		const res = await GET(adminRequest(`/api/admin/billing/events/${EV}`), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(404);
	});

	it("GET: happy path serializes row", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: EV,
				razorpayEventId: "evt_x",
				eventType: "subscription.activated",
				payload: { event: "subscription.activated" },
				processedAt: new Date(),
				error: null,
				createdAt: new Date(),
				replayCount: 0,
				lastReplayAt: null,
				resolvedAt: null,
				resolvedBy: null,
			},
		]);
		const { GET } = await import("@/app/api/admin/billing/events/[id]/route");
		const res = await GET(adminRequest(`/api/admin/billing/events/${EV}`), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(200);
	});

	it("replay: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/replay`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(401);
	});

	it("replay: 400 invalid uuid", async () => {
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest("/api/admin/billing/events/bad/replay", { method: "POST" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("replay: 404 when event not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/replay`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(404);
	});

	it("replay: 400 invalid stored payload", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: EV, razorpayEventId: "evt", eventType: "x", payload: null },
		]);
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/replay`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(400);
	});

	it("replay: 500 + best-effort audit when processor throws", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: EV,
				razorpayEventId: "evt",
				eventType: "x",
				payload: { event: "x", payload: {} },
			},
		]);
		processRazorpayWebhookPayload.mockRejectedValueOnce(new Error("rzp boom"));
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/replay`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(500);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("billing_event_replay_failed");
	});

	it("replay: happy path runs processor + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{
				id: EV,
				razorpayEventId: "evt",
				eventType: "subscription.activated",
				payload: { event: "subscription.activated", payload: {} },
			},
		]);
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/replay`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(200);
		expect(processRazorpayWebhookPayload).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("billing_event_replay");
	});
});
