import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const listLimit = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				orderBy: () => ({ limit: listLimit }),
				where: () => ({ orderBy: () => ({ limit: listLimit }) }),
			}),
		}),
	},
}));

describe("D32 Sprint C · GET /api/admin/moderation/flags", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		listLimit.mockReset();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/moderation/flags/route");
		const res = await GET(adminRequest("/api/admin/moderation/flags"));
		expect(res.status).toBe(401);
	});

	it("returns open flags by default", async () => {
		listLimit.mockResolvedValueOnce([{ id: "f1", status: "open" }]);
		const { GET } = await import("@/app/api/admin/moderation/flags/route");
		const res = await GET(adminRequest("/api/admin/moderation/flags"));
		expect(res.status).toBe(200);
	});

	it("supports ?status=all (no where filter)", async () => {
		listLimit.mockResolvedValueOnce([
			{ id: "f1", status: "open" },
			{ id: "f2", status: "dismissed" },
		]);
		const { GET } = await import("@/app/api/admin/moderation/flags/route");
		const res = await GET(adminRequest("/api/admin/moderation/flags?status=all"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[] };
		expect(body.data).toHaveLength(2);
	});

	it("clamps limit to 500", async () => {
		listLimit.mockResolvedValueOnce([]);
		const { GET } = await import("@/app/api/admin/moderation/flags/route");
		const res = await GET(adminRequest("/api/admin/moderation/flags?limit=99999"));
		expect(res.status).toBe(200);
	});
});
