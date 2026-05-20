import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectWhere = vi.fn();
const txUpdateWhere = vi.fn(async () => undefined);
const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
	cb({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
);
const revalidateCurriculumTopicCaches = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { SUBJECT_REORDER: "subject_reorder" },
}));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: selectWhere }) }),
		transaction,
	},
}));

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("D32 Sprint B · POST /api/admin/subjects/reorder", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectWhere.mockReset();
		transaction.mockClear();
		revalidateCurriculumTopicCaches.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", { body: { ids: [UUID_1] } }),
		);
		expect(res.status).toBe(401);
	});

	it("rejects empty ids", async () => {
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", { body: { ids: [] } }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra body keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", {
				body: { ids: [UUID_1], extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects when some ids are unknown (count mismatch)", async () => {
		selectWhere.mockResolvedValueOnce([{ id: UUID_1, grade: 10 }]);
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", { body: { ids: [UUID_1, UUID_2] } }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects when ids span different grades", async () => {
		selectWhere.mockResolvedValueOnce([
			{ id: UUID_1, grade: 10 },
			{ id: UUID_2, grade: 11 },
		]);
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", { body: { ids: [UUID_1, UUID_2] } }),
		);
		expect(res.status).toBe(400);
	});

	it("happy path: reorders + audits + revalidates", async () => {
		selectWhere.mockResolvedValueOnce([
			{ id: UUID_1, grade: 10 },
			{ id: UUID_2, grade: 10 },
		]);
		const { POST } = await import("@/app/api/admin/subjects/reorder/route");
		const res = await POST(
			adminRequest("/api/admin/subjects/reorder", { body: { ids: [UUID_1, UUID_2] } }),
		);
		expect(res.status).toBe(200);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(txUpdateWhere).toHaveBeenCalledTimes(2);
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { ids: string[] };
		};
		expect(audit.action).toBe("subject_reorder");
		expect(audit.payload.ids).toHaveLength(2);
	});
});
