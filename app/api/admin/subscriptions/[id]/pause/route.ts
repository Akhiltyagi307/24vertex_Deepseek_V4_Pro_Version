import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { consumeAdminActionRateLimit, adminActionScope } from "@/lib/admin/rate-limit-action";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { pauseSubscriptionForProfile } from "@/lib/billing/subscription-lifecycle-ops";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.SUBSCRIPTION_PAUSE,
			scope: adminActionScope({ jti: gate.jti, ip: clientIpFromRequest(request) }),
			limit: 10,
			windowSec: 60,
		});
		if (!rl.allowed) {
			return adminErrorResponse("Rate limited", { status: 429 });
		}

		const rows = await db
			.select({ profileId: subscriptions.profileId })
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);
		const sub = rows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });

		const result = await pauseSubscriptionForProfile(sub.profileId);
		if (!result.ok) {
			return adminErrorResponse(result.message, { status: result.status, code: result.code });
		}

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.SUBSCRIPTION_PAUSE,
			targetType: "subscription",
			targetId: uuid.data,
			payload: { admin: true, deduped: result.deduped ?? false },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ deduped: result.deduped ?? false });
	});
}
