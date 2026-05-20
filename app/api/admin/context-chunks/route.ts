import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS, adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { topicContextChunks } from "@/db/schema/topic-context-chunks";

export const runtime = "nodejs";

const postSchema = z.object({
	topic_id: z.string().uuid(),
	content: z.string().min(1),
	chunk_type: z.enum(["context", "exercise"]),
	source_ref: z.string().optional().nullable(),
	metadata: z.record(z.unknown()).optional(),
}).strict();

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const topicId = request.nextUrl.searchParams.get("topic_id");
		const tid = topicId ? z.string().uuid().safeParse(topicId) : null;
		if (!tid?.success) {
			return adminErrorResponse("topic_id (uuid) required");
		}

		const rows = await db
			.select()
			.from(topicContextChunks)
			.where(eq(topicContextChunks.topicId, tid.data))
			.orderBy(asc(topicContextChunks.createdAt));

		// `{ data: rows }` — chunks per topic; no pagination on the admin UI.
		return NextResponse.json({ data: rows }, { headers: { ...ADMIN_RESPONSE_HEADERS } });
	});
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = postSchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}
		const b = parsed.data;

		const inserted = await db
			.insert(topicContextChunks)
			.values({
				topicId: b.topic_id,
				content: b.content,
				chunkType: b.chunk_type,
				sourceRef: b.source_ref ?? null,
				metadata: (b.metadata ?? {}) as Record<string, unknown>,
			})
			.returning({ id: topicContextChunks.id });

		const id = inserted[0]?.id;
		if (id) {
			await writeAdminAction({
				action: ADMIN_ACTIONS.CONTEXT_CHUNK_CREATE,
				targetType: "topic_context_chunk",
				targetId: id,
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
		}

		return adminAckResponse({ id }, { status: 201 });
	});
}
