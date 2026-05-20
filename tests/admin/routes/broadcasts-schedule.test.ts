import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const updateReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BROADCAST_SCHEDULE: "broadcast_schedule" },
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({
			set: () => ({ where: () => ({ returning: updateReturning }) }),
		}),
	},
}));

const BROADCAST_ID = "bcast-1";

describe("D32 Sprint B · POST /api/admin/broadcasts/[id]/schedule", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateReturning.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const future = new Date(Date.now() + 60_000).toISOString();
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: future },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects malformed body (.strict() schema + non-datetime)", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: "not-a-datetime" },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra body keys (D14 strict)", async () => {
		const future = new Date(Date.now() + 60_000).toISOString();
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: future, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects past scheduled_at", async () => {
		const past = new Date(Date.now() - 60_000).toISOString();
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: past },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when broadcast not found", async () => {
		updateReturning.mockResolvedValueOnce([]);
		const future = new Date(Date.now() + 60_000).toISOString();
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: future },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("happy path: audits + returns updated broadcast row", async () => {
		updateReturning.mockResolvedValueOnce([{ id: BROADCAST_ID, status: "scheduled" }]);
		const future = new Date(Date.now() + 60_000).toISOString();
		const { POST } = await import("@/app/api/admin/broadcasts/[id]/schedule/route");
		const res = await POST(
			adminRequest(`/api/admin/broadcasts/${BROADCAST_ID}/schedule`, {
				body: { scheduled_at: future },
			}),
			{ params: Promise.resolve({ id: BROADCAST_ID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("broadcast_schedule");
		expect(audit.targetId).toBe(BROADCAST_ID);
	});
});
