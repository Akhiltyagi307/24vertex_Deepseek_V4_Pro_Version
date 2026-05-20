import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);
const selectOrderBy = vi.fn();
const insertReturning = vi.fn();

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { CONTEXT_CHUNK_CREATE: "context_chunk_create" },
}));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ orderBy: selectOrderBy }) }) }),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

const TOPIC_UUID = "80808080-8080-4808-8080-808080808080";

describe("D32 Sprint B · /api/admin/context-chunks (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		selectOrderBy.mockReset();
		insertReturning.mockReset();
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/context-chunks/route");
		const res = await GET(adminRequest(`/api/admin/context-chunks?topic_id=${TOPIC_UUID}`));
		expect(res.status).toBe(401);
	});

	it("GET: 400 when topic_id missing", async () => {
		const { GET } = await import("@/app/api/admin/context-chunks/route");
		const res = await GET(adminRequest("/api/admin/context-chunks"));
		expect(res.status).toBe(400);
	});

	it("GET: 400 when topic_id is not a UUID", async () => {
		const { GET } = await import("@/app/api/admin/context-chunks/route");
		const res = await GET(adminRequest("/api/admin/context-chunks?topic_id=bad"));
		expect(res.status).toBe(400);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/context-chunks/route");
		const res = await POST(
			adminRequest("/api/admin/context-chunks", {
				body: { topic_id: TOPIC_UUID, content: "x", chunk_type: "context" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects invalid chunk_type", async () => {
		const { POST } = await import("@/app/api/admin/context-chunks/route");
		const res = await POST(
			adminRequest("/api/admin/context-chunks", {
				body: { topic_id: TOPIC_UUID, content: "x", chunk_type: "wat" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/context-chunks/route");
		const res = await POST(
			adminRequest("/api/admin/context-chunks", {
				body: {
					topic_id: TOPIC_UUID,
					content: "x",
					chunk_type: "context",
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path inserts + audits with 201", async () => {
		insertReturning.mockResolvedValueOnce([{ id: "chunk-new" }]);
		const { POST } = await import("@/app/api/admin/context-chunks/route");
		const res = await POST(
			adminRequest("/api/admin/context-chunks", {
				body: { topic_id: TOPIC_UUID, content: "x", chunk_type: "exercise" },
			}),
		);
		expect(res.status).toBe(201);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
		};
		expect(audit.action).toBe("context_chunk_create");
		expect(audit.targetId).toBe("chunk-new");
	});
});
