import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const runIntegrityCheck = vi.fn(async () => ({ rowsFound: 3, details: { sample: ["a", "b"] } }));
const insertValues = vi.fn(async () => undefined);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { INTEGRITY_CHECK_RUN: "integrity_check_run" },
}));
vi.mock("@/lib/admin/integrity/check-runners", () => ({
	INTEGRITY_CHECK_NAMES: ["students_missing_tracker", "orphan_attempts"],
	runIntegrityCheck,
}));
vi.mock("@/db", () => ({
	db: { insert: () => ({ values: insertValues }) },
}));

describe("D32 Sprint C · POST /api/admin/system/integrity/checks/[name]/run", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		runIntegrityCheck.mockClear();
		runIntegrityCheck.mockResolvedValue({ rowsFound: 3, details: { sample: ["a", "b"] } });
		insertValues.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker/run", { method: "POST" }),
			{ params: Promise.resolve({ name: "students_missing_tracker" }) },
		);
		expect(res.status).toBe(401);
	});

	it("400 when check name is unknown", async () => {
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/totally_invalid/run", { method: "POST" }),
			{ params: Promise.resolve({ name: "totally_invalid" }) },
		);
		expect(res.status).toBe(400);
		expect(runIntegrityCheck).not.toHaveBeenCalled();
	});

	it("happy path runs check + persists result + audits", async () => {
		const { POST } = await import("@/app/api/admin/system/integrity/checks/[name]/run/route");
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker/run", { method: "POST" }),
			{ params: Promise.resolve({ name: "students_missing_tracker" }) },
		);
		expect(res.status).toBe(200);
		expect(runIntegrityCheck).toHaveBeenCalledWith("students_missing_tracker");
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ checkName: "students_missing_tracker", rowsFound: 3 }),
		);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { rows_found: number };
		};
		expect(audit.action).toBe("integrity_check_run");
		expect(audit.targetId).toBe("students_missing_tracker");
		expect(audit.payload.rows_found).toBe(3);
	});
});
