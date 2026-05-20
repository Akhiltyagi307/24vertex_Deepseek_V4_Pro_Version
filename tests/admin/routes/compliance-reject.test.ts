import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const selectLimit = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COMPLIANCE_REQUEST_REJECTED: "compliance_request_rejected" },
}));
vi.mock("@/lib/compliance/schemas", () => ({
	rejectComplianceRequestBodySchema: z
		.object({ reason: z.string().min(1).max(2000) })
		.strict(),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

const REQ_UUID = "40404040-4040-4404-8040-404040404040";

describe("D32 Sprint B · POST /api/admin/compliance/requests/[id]/reject", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateReturning.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/reject`, {
				body: { reason: "incomplete identity proof" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests/bad/reject", {
				body: { reason: "x" },
			}),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/reject`, {
				body: { reason: "test", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when request not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/reject`, {
				body: { reason: "test" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when already fulfilled", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, status: "fulfilled", notes: "" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/reject`, {
				body: { reason: "test" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(409);
	});

	it("happy path: rejects + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, status: "pending", notes: "" },
		]);
		updateReturning.mockResolvedValueOnce([
			{ id: REQ_UUID, status: "rejected" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/reject/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/reject`, {
				body: { reason: "no proof of identity" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { reason: string };
		};
		expect(audit.action).toBe("compliance_request_rejected");
		expect(audit.payload.reason).toBe("no proof of identity");
	});
});
