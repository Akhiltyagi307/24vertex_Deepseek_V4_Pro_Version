import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminGetSubscriptionById } from "@/lib/admin/billing/subscription-detail";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid subscription id");

		const raw = await adminGetSubscriptionById(uuid.data);
		if (!raw) return adminErrorResponse("Not found", { status: 404 });
		const s = raw.subscription;
		return adminDetailResponse({
			subscription: {
				id: s.id,
				profile_id: s.profile_id,
				plan_code: s.plan_code,
				status: s.status,
				trial_ends_at: s.trial_ends_at ? s.trial_ends_at.toISOString() : null,
				current_period_start: s.current_period_start.toISOString(),
				current_period_end: s.current_period_end.toISOString(),
				cancel_at_period_end: s.cancel_at_period_end,
				razorpay_subscription_id: s.razorpay_subscription_id,
				razorpay_customer_id: s.razorpay_customer_id,
				pending_plan_code: s.pending_plan_code,
				staff_override: s.staff_override,
				metadata: s.metadata,
				created_at: s.created_at ? s.created_at.toISOString() : null,
				updated_at: s.updated_at ? s.updated_at.toISOString() : null,
			},
			profile: raw.profile,
			email: raw.email,
			plan_name: raw.plan_name,
			usage_periods: raw.usage_periods,
		});
	});
}
