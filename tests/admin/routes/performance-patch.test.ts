import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const updateEq2 = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PERFORMANCE_TRACKER_PATCH: "performance_tracker_patch" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({ update: () => ({ eq: () => ({ eq: updateEq2 }) }) }),
	}),
}));

const STUDENT_ID = "ccc11111-2222-4333-8444-555566667777";
const TOPIC_ID = "ddd11111-2222-4333-8444-555566667777";

describe("D32 Sprint B · PATCH /api/admin/performance/[studentId]/[topicId]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateEq2.mockClear();
		updateEq2.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/performance/[studentId]/[topicId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/performance/${STUDENT_ID}/${TOPIC_ID}`, {
				method: "PATCH",
				body: { status: "mastered" },
			}),
			{ params: Promise.resolve({ studentId: STUDENT_ID, topicId: TOPIC_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { PATCH } = await import("@/app/api/admin/performance/[studentId]/[topicId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/performance/${STUDENT_ID}/${TOPIC_ID}`, {
				method: "PATCH",
				body: { status: "mastered", extraneous: "x" },
			}),
			{ params: Promise.resolve({ studentId: STUDENT_ID, topicId: TOPIC_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("500 when DB update errors", async () => {
		updateEq2.mockResolvedValueOnce({ error: { message: "boom" } });
		const { PATCH } = await import("@/app/api/admin/performance/[studentId]/[topicId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/performance/${STUDENT_ID}/${TOPIC_ID}`, {
				method: "PATCH",
				body: { status: "mastered" },
			}),
			{ params: Promise.resolve({ studentId: STUDENT_ID, topicId: TOPIC_ID }) },
		);
		expect(res.status).toBe(500);
	});

	it("happy path: patches + audits with composite targetId", async () => {
		const { PATCH } = await import("@/app/api/admin/performance/[studentId]/[topicId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/performance/${STUDENT_ID}/${TOPIC_ID}`, {
				method: "PATCH",
				body: { status: "mastered", average_score: "0.85", tests_taken: 12 },
			}),
			{ params: Promise.resolve({ studentId: STUDENT_ID, topicId: TOPIC_ID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { status: string };
		};
		expect(audit.action).toBe("performance_tracker_patch");
		expect(audit.targetId).toBe(`${STUDENT_ID}:${TOPIC_ID}`);
		expect(audit.payload.status).toBe("mastered");
	});
});
