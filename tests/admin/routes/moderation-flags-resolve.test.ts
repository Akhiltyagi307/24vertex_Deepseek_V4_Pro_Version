import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { MODERATION_FLAG_RESOLVE: "moderation_flag_resolve" },
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const FLAG_ID = "flag-uuid-123";

describe("D32 Sprint B · POST /api/admin/moderation/flags/[id]/resolve", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/moderation/flags/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/moderation/flags/${FLAG_ID}/resolve`, {
				body: { status: "upheld" },
			}),
			{ params: Promise.resolve({ id: FLAG_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid status (enum constraint)", async () => {
		const { POST } = await import("@/app/api/admin/moderation/flags/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/moderation/flags/${FLAG_ID}/resolve`, {
				body: { status: "nope" },
			}),
			{ params: Promise.resolve({ id: FLAG_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/moderation/flags/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/moderation/flags/${FLAG_ID}/resolve`, {
				body: { status: "open", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: FLAG_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("resolves + audits with full payload", async () => {
		const { POST } = await import("@/app/api/admin/moderation/flags/[id]/resolve/route");
		const res = await POST(
			adminRequest(`/api/admin/moderation/flags/${FLAG_ID}/resolve`, {
				body: { status: "dismissed", resolution: "not_a_violation", resolution_notes: "ok" },
			}),
			{ params: Promise.resolve({ id: FLAG_ID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { status: string; resolution: string };
		};
		expect(audit.action).toBe("moderation_flag_resolve");
		expect(audit.targetId).toBe(FLAG_ID);
		expect(audit.payload.status).toBe("dismissed");
	});
});
