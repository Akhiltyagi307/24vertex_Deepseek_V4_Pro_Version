import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW, adminRequest } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const selectLimit = vi.fn();
const generateText = vi.fn();
const recordAiCall = vi.fn();
const getOpenAIProvider = vi.fn(() => ({ chat: (_m: string) => ({}) }));

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/openai-provider", () => ({ getOpenAIProvider }));
vi.mock("@/lib/ai/record-ai-call", () => ({ recordAiCall }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
	},
}));

describe("D32 Sprint C · POST /api/admin/ai/prompts/[id]/test", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		selectLimit.mockReset();
		generateText.mockReset();
		recordAiCall.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/ai/prompts/p1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "p1" }),
		});
		expect(res.status).toBe(401);
	});

	it("404 when prompt not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/ai/prompts/p1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "p1" }),
		});
		expect(res.status).toBe(404);
	});

	it("happy path: calls generateText + records ai call", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "p1", model: "gpt-4o-mini", template: "Sys", feature: "test", maxTokens: 100, temperature: "0.7" },
		]);
		generateText.mockResolvedValueOnce({
			text: "OK",
			usage: { inputTokens: 5, outputTokens: 2 },
		});
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/test/route");
		const res = await POST(
			adminRequest("/api/admin/ai/prompts/p1/test", {
				method: "POST",
				body: { user: "hi" },
			}),
			{ params: Promise.resolve({ id: "p1" }) },
		);
		expect(res.status).toBe(200);
		expect(generateText).toHaveBeenCalled();
		expect(recordAiCall).toHaveBeenCalledWith(
			expect.objectContaining({ status: "ok", promptId: "p1" }),
		);
	});

	it("500 + error metric when generateText throws", async () => {
		selectLimit.mockResolvedValueOnce([
			{ id: "p1", model: "gpt-4o-mini", template: "Sys", feature: "test", maxTokens: null, temperature: null },
		]);
		generateText.mockRejectedValueOnce(new Error("openai down"));
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/test/route");
		const res = await POST(adminRequest("/api/admin/ai/prompts/p1/test", { method: "POST" }), {
			params: Promise.resolve({ id: "p1" }),
		});
		expect(res.status).toBe(500);
		expect(recordAiCall).toHaveBeenCalledWith(
			expect.objectContaining({ status: "error", error: "openai down" }),
		);
	});
});
