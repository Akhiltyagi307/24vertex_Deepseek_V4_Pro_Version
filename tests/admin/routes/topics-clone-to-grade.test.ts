import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const cloneTopicsToGrade = vi.fn(async () => 5);
const revalidateCurriculumTopicCaches = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TOPIC_CLONE_TO_GRADE: "topic_clone_to_grade" },
}));
vi.mock("@/lib/admin/topics/clone-to-grade", () => ({ cloneTopicsToGrade }));
vi.mock("@/lib/cache/curriculum-topic-counts", () => ({ revalidateCurriculumTopicCaches }));

const VALID_UUID = "33333333-3333-4333-8333-333333333333";

describe("D32 Sprint B · POST /api/admin/topics/clone-to-grade", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		cloneTopicsToGrade.mockClear();
		cloneTopicsToGrade.mockResolvedValue(5);
		revalidateCurriculumTopicCaches.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [VALID_UUID], target_grade: 10 },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects target_grade out of range", async () => {
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [VALID_UUID], target_grade: 99 },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects empty source_topic_ids", async () => {
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [], target_grade: 10 },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [VALID_UUID], target_grade: 10, extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 on clone failure", async () => {
		cloneTopicsToGrade.mockRejectedValueOnce(new Error("conflict"));
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [VALID_UUID], target_grade: 10 },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("happy path: clones + audits + revalidates", async () => {
		const { POST } = await import("@/app/api/admin/topics/clone-to-grade/route");
		const res = await POST(
			adminRequest("/api/admin/topics/clone-to-grade", {
				body: { source_topic_ids: [VALID_UUID], target_grade: 10 },
			}),
		);
		expect(res.status).toBe(200);
		expect(cloneTopicsToGrade).toHaveBeenCalledWith([VALID_UUID], 10);
		expect(revalidateCurriculumTopicCaches).toHaveBeenCalled();
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { count: number; target_grade: number };
		};
		expect(audit.action).toBe("topic_clone_to_grade");
		expect(audit.payload.count).toBe(5);
		expect(audit.payload.target_grade).toBe(10);
	});
});
