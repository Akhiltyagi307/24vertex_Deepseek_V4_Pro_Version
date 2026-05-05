import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { plans, subscriptions, usagePeriods } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

/**
 * Re-aligns the current (or latest) `usage_periods` quotas with the `plans` row
 * for this subscription's `plan_code` and the student's grade. Does not reset
 * `tests_used` / `tokens_used`.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const subId = z.string().uuid().safeParse(id);
		if (!subId.success) return adminErrorResponse("Invalid subscription id");

		const rows = await db
			.select({
				sub: subscriptions,
				plan: plans,
				grade: profiles.grade,
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planCode, plans.code))
			.innerJoin(profiles, eq(subscriptions.profileId, profiles.id))
			.where(eq(subscriptions.id, subId.data))
			.limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });

		const plan = row.plan;
		const tokensQuota =
			row.grade != null && row.grade >= 11 && row.grade <= 12 ? plan.tokensGrade11to12 : plan.tokensGrade6to10;
		const testsQuota = plan.testsPerPeriod;

		const periodRows = await db
			.select()
			.from(usagePeriods)
			.where(eq(usagePeriods.subscriptionId, row.sub.id))
			.orderBy(desc(usagePeriods.periodEnd))
			.limit(24);

		const nowMs = Date.now();
		const usage =
			periodRows.find((p) => {
				const s = p.periodStart.getTime();
				const e = p.periodEnd.getTime();
				return s <= nowMs && e > nowMs;
			}) ?? periodRows[0];

		if (!usage) return adminErrorResponse("No usage_periods rows for subscription", { status: 404 });

		await db
			.update(usagePeriods)
			.set({
				testsQuota,
				tokensQuota,
			})
			.where(eq(usagePeriods.id, usage.id));

		await writeAdminAction({
			action: ADMIN_ACTIONS.SUBSCRIPTION_RECOMPUTE_USAGE,
			targetType: "subscription",
			targetId: row.sub.id,
			payload: {
				usage_period_id: usage.id,
				tests_quota: testsQuota,
				tokens_quota: tokensQuota,
				plan_code: plan.code,
			},
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({
			usage_period_id: usage.id,
			tests_quota: testsQuota,
			tokens_quota: tokensQuota,
		});
	});
}
