import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminAction = vi.fn<(input: unknown) => Promise<boolean>>(async () => true);

const selectMaxVersion = vi.fn(async () => [{ maxv: 0 }]);
const listSelect = vi.fn();
const insertReturning = vi.fn();
let selectCall: "list" | "max-version" = "list";

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminAction }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { AI_PROMPT_VERSION_CREATE: "ai_prompt_version_create" },
}));
vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => {
			if (selectCall === "max-version") {
				return { from: () => ({ where: selectMaxVersion }) };
			}
			return {
				from: () => ({
					where: () => ({ orderBy: listSelect }),
					orderBy: () => ({ limit: listSelect }),
				}),
			};
		}),
		insert: () => ({ values: () => ({ returning: insertReturning }) }),
	},
}));

describe("D32 Sprint B · /api/admin/ai/prompts (GET + POST)", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminAction.mockClear();
		listSelect.mockReset();
		insertReturning.mockReset();
		selectMaxVersion.mockClear();
		selectMaxVersion.mockResolvedValue([{ maxv: 0 }]);
		selectCall = "list";
	});

	it("GET: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { GET } = await import("@/app/api/admin/ai/prompts/route");
		const res = await GET(adminRequest("/api/admin/ai/prompts"));
		expect(res.status).toBe(401);
	});

	it("GET: lists prompts (no feature filter)", async () => {
		listSelect.mockResolvedValueOnce([{ id: "p1", feature: "math" }] as never);
		const { GET } = await import("@/app/api/admin/ai/prompts/route");
		const res = await GET(adminRequest("/api/admin/ai/prompts"));
		expect(res.status).toBe(200);
	});

	it("POST: 401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/ai/prompts/route");
		const res = await POST(
			adminRequest("/api/admin/ai/prompts", {
				body: { feature: "math", name: "x", template: "t", model: "gpt-4" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("POST: rejects missing required fields", async () => {
		const { POST } = await import("@/app/api/admin/ai/prompts/route");
		const res = await POST(
			adminRequest("/api/admin/ai/prompts", {
				body: { feature: "math", name: "x" },
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: rejects extra keys (D14 strict)", async () => {
		const { POST } = await import("@/app/api/admin/ai/prompts/route");
		const res = await POST(
			adminRequest("/api/admin/ai/prompts", {
				body: {
					feature: "math",
					name: "x",
					template: "t",
					model: "gpt-4",
					extraneous: "x",
				},
			}),
		);
		expect(res.status).toBe(400);
	});

	it("POST: happy path inserts new version + audits", async () => {
		selectCall = "max-version";
		selectMaxVersion.mockResolvedValueOnce([{ maxv: 3 }]);
		insertReturning.mockResolvedValueOnce([{ id: "p-new", version: 4 }]);
		const { POST } = await import("@/app/api/admin/ai/prompts/route");
		const res = await POST(
			adminRequest("/api/admin/ai/prompts", {
				body: {
					feature: "math",
					name: "Math v4",
					template: "Solve {{q}}",
					model: "gpt-4",
				},
			}),
		);
		expect(res.status).toBe(200);
		const audit = writeAdminAction.mock.calls[0]?.[0] as unknown as {
			action: string;
			payload: { feature: string; version: number };
		};
		expect(audit.action).toBe("ai_prompt_version_create");
		expect(audit.payload.version).toBe(4);
	});
});
