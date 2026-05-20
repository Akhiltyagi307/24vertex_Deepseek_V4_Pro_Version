import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const releaseReturning = vi.fn();
const insertOnConflict = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		TRIAL_CLAIM_RELEASE: "trial_claim_release",
		IDENTITY_BLOCKLIST_UPSERT: "identity_blocklist_upsert",
	},
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({
			set: () => ({ where: () => ({ returning: releaseReturning }) }),
		}),
		insert: () => ({
			values: () => ({ onConflictDoUpdate: insertOnConflict }),
		}),
	},
}));

describe("D32 Sprint B · /api/admin/trial-claims/release + /block", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		releaseReturning.mockReset();
		insertOnConflict.mockClear();
	});

	it("release: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", { body: { identity_key: "abc" } }),
		);
		expect(res.status).toBe(401);
	});

	it("release: rejects empty identity_key", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", { body: { identity_key: "" } }),
		);
		expect(res.status).toBe(400);
	});

	it("release: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", {
				body: { identity_key: "abc", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("release: 404 when no active claim found", async () => {
		releaseReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", { body: { identity_key: "abc" } }),
		);
		expect(res.status).toBe(404);
	});

	it("release: happy path strict audit", async () => {
		releaseReturning.mockResolvedValueOnce([{ identityKey: "abc" }]);
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", {
				body: { identity_key: "abc", reason: "support" },
			}),
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { reason: string };
		};
		expect(audit.action).toBe("trial_claim_release");
		expect(audit.targetId).toBe("abc");
		expect(audit.payload.reason).toBe("support");
	});

	it("block: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", { body: { identity_key: "abc" } }),
		);
		expect(res.status).toBe(401);
	});

	it("block: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", {
				body: { identity_key: "abc", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("block: upserts + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", {
				body: { identity_key: "abc", reason: "fraud" },
			}),
		);
		expect(res.status).toBe(200);
		expect(insertOnConflict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("identity_blocklist_upsert");
		expect(audit.targetId).toBe("abc");
	});
});
