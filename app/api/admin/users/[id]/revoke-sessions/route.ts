import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		const admin = createServiceRoleClient();
		const { error } = await admin.auth.admin.signOut(uuid.data, "global");
		if (error) {
			Sentry.captureException(error, { tags: { feature: "admin", action: "user_sessions_revoke_all" } });
			return adminErrorResponse(error.message, { status: 502 });
		}

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.USER_SESSIONS_REVOKE_ALL,
			targetType: "profile",
			targetId: uuid.data,
			payload: { scope: "global" },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
