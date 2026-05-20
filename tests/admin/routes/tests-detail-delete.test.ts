import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const testMaybeSingle = vi.fn();
const questionsOrder = vi.fn(async () => ({ data: [] as unknown[], error: null }));
const answersEq = vi.fn(async () => ({ data: [] as unknown[], error: null }));
const updateEq = vi.fn(async () => ({ data: null, error: null as { message?: string } | null }));

const adminLoadQuestionAnomalies = vi.fn(async () => [] as unknown[]);
const adminGetTestReport = vi.fn(async () => null as unknown);

const createServiceRoleClient = vi.fn(() => ({
	from: (table: string) => {
		if (table === "tests") {
			return {
				select: () => ({ eq: () => ({ maybeSingle: testMaybeSingle }) }),
				update: () => ({ eq: updateEq }),
			};
		}
		if (table === "questions") {
			return {
				select: () => ({ eq: () => ({ order: questionsOrder }) }),
			};
		}
		return { select: () => ({ eq: answersEq }) };
	},
}));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { TEST_SOFT_DELETE: "test_soft_delete" },
}));
vi.mock("@/lib/admin/tests-admin", () => ({
	adminGetTestReport,
	adminLoadQuestionAnomalies,
}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

describe("D32 Sprint C · tests/[id] GET + DELETE", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		testMaybeSingle.mockReset();
		questionsOrder.mockClear();
		questionsOrder.mockResolvedValue({ data: [], error: null });
		answersEq.mockClear();
		answersEq.mockResolvedValue({ data: [], error: null });
		updateEq.mockClear();
		updateEq.mockResolvedValue({ data: null, error: null });
		adminLoadQuestionAnomalies.mockClear();
		adminGetTestReport.mockClear();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/tests/[id]/route");
		const res = await GET(adminRequest("/api/admin/tests/t1"), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("GET: 404 when test not found", async () => {
		testMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
		const { GET } = await import("@/app/api/admin/tests/[id]/route");
		const res = await GET(adminRequest("/api/admin/tests/t1"), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(404);
	});

	it("GET: happy path returns multi-section body", async () => {
		testMaybeSingle.mockResolvedValueOnce({ data: { id: "t1", status: "in_progress" }, error: null });
		const { GET } = await import("@/app/api/admin/tests/[id]/route");
		const res = await GET(adminRequest("/api/admin/tests/t1"), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			test: { id: string };
			questions: unknown[];
			answers: unknown[];
		};
		expect(body.test.id).toBe("t1");
		expect(Array.isArray(body.questions)).toBe(true);
		expect(Array.isArray(body.answers)).toBe(true);
	});

	it("DELETE: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { DELETE } = await import("@/app/api/admin/tests/[id]/route");
		const res = await DELETE(adminRequest("/api/admin/tests/t1", { method: "DELETE" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(401);
	});

	it("DELETE: happy path marks expired + strict audit", async () => {
		const { DELETE } = await import("@/app/api/admin/tests/[id]/route");
		const res = await DELETE(adminRequest("/api/admin/tests/t1", { method: "DELETE" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("test_soft_delete");
		expect(audit.targetId).toBe("t1");
	});

	it("DELETE: 500 when supabase update errors", async () => {
		updateEq.mockResolvedValueOnce({ data: null, error: { message: "rls" } });
		const { DELETE } = await import("@/app/api/admin/tests/[id]/route");
		const res = await DELETE(adminRequest("/api/admin/tests/t1", { method: "DELETE" }), {
			params: Promise.resolve({ id: "t1" }),
		});
		expect(res.status).toBe(500);
	});
});
