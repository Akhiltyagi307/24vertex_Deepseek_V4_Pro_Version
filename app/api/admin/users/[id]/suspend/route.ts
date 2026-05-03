import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

const bodySchema = z.object({
	reason: z.string().max(2000).optional(),
});

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid user id" }, { status: 400, headers: adminHeaders() });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			body = {};
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}
		const reason = parsed.data.reason ?? null;
		const now = new Date();

		const updated = await db
			.update(profiles)
			.set({
				isSuspended: true,
				suspendedReason: reason,
				suspendedAt: now,
				updatedAt: now,
			})
			.where(eq(profiles.id, uuid.data))
			.returning({ id: profiles.id });

		if (!updated[0]) {
			return NextResponse.json({ error: "User not found" }, { status: 404, headers: adminHeaders() });
		}

		await writeAdminAction({
			action: "user_suspend",
			targetType: "profile",
			targetId: uuid.data,
			payload: { reason },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
