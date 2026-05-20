import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { INTEGRITY_CHECK_FIX: "integrity_check_fix" },
}));

describe("D32 Sprint B · POST /api/admin/system/integrity/checks/[name]/fix", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/system/integrity/checks/[name]/fix/route"
		);
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/fix", {
				body: { dry_run: true },
			}),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects body missing dry_run (.strict() schema)", async () => {
		const { POST } = await import(
			"@/app/api/admin/system/integrity/checks/[name]/fix/route"
		);
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/fix", {
				body: { row_ids: ["x"] },
			}),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(400);
	});

	it("rejects extra body keys (D14 strict)", async () => {
		const { POST } = await import(
			"@/app/api/admin/system/integrity/checks/[name]/fix/route"
		);
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/fix", {
				body: { dry_run: true, extraneous: "x" },
			}),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(400);
	});

	it("dry-run returns proposed SQL preview and audits", async () => {
		const { POST } = await import(
			"@/app/api/admin/system/integrity/checks/[name]/fix/route"
		);
		const res = await POST(
			adminRequest("/api/admin/system/integrity/checks/students_missing_tracker_rows/fix", {
				body: { dry_run: true, row_ids: ["row-1"] },
			}),
			{ params: Promise.resolve({ name: "students_missing_tracker_rows" }) },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { dry_run: boolean; proposed_sql: string } };
		expect(body.data.dry_run).toBe(true);
		expect(body.data.proposed_sql).toContain("students_missing_tracker_rows");
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("integrity_check_fix");
		expect(audit.targetId).toBe("students_missing_tracker_rows");
	});
});
