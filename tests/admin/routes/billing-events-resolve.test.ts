import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const updateReturning = vi.fn(async () => [{ id: "ev-1" }]);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BILLING_EVENT_RESOLVE: "billing_event_resolve" },
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

const EV = "55555555-5555-4555-8555-555555555555";

describe("D32 Sprint C · POST /api/admin/billing/events/[id]/resolve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateReturning.mockReset();
		updateReturning.mockResolvedValue([{ id: "ev-1" }]);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/resolve`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(401);
	});

	it("400 invalid uuid", async () => {
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(adminRequest("/api/admin/billing/events/bad/resolve", { method: "POST" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("404 when event not found", async () => {
		updateReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/resolve`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(404);
	});

	it("happy path: updates + audits", async () => {
		const { POST } = await import("@/app/api/admin/billing/events/[id]/resolve/route");
		const res = await POST(adminRequest(`/api/admin/billing/events/${EV}/resolve`, { method: "POST" }), {
			params: Promise.resolve({ id: EV }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("billing_event_resolve");
		expect(audit.targetId).toBe(EV);
	});
});
