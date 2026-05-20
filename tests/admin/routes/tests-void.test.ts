import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const maybeSingle = vi.fn();
const updateEq = vi.fn(async () => ({ error: null as { message: string } | null }));
const adminRefundTestCredit = vi.fn(async () => ({ ok: true, code: "refunded", deduped: false, message: "" }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_VOID: "test_void" },
}));
vi.mock("@/lib/admin/billing/test-refund", () => ({ adminRefundTestCredit }));
vi.mock("@/lib/supabase/admin", () => ({
	createServiceRoleClient: () => ({
		from: () => ({
			select: () => ({ eq: () => ({ maybeSingle }) }),
			update: () => ({ eq: updateEq }),
		}),
	}),
}));

const TEST_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

describe("D32 Sprint B · POST /api/admin/tests/[id]/void", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		maybeSingle.mockReset();
		updateEq.mockClear();
		updateEq.mockResolvedValue({ error: null });
		adminRefundTestCredit.mockClear();
		adminRefundTestCredit.mockResolvedValue({ ok: true, code: "refunded", deduped: false, message: "" });
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("404 when test missing student_id", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: null }, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(404);
	});

	it("rejects extra keys (D14 strict)", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`, { body: { extraneous: "x" } }),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("voids without refund when refund_credit absent", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(200);
		expect(adminRefundTestCredit).not.toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { refund_credit: boolean };
		};
		expect(audit.action).toBe("test_void");
		expect(audit.payload.refund_credit).toBe(false);
	});

	it("voids + refunds credit when refund_credit=true", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`, {
				body: { refund_credit: true, refund_reason: "admin void" },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(200);
		expect(adminRefundTestCredit).toHaveBeenCalledTimes(1);
	});

	it("500 when refund returns a real failure (not nothing_to_refund)", async () => {
		maybeSingle.mockResolvedValueOnce({ data: { student_id: "s-1" }, error: null });
		adminRefundTestCredit.mockResolvedValueOnce({
			ok: false,
			code: "internal_error",
			deduped: false,
			message: "boom",
		});
		const { POST } = await import("@/app/api/admin/tests/[id]/void/route");
		const res = await POST(
			adminRequest(`/api/admin/tests/${TEST_ID}/void`, {
				body: { refund_credit: true },
			}),
			{ params: Promise.resolve({ id: TEST_ID }) },
		);
		expect(res.status).toBe(500);
	});
});
