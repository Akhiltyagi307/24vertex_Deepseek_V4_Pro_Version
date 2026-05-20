import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

const studentCount = vi.fn();
const activeStudents = vi.fn();
const funnelOrderBy = vi.fn();
let nextSelect: "students" | "active" | "funnel" = "students";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "students") {
				nextSelect = "active";
				return { from: () => ({ where: studentCount }) };
			}
			if (nextSelect === "active") {
				nextSelect = "funnel";
				return { from: () => ({ where: activeStudents }) };
			}
			return {
				from: () => ({ where: () => ({ groupBy: () => ({ orderBy: funnelOrderBy }) }) }),
			};
		}),
	},
}));

describe("D32 Sprint C · GET /api/admin/analytics/overview", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		studentCount.mockReset();
		studentCount.mockResolvedValue([{ c: 100 }]);
		activeStudents.mockReset();
		activeStudents.mockResolvedValue([{ c: 30 }]);
		funnelOrderBy.mockReset();
		funnelOrderBy.mockResolvedValue([
			{ eventName: "test_started", n: 200 },
			{ eventName: "test_submitted", n: 150 },
		]);
		nextSelect = "students";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/analytics/overview/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("returns student totals + analytics events", async () => {
		const { GET } = await import("@/app/api/admin/analytics/overview/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			total_students: number;
			active_students_analytics_30d: number;
			events_30d: { eventName: string; n: number }[];
		};
		expect(body.total_students).toBe(100);
		expect(body.active_students_analytics_30d).toBe(30);
		expect(body.events_30d).toHaveLength(2);
	});

	it("500 envelope when DB throws", async () => {
		studentCount.mockRejectedValueOnce(new Error("db down"));
		const { GET } = await import("@/app/api/admin/analytics/overview/route");
		const res = await GET();
		expect(res.status).toBe(500);
	});
});
