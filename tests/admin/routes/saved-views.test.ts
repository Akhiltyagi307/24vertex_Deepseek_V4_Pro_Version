import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

const selectOrderBy = vi.fn();
const selectLookupLimit = vi.fn();
const insertReturning = vi.fn();
const updateWhere = vi.fn(async () => undefined);
let selectCall = 0;

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: () => {
				selectCall += 1;
				if (selectCall === 1) {
					return { where: () => ({ orderBy: selectOrderBy }) };
				}
				return { where: () => ({ limit: selectLookupLimit }) };
			},
		})),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
		update: () => ({ set: () => ({ where: updateWhere }) }),
	},
}));

describe("D32 Sprint B · /api/admin/saved-views (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectOrderBy.mockReset();
		selectLookupLimit.mockReset();
		insertReturning.mockReset();
		updateWhere.mockClear();
		selectCall = 0;
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/saved-views/route");
		const res = await GET(adminRequest("/api/admin/saved-views?list_id=teachers"));
		expect(res.status).toBe(401);
	});

	it("GET: 400 when list_id missing", async () => {
		const { GET } = await import("@/app/api/admin/saved-views/route");
		const res = await GET(adminRequest("/api/admin/saved-views"));
		expect(res.status).toBe(400);
	});

	it("GET: returns rows for the given list_id", async () => {
		selectOrderBy.mockResolvedValueOnce([
			{ id: "v1", name: "View 1", state: { q: "foo" } },
			{ id: "v2", name: "View 2", state: {} },
		]);
		const { GET } = await import("@/app/api/admin/saved-views/route");
		const res = await GET(adminRequest("/api/admin/saved-views?list_id=teachers"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string; name: string }[] };
		expect(body.data).toHaveLength(2);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/saved-views/route");
		const res = await POST(
			adminRequest("/api/admin/saved-views", {
				body: { list_id: "teachers", name: "test", state: {} },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects missing required fields", async () => {
		const { POST } = await import("@/app/api/admin/saved-views/route");
		const res = await POST(
			adminRequest("/api/admin/saved-views", { body: { list_id: "teachers" } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/saved-views/route");
		const res = await POST(
			adminRequest("/api/admin/saved-views", {
				body: { list_id: "teachers", name: "test", extraneous: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: inserts when name doesn't exist (returns 201 + updated:false)", async () => {
		// First select (GET) ignored; this POST does another select first which
		// uses the limit chain. Reset selectCall.
		selectLookupLimit.mockResolvedValueOnce([]);
		insertReturning.mockResolvedValueOnce([{ id: "new-id" }]);
		const { POST } = await import("@/app/api/admin/saved-views/route");
		// Bump selectCall so the next select() call hits limit branch.
		selectCall = 1;
		const res = await POST(
			adminRequest("/api/admin/saved-views", {
				body: { list_id: "teachers", name: "new view" },
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { ok: boolean; updated?: boolean };
		expect(body.updated).toBe(false);
	});

	it("POST: updates when name exists (returns 200 + updated:true)", async () => {
		selectLookupLimit.mockResolvedValueOnce([{ id: "existing-id" }]);
		const { POST } = await import("@/app/api/admin/saved-views/route");
		selectCall = 1;
		const res = await POST(
			adminRequest("/api/admin/saved-views", {
				body: { list_id: "teachers", name: "existing view", state: { q: "x" } },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; updated?: boolean };
		expect(body.updated).toBe(true);
		expect(updateWhere).toHaveBeenCalled();
	});
});
