import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const updateEq2 = vi.fn(async () => ({ error: null as { message: string } | null }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_ANSWER_OVERRIDE_SCORE: "test_answer_override_score" },
}));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({
			update: () => ({ eq: () => ({ eq: updateEq2 }) }),
		}),
	}),
}));

const TEST_ID = "aaa11111-2222-4333-8444-555566667777";
const ANSWER_ID = "bbb11111-2222-4333-8444-555566667777";

describe("D32 Sprint B · PATCH /api/admin/tests/[id]/answers/[answerId]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		updateEq2.mockClear();
		updateEq2.mockResolvedValue({ error: null });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/tests/[id]/answers/[answerId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/tests/${TEST_ID}/answers/${ANSWER_ID}`, {
				method: "PATCH",
				body: { score_earned: "1.5" },
			}),
			{ params: Promise.resolve({ id: TEST_ID, answerId: ANSWER_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects extra keys (D14 strict)", async () => {
		const { PATCH } = await import("@/app/api/admin/tests/[id]/answers/[answerId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/tests/${TEST_ID}/answers/${ANSWER_ID}`, {
				method: "PATCH",
				body: { score_earned: "1.0", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: TEST_ID, answerId: ANSWER_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("500 when DB update errors", async () => {
		updateEq2.mockResolvedValueOnce({ error: { message: "constraint" } });
		const { PATCH } = await import("@/app/api/admin/tests/[id]/answers/[answerId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/tests/${TEST_ID}/answers/${ANSWER_ID}`, {
				method: "PATCH",
				body: { score_earned: "0.5" },
			}),
			{ params: Promise.resolve({ id: TEST_ID, answerId: ANSWER_ID }) },
		);
		expect(res.status).toBe(500);
	});

	it("happy path: overrides score + strict audit", async () => {
		const { PATCH } = await import("@/app/api/admin/tests/[id]/answers/[answerId]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/tests/${TEST_ID}/answers/${ANSWER_ID}`, {
				method: "PATCH",
				body: { score_earned: "2.0", reason: "manual review" },
			}),
			{ params: Promise.resolve({ id: TEST_ID, answerId: ANSWER_ID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { score_earned: string };
		};
		expect(audit.action).toBe("test_answer_override_score");
		expect(audit.targetId).toBe(ANSWER_ID);
		expect(audit.payload.score_earned).toBe("2.0");
	});
});
