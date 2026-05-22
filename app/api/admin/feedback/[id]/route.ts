import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { db } from "@/db";
import { userFeedbackReports } from "@/db/schema/user-feedback-reports";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { FEEDBACK_STATUSES } from "@/lib/feedback/types";

export const runtime = "nodejs";

const patchSchema = z
	.object({
		status: z.enum(FEEDBACK_STATUSES),
		admin_notes: z.string().max(2000).optional(),
	})
	.strict();

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = patchSchema.safeParse(json);
		if (!parsed.success) return adminErrorResponse("Invalid body");

		const now = new Date();
		const resolved =
			parsed.data.status === "resolved" || parsed.data.status === "closed" ? now : null;

		await db
			.update(userFeedbackReports)
			.set({
				status: parsed.data.status,
				adminNotes: parsed.data.admin_notes ?? null,
				resolvedAt: resolved,
			})
			.where(eq(userFeedbackReports.id, id));

		await writeAdminAction({
			action: ADMIN_ACTIONS.FEEDBACK_REPORT_UPDATE,
			targetType: "user_feedback_report",
			targetId: id,
			payload: parsed.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
