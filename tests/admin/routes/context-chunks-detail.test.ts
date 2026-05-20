import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const updateWhere = vi.fn(async () => undefined);
const deleteWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		CONTEXT_CHUNK_UPDATE: "context_chunk_update",
		CONTEXT_CHUNK_DELETE: "context_chunk_delete",
	},
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({ set: () => ({ where: updateWhere }) }),
		delete: () => ({ where: deleteWhere }),
	},
}));

const CHUNK_UUID = "44444444-4444-4444-8444-444444444444";

describe("D32 Sprint C · context-chunks/[id] (PATCH + DELETE)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		updateWhere.mockClear();
		deleteWhere.mockClear();
	});

	it("PATCH: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/context-chunks/${CHUNK_UUID}`, { body: { content: "x" } }),
			{ params: Promise.resolve({ id: CHUNK_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("PATCH: 400 invalid UUID", async () => {
		const { PATCH } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await PATCH(
			adminRequest("/api/admin/context-chunks/bad", { body: { content: "x" } }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: happy path updates + audits", async () => {
		const { PATCH } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/context-chunks/${CHUNK_UUID}`, {
				body: { content: "new content", chunk_type: "exercise" },
			}),
			{ params: Promise.resolve({ id: CHUNK_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("context_chunk_update");
	});

	it("DELETE: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { DELETE } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/context-chunks/${CHUNK_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: CHUNK_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("DELETE: 400 invalid UUID", async () => {
		const { DELETE } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await DELETE(
			adminRequest("/api/admin/context-chunks/bad", { method: "DELETE" }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("DELETE: hard-deletes + strict audit", async () => {
		const { DELETE } = await import("@/app/api/admin/context-chunks/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/context-chunks/${CHUNK_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: CHUNK_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("context_chunk_delete");
	});
});
