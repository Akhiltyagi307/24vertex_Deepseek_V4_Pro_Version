import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";

export const runtime = "nodejs";

const bodySchema = z.object({
	dry_run: z.boolean(),
	row_ids: z.array(z.string()).optional(),
}).strict();

/**
 * Auto-fix is check-specific; Phase 8 ships dry-run previews first (PDR §4.30).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ name: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { name } = await ctx.params;
		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(json);
		if (!parsed.success) return adminErrorResponse("Invalid body");

		const proposed: string[] = [
			`-- dry_run=${parsed.data.dry_run} check=${name}`,
			"-- Per-check fix SQL is not automated in v1; review rows from the last run and apply manually or extend this endpoint.",
		];

		await writeAdminAction({
			action: ADMIN_ACTIONS.INTEGRITY_CHECK_FIX,
			targetType: "integrity_check",
			targetId: name,
			payload: { dry_run: parsed.data.dry_run, row_ids: parsed.data.row_ids ?? [] },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminDetailResponse({ dry_run: parsed.data.dry_run, proposed_sql: proposed.join("\n") });
	});
}
