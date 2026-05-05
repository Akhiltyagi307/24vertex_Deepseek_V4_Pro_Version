import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse } from "@/lib/admin/response";
import { runAllHealthPings } from "@/lib/jobs/health/run-all-health-pings";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { provider } = await ctx.params;
		await runAllHealthPings();

		await writeAdminAction({
			action: ADMIN_ACTIONS.SERVICE_HEALTH_CHECK,
			targetType: "provider",
			targetId: provider,
			payload: {},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
