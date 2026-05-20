import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const subLimit = vi.fn();
const insertReturning = vi.fn();
const grantsList = vi.fn(async () => [] as unknown[]);
let nextSelect: "sub" | "grants" = "sub";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { QUOTA_GRANT_CREATE: "quota_grant_create" },
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "sub") {
				nextSelect = "grants";
				return { from: () => ({ where: () => ({ limit: subLimit }) }) };
			}
			return {
				from: () => ({ where: () => ({ orderBy: () => ({ limit: grantsList }) }) }),
			};
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

const SUB_UUID = "50505050-5050-4505-8050-505050505050";

describe("D32 Sprint B · /api/admin/subscriptions/[id]/grants (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		subLimit.mockReset();
		insertReturning.mockReset();
		grantsList.mockResolvedValue([]);
		nextSelect = "sub";
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await GET(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(401);
	});

	it("GET: 404 when subscription not found", async () => {
		subLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await GET(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("POST: rejects invalid grant_type", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`, {
				body: { grant_type: "tokens", quantity: 100 },
			}),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`, {
				body: { grant_type: "tests", quantity: 10, extraneous: "x" },
			}),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(400);
	});

	it("POST: 404 when subscription not found", async () => {
		subLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`, {
				body: { grant_type: "tests", quantity: 10 },
			}),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(404);
	});

	it("POST: happy path creates grant + audits", async () => {
		subLimit.mockResolvedValueOnce([{ profileId: "student-1" }]);
		insertReturning.mockResolvedValueOnce([
			{
				id: "grant-1",
				studentId: "student-1",
				grantType: "tests",
				quantity: 10,
				consumed: 0,
				expiresAt: null,
				note: null,
				createdBy: "admin_jti:test",
				createdAt: new Date(),
			},
		]);
		const { POST } = await import("@/app/api/admin/subscriptions/[id]/grants/route");
		const res = await POST(
			adminRequest(`/api/admin/subscriptions/${SUB_UUID}/grants`, {
				body: { grant_type: "tests", quantity: 10 },
			}),
			{ params: Promise.resolve({ id: SUB_UUID }) },
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { quantity: number; grant_type: string };
		};
		expect(audit.action).toBe("quota_grant_create");
		expect(audit.payload.quantity).toBe(10);
		expect(audit.payload.grant_type).toBe("tests");
	});
});
