import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { id } = await ctx.params;
	const [row] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id)).limit(1);
	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		json = {};
	}
	const parsed = z.object({ user: z.string().min(1).max(8000).optional() }).safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
	}

	const userMsg = parsed.data.user ?? "Reply with OK if you receive this test.";
	const t0 = Date.now();
	try {
		const result = await generateText({
			model: getOpenAIProvider().chat(row.model),
			system: row.template,
			prompt: userMsg,
			maxOutputTokens: row.maxTokens ?? 512,
			temperature: row.temperature ? Number(row.temperature) : undefined,
		});
		const usage = result.usage;
		void recordAiCall({
			feature: `admin.test.${row.feature}`,
			model: row.model,
			promptId: row.id,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});
		return NextResponse.json(
			{ text: result.text, usage },
			{ headers: adminHeaders() },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		void recordAiCall({
			feature: `admin.test.${row.feature}`,
			model: row.model,
			promptId: row.id,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: Date.now() - t0,
			status: "error",
			error: msg,
		});
		return NextResponse.json({ error: msg }, { status: 500, headers: adminHeaders() });
	}
}
