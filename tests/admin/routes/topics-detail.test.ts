import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const deleteWhere = vi.fn(async () => undefined);
const revalidateCurriculumTopicCaches = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction, writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TOPIC_UPDATE: "topic_update", TOPIC_DELETE: "topic_delete" },
}));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
		delete: () => ({ where: deleteWhere }),
	},
}));

const TOPIC_UUID = "33333333-3333-4333-8333-333333333333";

describe("D32 Sprint C · topics/[id] (GET + PATCH + DELETE)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		deleteWhere.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
	});

	it("GET: 400 invalid UUID", async () => {
		const { GET } = await import("@/app/api/admin/topics/[id]/route");
		const res = await GET(adminRequest("/api/admin/topics/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("GET: 404 not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/topics/[id]/route");
		const res = await GET(adminRequest(`/api/admin/topics/${TOPIC_UUID}`), {
			params: Promise.resolve({ id: TOPIC_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("GET: happy path returns row", async () => {
		selectLimit.mockResolvedValueOnce([{ id: TOPIC_UUID, topicName: "T" }]);
		const { GET } = await import("@/app/api/admin/topics/[id]/route");
		const res = await GET(adminRequest(`/api/admin/topics/${TOPIC_UUID}`), {
			params: Promise.resolve({ id: TOPIC_UUID }),
		});
		expect(res.status).toBe(200);
	});

	it("PATCH: 400 invalid UUID", async () => {
		const { PATCH } = await import("@/app/api/admin/topics/[id]/route");
		const res = await PATCH(
			adminRequest("/api/admin/topics/bad", { body: { topic_name: "X" } }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("PATCH: happy path patches + audits + revalidates", async () => {
		const { PATCH } = await import("@/app/api/admin/topics/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/topics/${TOPIC_UUID}`, {
				body: { topic_name: "Updated", is_active: false },
			}),
			{ params: Promise.resolve({ id: TOPIC_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("topic_update");
	});

	it("DELETE: 400 invalid UUID", async () => {
		const { DELETE } = await import("@/app/api/admin/topics/[id]/route");
		const res = await DELETE(adminRequest("/api/admin/topics/bad", { method: "DELETE" }), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("DELETE: happy path hard-deletes + strict audit", async () => {
		const { DELETE } = await import("@/app/api/admin/topics/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/topics/${TOPIC_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: TOPIC_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(deleteWhere).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("topic_delete");
	});
});
