import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { anonymizeProfile } from "@/lib/admin/anonymize";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminGetUserById } from "@/lib/admin/users-list";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		const before = await adminGetUserById(uuid.data);
		if (!before) return adminErrorResponse("User not found", { status: 404 });

		await anonymizeProfile(uuid.data);

		// Strict audit: PII anonymization is irreversible. Without an audit
		// row we lose any record of who anonymized whom, and the `payload`
		// snapshot is the last surviving copy of the original email/name.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.USER_SOFT_DELETE,
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email, full_name_snapshot: before.full_name },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
