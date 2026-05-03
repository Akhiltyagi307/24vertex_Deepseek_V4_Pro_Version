import { and, asc, eq, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
});

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const subjectId = sp.get("subject_id");
		const sid = subjectId ? z.string().uuid().safeParse(subjectId) : null;
		if (!sid?.success) {
			return NextResponse.json({ error: "subject_id (uuid) required" }, { status: 400, headers: adminHeaders() });
		}

		const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? "50") || 50));
		const after = sp.get("after");
		const afterId = after ? z.string().uuid().safeParse(after) : null;
		if (after && !afterId?.success) {
			return NextResponse.json({ error: "after must be uuid" }, { status: 400, headers: adminHeaders() });
		}

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

		return NextResponse.json({ data: page, next_after: nextAfter }, { headers: adminHeaders() });
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
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = postSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
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
				action: "topic_create",
				targetType: "topic",
				targetId: id,
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
		}

		return NextResponse.json({ ok: true, id }, { status: 201, headers: adminHeaders() });
	});
}
