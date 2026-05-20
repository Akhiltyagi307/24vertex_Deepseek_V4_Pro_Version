import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const selectFromLimit = vi.fn();
const countFromWhere = vi.fn();
const replayUpdateWhere = vi.fn(async () => undefined);
const resolveReturning = vi.fn();
const processRazorpayWebhookPayload = vi.fn(async () => {});

let nextSelect: "rows" | "count" = "rows";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		BILLING_EVENT_REPLAY: "billing_event_replay",
		BILLING_EVENT_REPLAY_FAILED: "billing_event_replay_failed",
		BILLING_EVENT_RESOLVE: "billing_event_resolve",
	},
}));
vi.mock("@/lib/billing/razorpay-webhook-processor", () => ({ processRazorpayWebhookPayload }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({}),
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "total" in (sel as object)) {
				nextSelect = "count";
			}
			if (nextSelect === "count") {
				nextSelect = "rows";
				return { from: () => ({ where: countFromWhere, $dynamic: () => ({}) }) };
			}
			return {
				from: () => {
					const builder = {
						$dynamic: () => builder,
						where: () => builder,
						orderBy: () => ({ limit: () => ({ offset: selectFromLimit }) }),
						limit: () => ({ offset: selectFromLimit }),
					};
					return builder;
				},
			};
		}),
		update: () => ({
			set: () => ({
				where: () => {
					if (resolveReturning.mock.calls.length === 0 && resolveReturning.getMockImplementation()) {
						return { returning: resolveReturning };
					}
					return replayUpdateWhere();
				},
			}),
		}),
	},
}));

const EVENT_UUID = "13131313-1313-4131-8131-131313131313";

describe("D32 Sprint C · /api/admin/billing/events list + replay + resolve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		selectFromLimit.mockReset();
		countFromWhere.mockReset();
		replayUpdateWhere.mockClear();
		resolveReturning.mockReset();
		processRazorpayWebhookPayload.mockClear();
		processRazorpayWebhookPayload.mockResolvedValue(undefined);
		nextSelect = "rows";
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/billing/events/route");
		const res = await GET(adminRequest("/api/admin/billing/events"));
		expect(res.status).toBe(401);
	});

	it("replay: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/events/${EVENT_UUID}/replay`),
			{ params: Promise.resolve({ id: EVENT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("replay: rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/billing/events/[id]/replay/route");
		const res = await POST(
			adminRequest("/api/admin/billing/events/bad/replay"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("resolve: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/billing/events/${EVENT_UUID}/resolve`),
			{ params: Promise.resolve({ id: EVENT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("resolve: 400 when invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(
			adminRequest("/api/admin/billing/events/bad/resolve"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});
});
