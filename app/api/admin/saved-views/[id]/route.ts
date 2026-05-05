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
import { adminSavedViews } from "@/db/schema/admin-saved-views";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		// Read first so the audit row records what was deleted (list_id + name),
		// not just an opaque UUID. A NOT-FOUND delete still goes through silently
		// today; we keep that behavior but skip the audit row to avoid noise.
		const [existing] = await db
			.select({
				id: adminSavedViews.id,
				listId: adminSavedViews.listId,
				name: adminSavedViews.name,
			})
			.from(adminSavedViews)
			.where(eq(adminSavedViews.id, uuid.data))
			.limit(1);

		await db.delete(adminSavedViews).where(eq(adminSavedViews.id, uuid.data));

		if (existing) {
			await writeAdminAction({
				action: ADMIN_ACTIONS.SAVED_VIEW_DELETE,
				targetType: "admin_saved_view",
				targetId: uuid.data,
				payload: {
					list_id: existing.listId,
					name: existing.name,
				},
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
		}

		return adminAckResponse();
	});
}
