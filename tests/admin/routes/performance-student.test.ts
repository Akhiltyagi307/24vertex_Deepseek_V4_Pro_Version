import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const adminRecalculatePerformanceFromReports = vi.fn(async () => ({ ok: true, message: "" }));
const adminReinitializePerformanceTracker = vi.fn(async () => ({ ok: true, message: "" }));
const selectWhere = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: {
		PERFORMANCE_RECALCULATE: "performance_recalculate",
		PERFORMANCE_REINITIALIZE: "performance_reinitialize",
	},
}));
vi.mock("@/lib/admin/performance-admin", () => ({
	adminRecalculatePerformanceFromReports,
	adminReinitializePerformanceTracker,
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					innerJoin: () => ({ where: selectWhere }),
				}),
			}),
		}),
	},
}));

const STUDENT_ID = "stu-123";

describe("D32 Sprint B/C · performance/[studentId] list + recalculate + reinitialize", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		adminRecalculatePerformanceFromReports.mockClear();
		adminRecalculatePerformanceFromReports.mockResolvedValue({ ok: true, message: "" });
		adminReinitializePerformanceTracker.mockClear();
		adminReinitializePerformanceTracker.mockResolvedValue({ ok: true, message: "" });
		selectWhere.mockReset();
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/performance/[studentId]/route");
		const res = await GET(new Request(`http://localhost/api/admin/performance/${STUDENT_ID}`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(401);
	});

	it("list GET: returns tracker rows", async () => {
		selectWhere.mockResolvedValueOnce([
			{
				id: "row-1",
				topicId: "topic-1",
				subjectId: "subject-1",
				status: "mastered",
				averageScore: "0.85",
				testsTaken: 5,
				trend: "up",
				topicName: "Algebra",
				subjectName: "Math",
			},
		]);
		const { GET } = await import("@/app/api/admin/performance/[studentId]/route");
		const res = await GET(new Request(`http://localhost/api/admin/performance/${STUDENT_ID}`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		expect(body.data).toHaveLength(1);
	});

	it("recalculate POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(adminRequest(`/api/admin/performance/${STUDENT_ID}/recalculate`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(401);
	});

	it("recalculate POST: returns 400 when underlying op fails", async () => {
		adminRecalculatePerformanceFromReports.mockResolvedValueOnce({ ok: false, message: "boom" });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(adminRequest(`/api/admin/performance/${STUDENT_ID}/recalculate`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(400);
	});

	it("recalculate POST: happy path audits", async () => {
		const { POST } = await import("@/app/api/admin/performance/[studentId]/recalculate/route");
		const res = await POST(adminRequest(`/api/admin/performance/${STUDENT_ID}/recalculate`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("performance_recalculate");
		expect(audit.targetId).toBe(STUDENT_ID);
	});

	it("reinitialize POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/performance/[studentId]/reinitialize/route");
		const res = await POST(adminRequest(`/api/admin/performance/${STUDENT_ID}/reinitialize`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(401);
	});

	it("reinitialize POST: happy path audits", async () => {
		const { POST } = await import("@/app/api/admin/performance/[studentId]/reinitialize/route");
		const res = await POST(adminRequest(`/api/admin/performance/${STUDENT_ID}/reinitialize`), {
			params: Promise.resolve({ studentId: STUDENT_ID }),
		});
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("performance_reinitialize");
		expect(audit.targetId).toBe(STUDENT_ID);
	});
});
