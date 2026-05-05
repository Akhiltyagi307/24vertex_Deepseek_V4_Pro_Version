import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { contentBlacklist } from "@/db/schema/content-blacklist";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		await db.delete(contentBlacklist).where(eq(contentBlacklist.id, id));

		// Strict audit: hard delete of a blacklist row immediately re-allows
		// the previously-blocked pattern through the moderation gate.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.MODERATION_BLACKLIST_DELETE,
			targetType: "content_blacklist",
			targetId: id,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
