import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

const bodySchema = z.object({
	reason: z.string().max(2000).optional(),
}).strict();

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			body = {};
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
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

		if (!updated[0]) return adminErrorResponse("User not found", { status: 404 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.USER_SUSPEND,
			targetType: "profile",
			targetId: uuid.data,
			payload: { reason },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
