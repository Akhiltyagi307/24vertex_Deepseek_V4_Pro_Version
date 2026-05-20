import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});

const selectLimit = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PARENTAL_CONSENT_REVOKED: "parental_consent_revoked" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({ where: () => ({ orderBy: () => ({ limit: selectLimit }) }) }),
		}),
		update: () => ({
			set: () => ({ where: () => ({ returning: updateReturning }) }),
		}),
	},
}));

const STUDENT_UUID = "20202020-2020-4202-8020-202020202020";

describe("D32 Sprint B · POST /api/admin/compliance/consents/[studentId]/revoke", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		updateReturning.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/revoke/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/revoke`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("rejects invalid student UUID", async () => {
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/revoke/route"
		);
		const res = await POST(
			adminRequest("/api/admin/compliance/consents/bad/revoke"),
			{ params: Promise.resolve({ studentId: "bad" }) },
		);
		expect(res.status).toBe(400);
	});

	it("404 when no active consent row", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/revoke/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/revoke`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("happy path: revokes + strict audit", async () => {
		selectLimit.mockResolvedValueOnce([{ id: "consent-1" }]);
		updateReturning.mockResolvedValueOnce([{ id: "consent-1", revokedAt: new Date() }]);
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/revoke/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/revoke`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { student_id: string };
		};
		expect(audit.action).toBe("parental_consent_revoked");
		expect(audit.targetId).toBe("consent-1");
		expect(audit.payload.student_id).toBe(STUDENT_UUID);
	});
});
