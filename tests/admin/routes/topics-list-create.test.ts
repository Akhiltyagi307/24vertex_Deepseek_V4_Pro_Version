import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const revalidateCurriculumTopicCaches = vi.fn();
const selectLimit = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TOPIC_CREATE: "topic_create" },
}));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({ where: () => ({ orderBy: () => ({ limit: selectLimit }) }) }),
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

const SUBJECT_UUID = "11111111-1111-4111-8111-111111111111";

describe("D32 Sprint C · topics list (GET) + create (POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
		selectLimit.mockReset();
		insertReturning.mockReset();
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/topics/route");
		const res = await GET(adminRequest(`/api/admin/topics?subject_id=${SUBJECT_UUID}`));
		expect(res.status).toBe(401);
	});

	it("list GET: rejects missing subject_id", async () => {
		const { GET } = await import("@/app/api/admin/topics/route");
		const res = await GET(adminRequest("/api/admin/topics"));
		expect(res.status).toBe(400);
	});

	it("list GET: rejects invalid subject_id", async () => {
		const { GET } = await import("@/app/api/admin/topics/route");
		const res = await GET(adminRequest("/api/admin/topics?subject_id=bad"));
		expect(res.status).toBe(400);
	});

	it("list GET: returns page + next_after when more rows than limit", async () => {
		const rows = Array.from({ length: 51 }, (_, i) => ({ id: `t-${i}` }));
		selectLimit.mockResolvedValueOnce(rows);
		const { GET } = await import("@/app/api/admin/topics/route");
		const res = await GET(adminRequest(`/api/admin/topics?subject_id=${SUBJECT_UUID}&limit=50`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[]; next_after: string | null };
		expect(body.data).toHaveLength(50);
		expect(body.next_after).toBe("t-49");
	});

	it("POST: rejects missing required fields", async () => {
		const { POST } = await import("@/app/api/admin/topics/route");
		const res = await POST(
			adminRequest("/api/admin/topics", { body: { subject_id: SUBJECT_UUID } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/topics/route");
		const res = await POST(
			adminRequest("/api/admin/topics", {
				body: {
					subject_id: SUBJECT_UUID,
					grade: 10,
					unit_name: "U",
					unit_number: 1,
					chapter_name: "C",
					chapter_number: 1,
					topic_name: "T",
					topic_number: 1,
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path inserts + audits + revalidates", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "topic-new" }]);
		const { POST } = await import("@/app/api/admin/topics/route");
		const res = await POST(
			adminRequest("/api/admin/topics", {
				body: {
					subject_id: SUBJECT_UUID,
					grade: 10,
					unit_name: "U",
					unit_number: 1,
					chapter_name: "C",
					chapter_number: 1,
					topic_name: "T",
					topic_number: 1,
				},
			}),
		);
		expect(res.status).toBe(201);
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("topic_create");
		expect(audit.targetId).toBe("topic-new");
	});
});
