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
import type { PlanCode } from "@/lib/billing/plans";
import { changeSubscriptionPlanForProfile } from "@/lib/billing/subscription-lifecycle-ops";
import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z
	.object({
		new_plan_code: z.enum(["pro_monthly", "pro_annual"]),
		when: z.enum(["now", "cycle_end"]).optional(),
	})
	.strict();

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.SUBSCRIPTION_CHANGE_PLAN,
			scope: adminActionScope({ jti: gate.jti, ip: clientIpFromRequest(request) }),
			limit: 10,
			windowSec: 60,
		});
		if (!rl.allowed) {
			return adminErrorResponse("Rate limited", { status: 429 });
		}

		let json: unknown;
		try {
			json = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(json);
		if (!parsed.success) return adminErrorResponse("Invalid body");

		const rows = await db
			.select({ profileId: subscriptions.profileId })
			.from(subscriptions)
			.where(eq(subscriptions.id, uuid.data))
			.limit(1);
		const sub = rows[0];
		if (!sub) return adminErrorResponse("Not found", { status: 404 });

		const result = await changeSubscriptionPlanForProfile({
			profileId: sub.profileId,
			newPlanCode: parsed.data.new_plan_code as PlanCode,
			when: parsed.data.when,
			initiatedByUserId: null,
		});

		if (!result.ok) {
			return adminErrorResponse(result.message, {
				status: result.status,
				code: result.code,
			});
		}

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.SUBSCRIPTION_CHANGE_PLAN,
			targetType: "subscription",
			targetId: uuid.data,
			payload: {
				new_plan_code: parsed.data.new_plan_code,
				when: result.when,
				admin: true,
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({
			when: result.when,
			from_plan: result.from_plan,
			to_plan: result.to_plan,
		});
	});
}
