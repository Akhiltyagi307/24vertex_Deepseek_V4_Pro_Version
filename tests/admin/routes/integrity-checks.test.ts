import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const runIntegrityCheck = vi.fn(async () => ({ rowsFound: 3, details: [{ id: 1 }] }));
const insertValues = vi.fn(async () => undefined);

const selectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { INTEGRITY_CHECK_RUN: "integrity_check_run" },
}));
vi.mock("@/lib/admin/integrity/check-runners", () => ({
	runIntegrityCheck,
	INTEGRITY_CHECK_NAMES: ["students_missing_tracker_rows", "tests_without_questions"],
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({ orderBy: () => ({ limit: selectLimit }) }),
			}),
		}),
		insert: () => ({ values: insertValues }),
	},
}));

describe("D32 Sprint C · system/integrity/checks (GET list + [name]/run POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		runIntegrityCheck.mockClear();
		runIntegrityCheck.mockResolvedValue({ rowsFound: 3, details: [{ id: 1 }] });
		insertValues.mockClear();
		selectLimit.mockReset();
	});

	it("list GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/system/integrity/checks/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("list GET: returns one row per known check", async () => {
		selectLimit.mockResolvedValue([{ rowsFound: 0, ranAt: new Date() }]);
		const { GET } = await import("@/app/api/admin/system/integrity/checks/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { name: string }[] };
		expect(body.data).toHaveLength(2);
	});

	it("run POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/run"),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(401);
	});

	it("run POST: 400 when check name is unknown", async () => {
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/totally-fake/run"),
			{ params: Promise.resolve({ name: "totally-fake" }) },
		);
		expect(res.status).toBe(400);
		expect(runIntegrityCheck).not.toHaveBeenCalled();
	});

	it("run POST: happy path runs check + inserts result + audits", async () => {
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/run"),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(200);
		expect(runIntegrityCheck).toHaveBeenCalledWith("students_missing_tracker_rows");
		expect(insertValues).toHaveBeenCalledTimes(1);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { rows_found: number };
		};
		expect(audit.action).toBe("integrity_check_run");
		expect(audit.payload.rows_found).toBe(3);
	});
});
