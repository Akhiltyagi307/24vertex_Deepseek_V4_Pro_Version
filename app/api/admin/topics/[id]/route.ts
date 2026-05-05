import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { revalidateCurriculumTopicCaches } from "@/lib/cache/curriculum-topic-counts";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		const rows = await db.select().from(topics).where(eq(topics.id, uuid.data)).limit(1);
		if (!rows[0]) return adminErrorResponse("Not found", { status: 404 });
		return adminDetailResponse(rows[0]);
	});
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch {
			return adminErrorResponse("Invalid JSON");
		}

		const patch: Partial<typeof topics.$inferInsert> = { updatedAt: new Date() };
		if (typeof body.topic_name === "string") patch.topicName = body.topic_name;
		if (typeof body.unit_name === "string") patch.unitName = body.unit_name;
		if (typeof body.chapter_name === "string") patch.chapterName = body.chapter_name;
		if (typeof body.description === "string" || body.description === null) patch.description = body.description as string | null;
		if (typeof body.is_active === "boolean") patch.isActive = body.is_active;

		await db.update(topics).set(patch).where(eq(topics.id, uuid.data));

		await writeAdminAction({
			action: ADMIN_ACTIONS.TOPIC_UPDATE,
			targetType: "topic",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		revalidateCurriculumTopicCaches();
		return adminAckResponse();
	});
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		await db.delete(topics).where(eq(topics.id, uuid.data));

		// Strict audit: hard delete of curriculum content row, no soft-delete
		// column to fall back on. Missing audit row would erase the record
		// without a trail.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.TOPIC_DELETE,
			targetType: "topic",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		revalidateCurriculumTopicCaches();
		return adminAckResponse();
	});
}
