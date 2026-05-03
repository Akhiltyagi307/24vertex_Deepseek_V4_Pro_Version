import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";
import { failOperatorJob } from "@/lib/jobs/operator-job-mirror";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const rows = await db.select().from(operatorJobs).where(eq(operatorJobs.id, id)).limit(1);
		const row = rows[0];
		if (!row) {
			return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		}

		await failOperatorJob(id, "cancelled_by_admin");

		await writeAdminAction({
			action: "operator_job_cancel",
			targetType: "job",
			targetId: id,
			payload: { queue: row.queue },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
