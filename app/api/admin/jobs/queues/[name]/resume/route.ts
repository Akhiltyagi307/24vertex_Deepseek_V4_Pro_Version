import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse } from "@/lib/admin/response";
import { setOperatorQueuePaused } from "@/lib/jobs/operator-queue-pause";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ name: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { name } = await ctx.params;
		await setOperatorQueuePaused(name, false);

		// Strict audit: queue resume restarts production-affecting workers.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.OPERATOR_QUEUE_RESUME,
			targetType: "queue",
			targetId: name,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
