import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const verifyAdminTotpIfConfigured = vi.fn(() => true);
const consumeAdminTotp = vi.fn(async () => verifyAdminTotpIfConfigured());
const isAdminTotpRequired = vi.fn(async () => false);
const purgeRetentionEntity = vi.fn(async () => 7);
const selectOrderBy = vi.fn();
const selectLimit = vi.fn();
const updateReturning = vi.fn(async () => [{ entity: "tests", ttlDays: 90, enabled: true }]);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		RETENTION_POLICY_UPDATED: "retention_policy_updated",
		RETENTION_PURGE_DRY_RUN: "retention_purge_dry_run",
		RETENTION_PURGE_COMMIT: "retention_purge_commit",
	},
}));
vi.mock("@/lib/admin/auth", () => ({ verifyAdminTotpIfConfigured, consumeAdminTotp }));
vi.mock("@/lib/admin/feature-flags", () => ({ isAdminTotpRequired }));
vi.mock("@/lib/compliance/retention-purge", () => ({ purgeRetentionEntity }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: () => ({
				orderBy: selectOrderBy,
				where: () => ({ limit: selectLimit }),
			}),
		})),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

describe("D32 Sprint C · compliance/retention list + PATCH + run-now", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		verifyAdminTotpIfConfigured.mockClear();
		verifyAdminTotpIfConfigured.mockReturnValue(true);
		isAdminTotpRequired.mockReset();
		isAdminTotpRequired.mockResolvedValue(false);
		purgeRetentionEntity.mockClear();
		selectOrderBy.mockReset();
		selectLimit.mockReset();
		updateReturning.mockClear();
		updateReturning.mockResolvedValue([{ entity: "tests", ttlDays: 90, enabled: true }]);
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/compliance/retention/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("list GET: returns rows", async () => {
		selectOrderBy.mockResolvedValueOnce([
			{ entity: "tests", ttlDays: 90, enabled: true },
			{ entity: "audit_log", ttlDays: 365, enabled: false },
		]);
		const { GET } = await import("@/app/api/admin/compliance/retention/route");
		const res = await GET();
		expect(res.status).toBe(200);
	});

	it("PATCH: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/compliance/retention/[entity]/route");
		const res = await PATCH(
			adminRequest("/api/admin/compliance/retention/tests", {
				method: "PATCH",
				body: { ttl_days: 90 },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(401);
	});

	it("PATCH: 400 with no fields to update", async () => {
		const { PATCH } = await import("@/app/api/admin/compliance/retention/[entity]/route");
		const res = await PATCH(
			adminRequest("/api/admin/compliance/retention/tests", {
				method: "PATCH",
				body: {},
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: happy path updates ttl + strict audit", async () => {
		const { PATCH } = await import("@/app/api/admin/compliance/retention/[entity]/route");
		const res = await PATCH(
			adminRequest("/api/admin/compliance/retention/tests", {
				method: "PATCH",
				body: { ttl_days: 90 },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("retention_policy_updated");
		expect(audit.targetId).toBe("tests");
	});

	it("PATCH: 404 when entity not found", async () => {
		updateReturning.mockResolvedValueOnce([]);
		const { PATCH } = await import("@/app/api/admin/compliance/retention/[entity]/route");
		const res = await PATCH(
			adminRequest("/api/admin/compliance/retention/nope", {
				method: "PATCH",
				body: { ttl_days: 30 },
			}),
			{ params: Promise.resolve({ entity: "nope" }) },
		);
		expect(res.status).toBe(404);
	});

	it("run-now: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/compliance/retention/[entity]/run-now/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/retention/tests/run-now", { method: "POST" }),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(401);
	});

	it("run-now: requires commit:true when not dry-run", async () => {
		const { POST } = await import(
			"@/app/api/admin/compliance/retention/[entity]/run-now/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/retention/tests/run-now", {
				method: "POST",
				body: { dry_run: false },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(400);
	});

	it("run-now: dry-run happy path counts rows + best-effort audit", async () => {
		selectLimit.mockResolvedValueOnce([{ entity: "tests", ttlDays: 90, enabled: true }]);
		const { POST } = await import(
			"@/app/api/admin/compliance/retention/[entity]/run-now/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/retention/tests/run-now", {
				method: "POST",
				body: { dry_run: true },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(200);
		expect(purgeRetentionEntity).toHaveBeenCalledWith("tests", 90, true);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("retention_purge_dry_run");
	});

	it("run-now: commit run uses strict audit + requires policy enabled", async () => {
		selectLimit.mockResolvedValueOnce([{ entity: "tests", ttlDays: 90, enabled: false }]);
		const { POST } = await import(
			"@/app/api/admin/compliance/retention/[entity]/run-now/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/retention/tests/run-now", {
				method: "POST",
				body: { dry_run: false, commit: true },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(409);
	});

	it("run-now: TOTP-required + missing totp → 401", async () => {
		isAdminTotpRequired.mockResolvedValueOnce(true);
		verifyAdminTotpIfConfigured.mockReturnValueOnce(false);
		const { POST } = await import(
			"@/app/api/admin/compliance/retention/[entity]/run-now/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/retention/tests/run-now", {
				method: "POST",
				body: { dry_run: false, commit: true },
			}),
			{ params: Promise.resolve({ entity: "tests" }) },
		);
		expect(res.status).toBe(401);
	});
});
