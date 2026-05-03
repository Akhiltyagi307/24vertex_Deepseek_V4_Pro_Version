import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { topicContextChunks } from "@/db/schema/topic-context-chunks";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}

		const patch: Partial<typeof topicContextChunks.$inferInsert> = {};
		if (typeof body.content === "string") patch.content = body.content;
		if (body.chunk_type === "context" || body.chunk_type === "exercise") patch.chunkType = body.chunk_type;
		if (typeof body.source_ref === "string" || body.source_ref === null) patch.sourceRef = body.source_ref as string | null;
		if (body.metadata && typeof body.metadata === "object") patch.metadata = body.metadata as Record<string, unknown>;

		await db.update(topicContextChunks).set(patch).where(eq(topicContextChunks.id, uuid.data));

		await writeAdminAction({
			action: "context_chunk_update",
			targetType: "topic_context_chunk",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		await db.delete(topicContextChunks).where(eq(topicContextChunks.id, uuid.data));

		await writeAdminAction({
			action: "context_chunk_delete",
			targetType: "topic_context_chunk",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
