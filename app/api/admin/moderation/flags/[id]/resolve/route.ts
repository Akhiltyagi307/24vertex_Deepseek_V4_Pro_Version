import { z } from "zod";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { db } from "@/db";
import { moderationFlags } from "@/db/schema/moderation-flags";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

const bodySchema = z.object({
	status: z.enum(["open", "reviewing", "upheld", "dismissed"]),
	resolution: z.string().max(30).optional(),
	resolution_notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(json);
		if (!parsed.success) {
			return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
		}

		const now = new Date();
		await db
			.update(moderationFlags)
			.set({
				status: parsed.data.status,
				resolution: parsed.data.resolution ?? null,
				resolutionNotes: parsed.data.resolution_notes ?? null,
				resolvedAt: parsed.data.status === "open" || parsed.data.status === "reviewing" ? null : now,
			})
			.where(eq(moderationFlags.id, id));

		await writeAdminAction({
			action: "moderation_flag_resolve",
			targetType: "moderation_flag",
			targetId: id,
			payload: parsed.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
