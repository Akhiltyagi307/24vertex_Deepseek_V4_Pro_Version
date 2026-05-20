import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const captureOpenComplianceDeadlineRisk = vi.fn();
const complianceDueAtFromLegalBasis = vi.fn(() => new Date(Date.now() + 30 * 86_400_000));

const listOffset = vi.fn();
const countWhere = vi.fn();
const insertReturning = vi.fn();
let nextSelect: "rows" | "count" = "rows";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { COMPLIANCE_REQUEST_CREATED: "compliance_request_created" },
}));
vi.mock("@/lib/compliance/alerts", () => ({ captureOpenComplianceDeadlineRisk }));
vi.mock("@/lib/compliance/due-at", () => ({ complianceDueAtFromLegalBasis }));
vi.mock("@/lib/compliance/schemas", () => ({
	createComplianceRequestBodySchema: z
		.object({
			request_type: z.enum(["access", "erasure", "rectification"]),
			subject_user_id: z.string().optional(),
			subject_email: z.string().optional(),
			requester_email: z.string().email(),
			requester_relation: z.string().min(1),
			legal_basis: z.string().min(1),
			notes: z.string().optional(),
		})
		.strict(),
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "c" in (sel as object)) {
				nextSelect = "count";
			}
			if (nextSelect === "count") {
				nextSelect = "rows";
				return { from: () => ({ where: countWhere }) };
			}
			return {
				from: () => ({
					where: () => ({ orderBy: () => ({ limit: () => ({ offset: listOffset }) }) }),
				}),
			};
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint C · /api/admin/compliance/requests (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		listOffset.mockReset();
		listOffset.mockResolvedValue([]);
		countWhere.mockReset();
		countWhere.mockResolvedValue([{ c: 0 }]);
		insertReturning.mockReset();
		captureOpenComplianceDeadlineRisk.mockClear();
		nextSelect = "rows";
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/compliance/requests/route");
		const res = await GET(adminRequest("/api/admin/compliance/requests"));
		expect(res.status).toBe(401);
	});

	it("GET: returns paginated list + triggers deadline-risk alert", async () => {
		listOffset.mockResolvedValueOnce([{ id: "r1", status: "open" }]);
		countWhere.mockResolvedValueOnce([{ c: 1 }]);
		const { GET } = await import("@/app/api/admin/compliance/requests/route");
		const res = await GET(adminRequest("/api/admin/compliance/requests?status=open"));
		expect(res.status).toBe(200);
		expect(captureOpenComplianceDeadlineRisk).toHaveBeenCalled();
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/compliance/requests/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests", {
				body: {
					request_type: "access",
					requester_email: "x@y.com",
					requester_relation: "self",
					legal_basis: "gdpr",
					subject_email: "s@y.com",
				},
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests", {
				body: {
					request_type: "access",
					requester_email: "x@y.com",
					requester_relation: "self",
					legal_basis: "gdpr",
					subject_email: "s@y.com",
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects when both subject_user_id and subject_email are missing", async () => {
		const { POST } = await import("@/app/api/admin/compliance/requests/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests", {
				body: {
					request_type: "access",
					requester_email: "x@y.com",
					requester_relation: "self",
					legal_basis: "gdpr",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path creates row + audits", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "req-new", status: "open" }]);
		const { POST } = await import("@/app/api/admin/compliance/requests/route");
		const res = await POST(
			adminRequest("/api/admin/compliance/requests", {
				body: {
					request_type: "erasure",
					requester_email: "x@y.com",
					requester_relation: "guardian",
					legal_basis: "dpdp_consent_withdraw",
					subject_email: "child@y.com",
				},
			}),
		);
		expect(res.status).toBe(201);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { request_type: string };
		};
		expect(audit.action).toBe("compliance_request_created");
		expect(audit.payload.request_type).toBe("erasure");
	});
});
