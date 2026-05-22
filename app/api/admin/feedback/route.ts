import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { userFeedbackReports } from "@/db/schema/user-feedback-reports";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse } from "@/lib/admin/response";
import { FEEDBACK_STATUSES } from "@/lib/feedback/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const statusParam = request.nextUrl.searchParams.get("status") ?? "open";
		const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100, 500);

		const rows =
			statusParam === "all" ?
				await db.select().from(userFeedbackReports).orderBy(desc(userFeedbackReports.createdAt)).limit(limit)
			:	FEEDBACK_STATUSES.includes(statusParam as (typeof FEEDBACK_STATUSES)[number]) ?
				await db
					.select()
					.from(userFeedbackReports)
					.where(eq(userFeedbackReports.status, statusParam))
					.orderBy(desc(userFeedbackReports.createdAt))
					.limit(limit)
			:	await db
					.select()
					.from(userFeedbackReports)
					.where(eq(userFeedbackReports.status, "open"))
					.orderBy(desc(userFeedbackReports.createdAt))
					.limit(limit);

		return adminDetailResponse(rows);
	});
}
