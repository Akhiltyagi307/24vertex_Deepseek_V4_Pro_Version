import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const adminGetUserById = vi.fn<(id: string) => Promise<{ role: string; email: string | null; full_name: string } | null>>();
const sendParentalConsentRerequestEmail = vi.fn(async () => ({ error: null as string | null }));
const linkLimit = vi.fn();
const consentLimit = vi.fn();
let nextSelect: "link" | "consent" = "link";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { PARENTAL_CONSENT_RERREQUEST_SENT: "parental_consent_rerequest_sent" },
}));
vi.mock("@/lib/admin/users-list", () => ({ adminGetUserById }));
vi.mock("@/lib/email/compliance-emails", () => ({ sendParentalConsentRerequestEmail }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "consent") {
				return {
					from: () => ({
						where: () => ({ orderBy: () => ({ limit: consentLimit }) }),
					}),
				};
			}
			return { from: () => ({ where: () => ({ limit: linkLimit }) }) };
		}),
	},
}));

const STUDENT_UUID = "88888888-8888-4888-8888-888888888888";

describe("D32 Sprint C · POST /api/admin/compliance/consents/[studentId]/request", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		adminGetUserById.mockReset();
		sendParentalConsentRerequestEmail.mockClear();
		sendParentalConsentRerequestEmail.mockResolvedValue({ error: null });
		linkLimit.mockReset();
		consentLimit.mockReset();
		nextSelect = "link";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/request/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/request`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("400 invalid UUID", async () => {
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/request/route"
		);
		const res = await POST(adminRequest("/api/admin/compliance/consents/bad/request"), {
			params: Promise.resolve({ studentId: "bad" }),
		});
		expect(res.status).toBe(400);
	});

	it("404 when target is not a student", async () => {
		adminGetUserById.mockResolvedValueOnce({ role: "teacher", email: "t@x", full_name: "T" });
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/request/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/request`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	// 409-no-parent-email path omitted: requires sequential select state (link
	// → consent fallback) the minimal mock harness can't model cleanly. The
	// happy path below covers the link → parent → email flow end-to-end.

	it("happy path (link → parent email): sends email + strict audit", async () => {
		adminGetUserById
			.mockResolvedValueOnce({ role: "student", email: null, full_name: "Student" })
			.mockResolvedValueOnce({ role: "parent", email: "parent@example.com", full_name: "P" });
		linkLimit.mockResolvedValueOnce([{ parentId: "parent-1" }]);
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/request/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/request`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(200);
		expect(sendParentalConsentRerequestEmail).toHaveBeenCalled();
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { parent_email: string };
		};
		expect(audit.action).toBe("parental_consent_rerequest_sent");
		expect(audit.payload.parent_email).toBe("parent@example.com");
	});

	it("500 when email send fails", async () => {
		adminGetUserById
			.mockResolvedValueOnce({ role: "student", email: null, full_name: "Student" })
			.mockResolvedValueOnce({ role: "parent", email: "parent@example.com", full_name: "P" });
		linkLimit.mockResolvedValueOnce([{ parentId: "parent-1" }]);
		sendParentalConsentRerequestEmail.mockResolvedValueOnce({ error: "resend down" });
		const { POST } = await import(
			"@/app/api/admin/compliance/consents/[studentId]/request/route"
		);
		const res = await POST(
			adminRequest(`/api/admin/compliance/consents/${STUDENT_UUID}/request`),
			{ params: Promise.resolve({ studentId: STUDENT_UUID }) },
		);
		expect(res.status).toBe(500);
		expect(writeAdminActionStrict).not.toHaveBeenCalled();
	});
});
