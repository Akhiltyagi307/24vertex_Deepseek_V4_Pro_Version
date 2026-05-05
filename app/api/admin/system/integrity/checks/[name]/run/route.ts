import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { integrityCheckResults } from "@/db/schema/integrity-check-results";
import { INTEGRITY_CHECK_NAMES, runIntegrityCheck, type IntegrityCheckName } from "@/lib/admin/integrity/check-runners";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ name: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { name } = await ctx.params;
		if (!INTEGRITY_CHECK_NAMES.includes(name as IntegrityCheckName)) {
			return adminErrorResponse("Unknown check");
		}

		const r = await runIntegrityCheck(name as IntegrityCheckName);
		await db.insert(integrityCheckResults).values({
			checkName: name,
			rowsFound: r.rowsFound,
			details: r.details,
		});

		await writeAdminAction({
			action: ADMIN_ACTIONS.INTEGRITY_CHECK_RUN,
			targetType: "integrity_check",
			targetId: name,
			payload: { rows_found: r.rowsFound },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse(r);
	});
}
