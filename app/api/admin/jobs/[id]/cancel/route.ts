import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";
import { failOperatorJob } from "@/lib/jobs/operator-job-mirror";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const rows = await db.select().from(operatorJobs).where(eq(operatorJobs.id, id)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		await failOperatorJob(id, "cancelled_by_admin");

		// Strict audit: cancelling a queued job changes operator state — needs
		// to be attributable.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.OPERATOR_JOB_CANCEL,
			targetType: "job",
			targetId: id,
			payload: { queue: row.queue },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
