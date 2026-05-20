import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const insertOnConflictDoUpdate = vi.fn(async () => undefined);
const updateReturning = vi.fn(async () => [{ identityKey: "ph_8001234567" }]);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		IDENTITY_BLOCKLIST_UPSERT: "identity_blocklist_upsert",
		TRIAL_CLAIM_RELEASE: "trial_claim_release",
	},
}));
vi.mock("@/db", () => ({
	db: {
		insert: () => ({
			values: () => ({ onConflictDoUpdate: insertOnConflictDoUpdate }),
		}),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) }),
	},
}));

describe("D32 Sprint C · trial-claims/block + release", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		insertOnConflictDoUpdate.mockClear();
		updateReturning.mockReset();
		updateReturning.mockResolvedValue([{ identityKey: "ph_8001234567" }]);
	});

	it("block: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", {
				method: "POST",
				body: { identity_key: "ph_8001234567" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("block: 400 with invalid body", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", { method: "POST", body: {} }),
		);
		expect(res.status).toBe(400);
	});

	it("block: happy path upserts + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/block/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/block", {
				method: "POST",
				body: { identity_key: "ph_8001234567", reason: "fraud ring" },
			}),
		);
		expect(res.status).toBe(200);
		expect(insertOnConflictDoUpdate).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("identity_blocklist_upsert");
		expect(audit.targetId).toBe("ph_8001234567");
	});

	it("release: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", {
				method: "POST",
				body: { identity_key: "ph_8001234567" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("release: 400 with invalid body", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", { method: "POST", body: {} }),
		);
		expect(res.status).toBe(400);
	});

	it("release: 404 when no active claim", async () => {
		updateReturning.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", {
				method: "POST",
				body: { identity_key: "ph_8001234567" },
			}),
		);
		expect(res.status).toBe(404);
	});

	it("release: happy path + strict audit", async () => {
		const { POST } = await import("@/app/api/admin/trial-claims/release/route");
		const res = await POST(
			adminRequest("/api/admin/trial-claims/release", {
				method: "POST",
				body: { identity_key: "ph_8001234567", reason: "false positive" },
			}),
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("trial_claim_release");
		expect(audit.targetId).toBe("ph_8001234567");
	});
});
