import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const recordComplianceEvent = vi.fn(async () => {});

const selectLimit = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COMPLIANCE_IDENTITY_VERIFIED: "compliance_identity_verified" },
}));
vi.mock("@/lib/compliance/events", () => ({ recordComplianceEvent }));
vi.mock("@/lib/compliance/schemas", () => ({
	verifyIdentityBodySchema: z
		.object({ evidence_url: z.string().url().optional() })
		.strict(),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

const REQ_UUID = "90909090-9090-4909-8090-909090909090";

describe("D32 Sprint B · POST /api/admin/compliance/requests/[id]/verify-identity", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		recordComplianceEvent.mockClear();
		selectLimit.mockReset();
		updateReturning.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/compliance/requests/[id]/verify-identity/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/verify-identity`, { body: {} }),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import(
			"@/app/api/admin/compliance/requests/[id]/verify-identity/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/requests/bad/verify-identity", { body: {} }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("400 when evidence_url is not a URL (records compliance event)", async () => {
		const { POST } = await import(
			"@/app/api/admin/compliance/requests/[id]/verify-identity/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/verify-identity`, {
				body: { evidence_url: "not-a-url" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(400);
		expect(recordComplianceEvent).toHaveBeenCalledWith(
			expect.objectContaining({ status: "failed" }),
		);
	});

	it("404 when compliance request not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import(
			"@/app/api/admin/compliance/requests/[id]/verify-identity/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/verify-identity`, { body: {} }),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("happy path: verifies + strict audit + compliance event ok", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, status: "open", evidenceUrl: null },
		]);
		updateReturning.mockResolvedValueOnce([
			{ id: REQ_UUID, identityVerified: true, status: "in_progress" },
		]);
		const { POST } = await import(
			"@/app/api/admin/compliance/requests/[id]/verify-identity/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/verify-identity`, {
				body: { evidence_url: "https://evidence.example/x.pdf" },
			}),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { evidence_url: string | null };
		};
		expect(audit.action).toBe("compliance_identity_verified");
		expect(audit.payload.evidence_url).toBe("https://evidence.example/x.pdf");
		expect(recordComplianceEvent).toHaveBeenCalledWith(
			expect.objectContaining({ status: "ok" }),
		);
	});
});
