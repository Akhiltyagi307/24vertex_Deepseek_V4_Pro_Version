import { and, asc, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS, adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { revalidateCurriculumTopicCaches } from "@/lib/cache/curriculum-topic-counts";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";

export const runtime = "nodejs";

const postSchema = z.object({
	subject_id: z.string().uuid(),
	grade: z.number().int().min(1).max(12),
	unit_name: z.string().min(1).max(250),
	unit_number: z.number().int(),
	chapter_name: z.string().min(1).max(250),
	chapter_number: z.number().int(),
	topic_name: z.string().min(1).max(250),
	topic_number: z.number().int(),
	description: z.string().optional().nullable(),
}).strict();

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const subjectId = sp.get("subject_id");
		const sid = subjectId ? z.string().uuid().safeParse(subjectId) : null;
		if (!sid?.success) return adminErrorResponse("subject_id (uuid) required");

		const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? "50") || 50));
		const after = sp.get("after");
		const afterId = after ? z.string().uuid().safeParse(after) : null;
		if (after && !afterId?.success) return adminErrorResponse("after must be uuid");

		const base = and(eq(topics.subjectId, sid.data));
		const whereSql = afterId?.success ? and(base, gt(topics.id, afterId.data)) : base;

		const rows = await db
			.select()
			.from(topics)
			.where(whereSql)
			.orderBy(asc(topics.id))
			.limit(limit + 1);
		const hasMore = rows.length > limit;
		const page = hasMore ? rows.slice(0, limit) : rows;
		const nextAfter = hasMore ? page[page.length - 1]?.id : null;

		// Cursor-pagination shape (`data` + `next_after`) — keep client contract.
		return NextResponse.json(
			{ data: page, next_after: nextAfter },
			{ headers: { ...ADMIN_RESPONSE_HEADERS } },
		);
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
			.insert(topics)
			.values({
				subjectId: b.subject_id,
				grade: b.grade,
				unitName: b.unit_name,
				unitNumber: b.unit_number,
				chapterName: b.chapter_name,
				chapterNumber: b.chapter_number,
				topicName: b.topic_name,
				topicNumber: b.topic_number,
				description: b.description ?? null,
			})
			.returning({ id: topics.id });

		const id = inserted[0]?.id;
		if (id) {
			await writeAdminAction({
				action: ADMIN_ACTIONS.TOPIC_CREATE,
				targetType: "topic",
				targetId: id,
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
		}

		revalidateCurriculumTopicCaches();
		return adminAckResponse({ id }, { status: 201 });
	});
}
