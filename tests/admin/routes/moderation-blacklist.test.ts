import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const embedText1536 = vi.fn<(t: string) => Promise<number[] | null>>(async () => [0.1, 0.2]);
const insertReturning = vi.fn();
const selectOrderByLimit = vi.fn(async () => []);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { MODERATION_BLACKLIST_ADD: "moderation_blacklist_add" },
}));
vi.mock("@/lib/ai/moderation", () => ({ embedText1536 }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({ orderBy: () => ({ limit: selectOrderByLimit }) }),
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint B · /api/admin/moderation/blacklist (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		insertReturning.mockReset();
		embedText1536.mockClear();
		embedText1536.mockResolvedValue([0.1, 0.2]);
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("GET: returns rows wrapped in detail envelope", async () => {
		selectOrderByLimit.mockResolvedValueOnce([{ id: "bl1", pattern: "p" }] as never);
		const { GET } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await GET();
		expect(res.status).toBe(200);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await POST(
			adminRequest("/api/admin/moderation/blacklist", {
				body: { pattern_type: "regex", pattern: ".*", applies_to: "x", reason: "test" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects invalid pattern_type", async () => {
		const { POST } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await POST(
			adminRequest("/api/admin/moderation/blacklist", {
				body: { pattern_type: "wat", pattern: ".*", reason: "test" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await POST(
			adminRequest("/api/admin/moderation/blacklist", {
				body: {
					pattern_type: "regex",
					pattern: ".*",
					reason: "test",
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST embedding: 400 if embedText returns null", async () => {
		embedText1536.mockResolvedValueOnce(null);
		const { POST } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await POST(
			adminRequest("/api/admin/moderation/blacklist", {
				body: { pattern_type: "embedding", pattern: "hello", reason: "test" },
			}),
		);
		expect(res.status).toBe(400);
		expect(insertReturning).not.toHaveBeenCalled();
	});

	it("POST regex happy path: inserts + strict audit", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "bl-new" }]);
		const { POST } = await import("@/app/api/admin/moderation/blacklist/route");
		const res = await POST(
			adminRequest("/api/admin/moderation/blacklist", {
				body: { pattern_type: "regex", pattern: "bad.*word", reason: "test" },
			}),
		);
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { pattern_type: string };
		};
		expect(audit.action).toBe("moderation_blacklist_add");
		expect(audit.payload.pattern_type).toBe("regex");
	});
});
