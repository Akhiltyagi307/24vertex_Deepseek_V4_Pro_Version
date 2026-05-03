import { eq } from "drizzle-orm";
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

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		const rows = await db.select().from(topics).where(eq(topics.id, uuid.data)).limit(1);
		if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		return NextResponse.json({ data: rows[0] }, { headers: adminHeaders() });
	});
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

		const patch: Partial<typeof topics.$inferInsert> = { updatedAt: new Date() };
		if (typeof body.topic_name === "string") patch.topicName = body.topic_name;
		if (typeof body.unit_name === "string") patch.unitName = body.unit_name;
		if (typeof body.chapter_name === "string") patch.chapterName = body.chapter_name;
		if (typeof body.description === "string" || body.description === null) patch.description = body.description as string | null;
		if (typeof body.is_active === "boolean") patch.isActive = body.is_active;

		await db.update(topics).set(patch).where(eq(topics.id, uuid.data));

		await writeAdminAction({
			action: "topic_update",
			targetType: "topic",
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

		await db.delete(topics).where(eq(topics.id, uuid.data));

		await writeAdminAction({
			action: "topic_delete",
			targetType: "topic",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
