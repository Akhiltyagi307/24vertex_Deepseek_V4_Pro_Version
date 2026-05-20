import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);

const listOffset = vi.fn();
const countResolve = vi.fn();
let nextSelect: "rows" | "count" = "rows";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (nextSelect === "count") {
				return {
					from: () => ({
						where: vi.fn().mockReturnValue({
							then: (cb: (v: unknown) => unknown) => Promise.resolve(cb(countResolve())),
						}),
					}),
				};
			}
			// rows: select().from().where()?.orderBy().limit().offset()
			const orderByChain = {
				limit: () => ({ offset: listOffset }),
			};
			const tail = {
				where: () => ({ orderBy: () => orderByChain }),
				orderBy: () => orderByChain,
			};
			return { from: () => tail };
		}),
	},
}));

describe("D32 Sprint C · GET /api/admin/trial-claims", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		listOffset.mockReset();
		countResolve.mockReset();
		nextSelect = "rows";
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/trial-claims/route");
		const res = await GET(adminRequest("/api/admin/trial-claims"));
		expect(res.status).toBe(401);
	});
});
