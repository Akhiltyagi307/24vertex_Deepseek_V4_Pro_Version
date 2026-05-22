import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const updateWhere = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { FEEDBACK_REPORT_UPDATE: "feedback_report_update" },
}));
vi.mock("@/db", () => ({
	db: {
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

const REPORT_ID = "feedback-uuid-123";

describe("PATCH /api/admin/feedback/[id]", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		updateWhere.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { PATCH } = await import("@/app/api/admin/feedback/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/feedback/${REPORT_ID}`, {
				method: "PATCH",
				body: { status: "triaged" },
			}),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid status", async () => {
		const { PATCH } = await import("@/app/api/admin/feedback/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/feedback/${REPORT_ID}`, {
				method: "PATCH",
				body: { status: "nope" },
			}),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra keys (strict)", async () => {
		const { PATCH } = await import("@/app/api/admin/feedback/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/feedback/${REPORT_ID}`, {
				method: "PATCH",
				body: { status: "open", extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("updates + audits", async () => {
		const { PATCH } = await import("@/app/api/admin/feedback/[id]/route");
		const res = await PATCH(
			adminRequest(`/api/admin/feedback/${REPORT_ID}`, {
				method: "PATCH",
				body: { status: "resolved", admin_notes: "fixed in deploy" },
			}),
			{ params: Promise.resolve({ id: REPORT_ID }) },
		);
		expect(res.status).toBe(200);
		expect(updateWhere).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as {
			action: string;
			targetId: string;
			payload: { status: string };
		};
		expect(audit.action).toBe("feedback_report_update");
		expect(audit.targetId).toBe(REPORT_ID);
		expect(audit.payload.status).toBe("resolved");
	});
});
