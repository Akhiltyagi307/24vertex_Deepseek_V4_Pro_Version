import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const recordComplianceEvent = vi.fn(async () => {});
const buildComplianceExportZip = vi.fn(async () => ({
	buffer: Buffer.from("zip"),
	manifest: { items: 0 },
}));
const getComplianceExportsBucket = vi.fn(() => "compliance-exports");
const storageUpload = vi.fn(async () => ({ error: null as { message: string } | null }));
const storageSign = vi.fn(async () => ({
	data: { signedUrl: "https://signed.example/x.zip" },
	error: null as { message: string } | null,
}));
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		COMPLIANCE_EXPORT_STARTED: "compliance_export_started",
		COMPLIANCE_EXPORT_READY: "compliance_export_ready",
		COMPLIANCE_EXPORT_FAILED: "compliance_export_failed",
	},
}));
vi.mock("@/lib/compliance/events", () => ({ recordComplianceEvent }));
vi.mock("@/lib/compliance/export-user-data", () => ({ buildComplianceExportZip }));
vi.mock("@/lib/env", () => ({ getComplianceExportsBucket }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		storage: {
			from: () => ({
				upload: storageUpload,
				createSignedUrl: storageSign,
			}),
		},
	}),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const REQ_UUID = "12121212-1212-4121-8121-121212121212";

describe("D32 Sprint B · POST /api/admin/compliance/requests/[id]/export", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		recordComplianceEvent.mockClear();
		buildComplianceExportZip.mockClear();
		storageUpload.mockClear();
		storageUpload.mockResolvedValue({ error: null });
		storageSign.mockClear();
		storageSign.mockResolvedValue({
			data: { signedUrl: "https://signed.example/x.zip" },
			error: null,
		});
		selectLimit.mockReset();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/export`),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("400 on invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests/bad/export"),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when request not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/export`),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when identity not verified", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, identityVerified: false, subjectUserId: "user-1", status: "open" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/export`),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(409);
	});

	it("500 when storage upload fails (audits the failure)", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, identityVerified: true, subjectUserId: "user-1", status: "open" },
		]);
		storageUpload.mockResolvedValueOnce({ error: { message: "quota exceeded" } });
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/export`),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(500);
		const failAudit = writeAdminAction.mock.calls.find(
			(c) => (c[0] as unknown as { action: string }).action === "compliance_export_failed",
		);
		expect(failAudit).toBeDefined();
	});

	it("happy path: returns signed URL + strict READY audit", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: REQ_UUID, identityVerified: true, subjectUserId: "user-1", status: "in_progress" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/export/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${REQ_UUID}/export`),
			{ params: Promise.resolve({ id: REQ_UUID }) },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { signed_url: string; storage_path: string };
		expect(body.signed_url).toMatch(/^https?:\/\//);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const strict = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(strict.action).toBe("compliance_export_ready");
	});
});
