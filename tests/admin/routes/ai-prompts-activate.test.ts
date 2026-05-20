import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_GATE_ALLOW } from "../_helpers/admin-route";

const gateRef = { value: ADMIN_GATE_ALLOW as { jti: string; sessionId: string } | NextResponse };
const requireAdminApi = vi.fn(async () => gateRef.value);
const writeAdminActionStrict = vi.fn<(input: unknown) => Promise<void>>(async () => {});
const selectLimit = vi.fn();
const invalidateAiPromptMemoryCache = vi.fn();
const txUpdateWhere = vi.fn(async () => undefined);
const transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
	cb({ update: () => ({ set: () => ({ where: txUpdateWhere }) }) }),
);

vi.mock("@/lib/admin/api-auth", () => ({ requireAdminApi }));
vi.mock("@/lib/admin/audit", () => ({ writeAdminActionStrict }));
vi.mock("@/lib/admin/audit-actions", () => ({
	ADMIN_ACTIONS: { AI_PROMPT_ACTIVATE: "ai_prompt_activate" },
}));
vi.mock("@/lib/ai/prompt-store", () => ({ invalidateAiPromptMemoryCache }));
vi.mock("@/db", () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
		transaction,
	},
}));

const PROMPT_ID = "prm-1";

describe("D32 Sprint B · POST /api/admin/ai/prompts/[id]/activate", () => {
	afterEach(() => {
		gateRef.value = ADMIN_GATE_ALLOW;
		writeAdminActionStrict.mockClear();
		selectLimit.mockReset();
		transaction.mockClear();
		invalidateAiPromptMemoryCache.mockClear();
	});

	it("401 when admin gate rejects", async () => {
		gateRef.value = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/activate/route");
		const res = await POST(
			new Request(`http://localhost/api/admin/ai/prompts/${PROMPT_ID}/activate`),
			{ params: Promise.resolve({ id: PROMPT_ID }) },
		);
		expect(res.status).toBe(401);
	});

	it("404 when prompt not found", async () => {
		selectLimit.mockResolvedValueOnce([]);
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/activate/route");
		const res = await POST(
			new Request(`http://localhost/api/admin/ai/prompts/${PROMPT_ID}/activate`),
			{ params: Promise.resolve({ id: PROMPT_ID }) },
		);
		expect(res.status).toBe(404);
		expect(transaction).not.toHaveBeenCalled();
	});

	it("happy path: strict audit BEFORE transaction, then activate + invalidate cache", async () => {
		selectLimit
			.mockResolvedValueOnce([{ id: PROMPT_ID, feature: "doubt", version: 2 }])
			.mockResolvedValueOnce([
				{ id: PROMPT_ID, feature: "doubt", version: 2, isActive: true },
			]);
		const { POST } = await import("@/app/api/admin/ai/prompts/[id]/activate/route");
		const res = await POST(
			new Request(`http://localhost/api/admin/ai/prompts/${PROMPT_ID}/activate`),
			{ params: Promise.resolve({ id: PROMPT_ID }) },
		);
		expect(res.status).toBe(200);
		expect(writeAdminActionStrict).toHaveBeenCalledTimes(1);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(invalidateAiPromptMemoryCache).toHaveBeenCalledWith("doubt");
		const audit = writeAdminActionStrict.mock.calls[0]?.[0] as unknown as {
			action: string;
			targetId: string;
			payload: { feature: string; version: number };
		};
		expect(audit.action).toBe("ai_prompt_activate");
		expect(audit.targetId).toBe(PROMPT_ID);
		expect(audit.payload.feature).toBe("doubt");
		expect(audit.payload.version).toBe(2);
	});
});
