import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const deleteWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { MODERATION_BLACKLIST_DELETE: "moderation_blacklist_delete" },
}));
vi.mock("@/db", () => ({
	db: { delete: () => ({ where: deleteWhere }) },
}));

const BL_ID = "bl-1";

describe("D32 Sprint C · DELETE /api/admin/moderation/blacklist/[id]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		deleteWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { DELETE } = await import("@/app/api/admin/moderation/blacklist/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/moderation/blacklist/${BL_ID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: BL_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("happy path: deletes + strict audit", async () => {
		const { DELETE } = await import("@/app/api/admin/moderation/blacklist/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/moderation/blacklist/${BL_ID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: BL_ID }) },
		);
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("moderation_blacklist_delete");
		expect(audit.targetId).toBe(BL_ID);
	});
});
