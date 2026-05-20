import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				orderBy: () => ({ limit: selectLimit }),
				where: () => ({ orderBy: () => ({ limit: selectLimit }) }),
			}),
		}),
	},
}));

describe("D32 Sprint C · GET /api/admin/audit", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/audit/route");
		const res = await GET(adminRequest("/api/admin/audit"));
		expect(res.status).toBe(401);
	});

	it("returns page + next_cursor when result has more rows than page size", async () => {
		const now = new Date();
		const rows = Array.from({ length: 51 }, (_, i) => ({
			id: 100 - i,
			action: "login",
			targetType: "profile",
			targetId: null,
			payload: {},
			createdAt: now,
		}));
		selectLimit.mockResolvedValueOnce(rows);
		const { GET } = await import("@/app/api/admin/audit/route");
		const res = await GET(adminRequest("/api/admin/audit"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { id: number }[];
			next_cursor: string | null;
		};
		expect(body.data).toHaveLength(50);
		expect(body.next_cursor).toBe(String(body.data[49]?.id));
	});

	it("returns null next_cursor on last page", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: 1, action: "login", targetType: null, targetId: null, payload: {}, createdAt: new Date() },
		]);
		const { GET } = await import("@/app/api/admin/audit/route");
		const res = await GET(adminRequest("/api/admin/audit"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { next_cursor: string | null };
		expect(body.next_cursor).toBeNull();
	});

	it("paginates via ?cursor= parameter", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/audit/route");
		const res = await GET(adminRequest("/api/admin/audit?cursor=100"));
		expect(res.status).toBe(200);
	});
});
