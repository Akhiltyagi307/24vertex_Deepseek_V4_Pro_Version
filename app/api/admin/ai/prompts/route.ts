import { desc, eq, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS, adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const feature = request.nextUrl.searchParams.get("feature");
	const rows = feature
		? await db.select().from(aiPrompts).where(eq(aiPrompts.feature, feature)).orderBy(desc(aiPrompts.version))
		: await db.select().from(aiPrompts).orderBy(desc(aiPrompts.createdAt)).limit(500);

	return NextResponse.json({ data: rows }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
}

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const schema = z.object({
		feature: z.string().min(1).max(64),
		name: z.string().min(1).max(200),
		template: z.string().min(1),
		model: z.string().min(1).max(64),
		temperature: z.number().optional(),
		max_tokens: z.number().optional(),
		notes: z.string().optional(),
	}).strict();
	const parsed = schema.safeParse(json);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}

	const [verRow] = await db
		.select({ maxv: max(aiPrompts.version) })
		.from(aiPrompts)
		.where(eq(aiPrompts.feature, parsed.data.feature));

	const nextVersion = (verRow?.maxv ?? 0) + 1;

	await writeAdminAction({
		action: ADMIN_ACTIONS.AI_PROMPT_VERSION_CREATE,
		payload: { feature: parsed.data.feature, version: nextVersion },
	});

	const [row] = await db
		.insert(aiPrompts)
		.values({
			feature: parsed.data.feature,
			name: parsed.data.name,
			version: nextVersion,
			template: parsed.data.template,
			model: parsed.data.model,
			temperature:
				parsed.data.temperature !== undefined ? parsed.data.temperature.toFixed(2) : null,
			maxTokens: parsed.data.max_tokens ?? null,
			isActive: false,
			notes: parsed.data.notes ?? null,
		})
		.returning();

	return adminDetailResponse(row);
}
