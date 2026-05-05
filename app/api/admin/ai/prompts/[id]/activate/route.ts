import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { invalidateAiPromptMemoryCache } from "@/lib/ai/prompt-store";
import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id)).limit(1);
	if (!row) {
		return adminErrorResponse("Not found", { status: 404 });
	}

	await writeAdminAction({
		action: ADMIN_ACTIONS.AI_PROMPT_ACTIVATE,
		targetType: "ai_prompt",
		targetId: id,
		payload: { feature: row.feature, version: row.version },
	});

	await db.transaction(async (tx) => {
		await tx.update(aiPrompts).set({ isActive: false }).where(eq(aiPrompts.feature, row.feature));
		await tx.update(aiPrompts).set({ isActive: true }).where(eq(aiPrompts.id, id));
	});

	invalidateAiPromptMemoryCache(row.feature);

	const [updated] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id)).limit(1);
	return adminDetailResponse(updated);
}
