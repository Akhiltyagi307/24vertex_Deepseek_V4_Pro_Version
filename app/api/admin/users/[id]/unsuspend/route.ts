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

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		const now = new Date();
		const updated = await db
			.update(profiles)
			.set({
				isSuspended: false,
				suspendedReason: null,
				suspendedAt: null,
				updatedAt: now,
			})
			.where(eq(profiles.id, uuid.data))
			.returning({ id: profiles.id });

		if (!updated[0]) return adminErrorResponse("User not found", { status: 404 });

		await writeAdminAction({
			action: ADMIN_ACTIONS.USER_UNSUSPEND,
			targetType: "profile",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
