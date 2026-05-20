import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const listOffset = vi.fn();
const countWhere = vi.fn();
const insertReturning = vi.fn();
let nextSelect: "list" | "count" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { BROADCAST_CREATE: "broadcast_create" },
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn((sel?: unknown) => {
			if (sel && typeof sel === "object" && "c" in (sel as object)) {
				nextSelect = "count";
			}
			if (nextSelect === "count") {
				nextSelect = "list";
				return { from: () => countWhere() };
			}
			return {
				from: () => ({ orderBy: () => ({ limit: () => ({ offset: listOffset }) }) }),
			};
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint C · /api/admin/broadcasts (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		listOffset.mockReset();
		listOffset.mockResolvedValue([]);
		countWhere.mockReset();
		countWhere.mockResolvedValue([{ c: 0 }]);
		insertReturning.mockReset();
		nextSelect = "list";
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/broadcasts/route");
		const res = await GET(adminRequest("/api/admin/broadcasts"));
		expect(res.status).toBe(401);
	});

	it("GET: returns paginated list", async () => {
		listOffset.mockResolvedValueOnce([{ id: "b-1", subject: "Hi", status: "draft" }]);
		countWhere.mockResolvedValueOnce([{ c: 1 }]);
		const { GET } = await import("@/app/api/admin/broadcasts/route");
		const res = await GET(adminRequest("/api/admin/broadcasts?page=1&page_size=10"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { id: string }[]; total: number };
		expect(body.data).toHaveLength(1);
		expect(body.total).toBe(1);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/broadcasts/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts", {
				body: { subject: "Hi", body_md: "x", audience: { kind: "all" } },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects missing fields", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts", { body: { subject: "Hi" } }),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict on wrapper + audience + channels)", async () => {
		const { POST } = await import("@/app/api/admin/broadcasts/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts", {
				body: {
					subject: "Hi",
					body_md: "x",
					audience: { kind: "all" },
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path creates broadcast as draft + audits", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "b-new", status: "draft", subject: "Hi" }]);
		const { POST } = await import("@/app/api/admin/broadcasts/route");
		const res = await POST(
			adminRequest("/api/admin/broadcasts", {
				body: { subject: "Hi", body_md: "**hello**", audience: { kind: "all" } },
			}),
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { subject: string };
		};
		expect(audit.action).toBe("broadcast_create");
		expect(audit.payload.subject).toBe("Hi");
	});
});
