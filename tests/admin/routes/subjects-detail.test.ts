import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const revalidateCurriculumTopicCaches = vi.fn();
const selectLimit = vi.fn();
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		SUBJECT_UPDATE: "subject_update",
		SUBJECT_SOFT_DELETE: "subject_soft_delete",
	},
}));
vi.mock("@/lib/admin/schemas/subject", () => ({
	adminSubjectCreateSchema: z
		.object({
			name: z.string().min(1),
			grade: z.number().int().min(1).max(12),
			subject_group: z.string().nullable().optional(),
			stream: z.string().nullable().optional(),
			is_elective: z.boolean().optional(),
			sort_order: z.number().int().optional(),
		})
		.strict(),
}));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const SUB_UUID = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint C · /api/admin/subjects/[id] (GET + PATCH + DELETE)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectLimit.mockReset();
		updateWhere.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
	});

	it("GET: 400 invalid UUID", async () => {
		const { GET } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await GET(adminRequest("/api/admin/subjects/bad"), {
			params: Promise.resolve({ id: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("GET: 404 when not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await GET(adminRequest(`/api/admin/subjects/${SUB_UUID}`), {
			params: Promise.resolve({ id: SUB_UUID }),
		});
		expect(res.status).toBe(404);
	});

	it("GET: happy path returns row", async () => {
		selectLimit.mockResolvedValueOnce([{ id: SUB_UUID, name: "Math", grade: 10 }]);
		const { GET } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await GET(adminRequest(`/api/admin/subjects/${SUB_UUID}`), {
			params: Promise.resolve({ id: SUB_UUID }),
		});
		expect(res.status).toBe(200);
	});

	it("PATCH: 404 when subject not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { PATCH } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/subjects/${SUB_UUID}`, { body: { name: "X" } }),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("PATCH: happy path merges + audits + revalidates", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: SUB_UUID, name: "Math", grade: 10, subjectGroup: null, stream: null, isElective: false, sortOrder: 0 },
		]);
		const { PATCH } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/subjects/${SUB_UUID}`, { body: { sort_order: 5 } }),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("subject_update");
	});

	it("DELETE: 400 invalid UUID", async () => {
		const { DELETE } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await DELETE(
			adminRequest("/api/admin/subjects/bad", { method: "DELETE" }),
			{ params: Promise.resolve({ id: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("DELETE: happy path soft-deletes (isActive:false) + audits", async () => {
		const { DELETE } = await import("@/app/api/admin/subjects/[id]/route");
		const res = await DELETE(
			adminRequest(`/api/admin/subjects/${SUB_UUID}`, { method: "DELETE" }),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as { action: string };
		expect(audit.action).toBe("subject_soft_delete");
	});
});
