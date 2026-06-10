import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const verifyAdminTotpIfConfigured = vi.fn(() => true);
const consumeAdminTotp = vi.fn(async () => verifyAdminTotpIfConfigured());
const isAdminTotpRequired = vi.fn(async () => true);
const performComplianceErasure = vi.fn(async () => ({ profiles: 1, sessions: 0 }));

const complianceSelectLimit = vi.fn();
const complianceUpdateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		COMPLIANCE_ERASURE_DRY_RUN: "compliance_erasure_dry_run",
		COMPLIANCE_ERASURE_COMMIT: "compliance_erasure_commit",
	},
}));
vi.mock("@/lib/admin/auth", () => ({ verifyAdminTotpIfConfigured, consumeAdminTotp }));
vi.mock("@/lib/admin/feature-flags", () => ({ isAdminTotpRequired }));
vi.mock("@/lib/compliance/erasure", () => ({ performComplianceErasure }));
vi.mock("@/lib/compliance/schemas", () => ({
	eraseBodySchema: z
		.object({
			dry_run: z.boolean(),
			totp: z.string().optional(),
			idempotency_key: z.string().optional(),
		})
		.strict(),
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({ where: () => ({ limit: complianceSelectLimit }) }),
		}),
		update: () => ({ set: () => ({ where: complianceUpdateWhere }) }),
	},
}));

const VALID_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("D32 Sprint B · POST /api/admin/compliance/requests/[id]/erase", () => {
	beforeEach(() => {
		process.env.ADMIN_TOTP_SECRET = "test-secret-padding-to-make-it-long-enough";
	});

	afterEach(() => {
		delete process.env.ADMIN_TOTP_SECRET;
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		complianceSelectLimit.mockReset();
		complianceUpdateWhere.mockClear();
		performComplianceErasure.mockClear();
		verifyAdminTotpIfConfigured.mockReturnValue(true);
		isAdminTotpRequired.mockResolvedValue(true);
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("rejects invalid UUID", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests/bad/erase", {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when compliance request not found", async () => {
		complianceSelectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("409 when request type is not erasure", async () => {
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "access", identityVerified: true, subjectUserId: "x", status: "pending" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(409);
	});

	it("409 when identity not verified", async () => {
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "erasure", identityVerified: false, subjectUserId: "x", status: "pending" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(409);
	});

	it("403 when ADMIN_TOTP_SECRET is not configured", async () => {
		delete process.env.ADMIN_TOTP_SECRET;
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "erasure", identityVerified: true, subjectUserId: "user-1", status: "pending" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(403);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("401 when TOTP missing/invalid", async () => {
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "erasure", identityVerified: true, subjectUserId: "user-1", status: "pending" },
		]);
		verifyAdminTotpIfConfigured.mockReturnValueOnce(false);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "000000" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(401);
		expect(performComplianceErasure).not.toHaveBeenCalled();
	});

	it("dry-run uses writeAdminAction (best-effort) and skips fulfilled update", async () => {
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "erasure", identityVerified: true, subjectUserId: "user-1", status: "pending" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: true, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(performComplianceErasure).toHaveBeenCalledWith("user-1", expect.objectContaining({ dryRun: true }));
		expect(writeAdminAction).toHaveBeenCalledTimes(1);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
		expect(complianceUpdateWhere).not.toHaveBeenCalled();
	});

	it("commit uses writeAdminActionStrict and marks request fulfilled", async () => {
		complianceSelectLimit.mockResolvedValueOnce([
			{ id: VALID_UUID, requestType: "erasure", identityVerified: true, subjectUserId: "user-1", status: "pending" },
		]);
		const { POST } = await import("@/app/api/admin/compliance/requests/[id]/erase/route");
		const res = await POST(
			adminRequest(`/api/admin/compliance/requests/${VALID_UUID}/erase`, {
				body: { dry_run: false, totp: "123456" },
			}),
			{ params: Promise.resolve({ id: VALID_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(performComplianceErasure).toHaveBeenCalledWith("user-1", expect.objectContaining({ dryRun: false }));
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		expect(complianceUpdateWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("compliance_erasure_commit");
	});
});
