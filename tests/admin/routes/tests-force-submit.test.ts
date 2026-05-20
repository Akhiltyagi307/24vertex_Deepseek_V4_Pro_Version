import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const executePracticeTestSubmit = vi.fn();

const selectMaybeSingle = vi.fn();
const createServiceRoleClient = vi.fn(() => ({
	from: () => ({
		select: () => ({ eq: () => ({ maybeSingle: selectMaybeSingle }) }),
	}),
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_FORCE_SUBMIT: "test_force_submit" },
}));
vi.mock("@/lib/practice/submit-practice-shared", () => ({ executePracticeTestSubmit }));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

describe("D32 Sprint C · POST /api/admin/tests/[id]/force-submit", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		executePracticeTestSubmit.mockReset();
		selectMaybeSingle.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/force-submit/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/force-submit", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when test not found", async () => {
		selectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/force-submit/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/force-submit", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(404);
	});

	it("400 when test is not in_progress", async () => {
		selectMaybeSingle.mockResolvedValueOnce({
			data: { student_id: "stu", status: "submitted", duration_seconds: 600 },
			error: null,
		});
		const { POST } = await import("@/app/api/admin/tests/[id]/force-submit/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/force-submit", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(400);
		expect(executePracticeTestSubmit).not.toHaveBeenCalled();
	});

	it("500 when submit fails", async () => {
		selectMaybeSingle.mockResolvedValueOnce({
			data: { student_id: "stu", status: "in_progress", duration_seconds: 600 },
			error: null,
		});
		executePracticeTestSubmit.mockResolvedValueOnce({ ok: false, message: "grading down" });
		const { POST } = await import("@/app/api/admin/tests/[id]/force-submit/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/force-submit", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(500);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});

	it("happy path submits + strict audit", async () => {
		selectMaybeSingle.mockResolvedValueOnce({
			data: { student_id: "stu", status: "in_progress", duration_seconds: 600 },
			error: null,
		});
		executePracticeTestSubmit.mockResolvedValueOnce({ ok: true, redirectTo: "/student/results/t1" });
		const { POST } = await import("@/app/api/admin/tests/[id]/force-submit/route");
		const res = await POST(adminRequest("/api/admin/tests/t1/force-submit", { method: "POST" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		expect(executePracticeTestSubmit).toHaveBeenCalledWith(expect.anything(), "stu", "t1", 600);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("test_force_submit");
		expect(audit.targetId).toBe("t1");
	});
});
