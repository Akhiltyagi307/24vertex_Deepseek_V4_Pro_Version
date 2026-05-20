import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const revalidateCurriculumTopicCaches = vi.fn();
const orderBy = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBJECT_CREATE: "subject_create" },
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
		select: () => ({ from: () => ({ orderBy }) }),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint C · /api/admin/subjects (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
		orderBy.mockReset();
		insertReturning.mockReset();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/subjects/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("GET: returns subjects ordered by grade/sort/name", async () => {
		orderBy.mockResolvedValueOnce([
			{ id: "sub-1", name: "Math", grade: 10 },
			{ id: "sub-2", name: "Physics", grade: 10 },
		]);
		const { GET } = await import("@/app/api/admin/subjects/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[] };
		expect(body.data).toHaveLength(2);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subjects/route");
		const res = await POST(
			adminRequest("/api/admin/subjects", { body: { name: "Math", grade: 10 } }),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects invalid grade", async () => {
		const { POST } = await import("@/app/api/admin/subjects/route");
		const res = await POST(
			adminRequest("/api/admin/subjects", { body: { name: "Math", grade: 99 } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path inserts + audits + revalidates", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "sub-new" }]);
		const { POST } = await import("@/app/api/admin/subjects/route");
		const res = await POST(
			adminRequest("/api/admin/subjects", { body: { name: "Math", grade: 10 } }),
		);
		expect(res.status).toBe(201);
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("subject_create");
		expect(audit.targetId).toBe("sub-new");
	});
});
