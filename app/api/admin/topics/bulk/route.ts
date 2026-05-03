import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { revalidateCurriculumTopicCaches } from "@/lib/cache/curriculum-topic-counts";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("deactivate"),
		ids: z.array(z.string().uuid()).min(1),
	}),
	z.object({
		action: z.literal("activate"),
		ids: z.array(z.string().uuid()).min(1),
	}),
]);

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
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
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const active = parsed.data.action === "activate";
		await db
			.update(topics)
			.set({ isActive: active, updatedAt: new Date() })
			.where(inArray(topics.id, parsed.data.ids));

		await writeAdminAction({
			action: "topic_bulk",
			targetType: "topics",
			payload: { action: parsed.data.action, count: parsed.data.ids.length },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		revalidateCurriculumTopicCaches();
		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
