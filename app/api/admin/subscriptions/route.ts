import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminErrorResponse, adminListResponse } from "@/lib/admin/response";
import { adminListSubscriptions } from "@/lib/admin/billing/subscriptions-list";

export const runtime = "nodejs";

const statusSchema = z.string().trim().min(1).max(40).optional();

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(250, Math.max(1, Number(sp.get("page_size") ?? "25") || 25));

		const statusRaw = sp.get("status")?.trim();
		const statusParsed = statusRaw ? statusSchema.safeParse(statusRaw) : { success: true as const, data: undefined };
		if (!statusParsed.success) return adminErrorResponse("Invalid status filter");

		const q = sp.get("q")?.trim() ?? null;

		const { rows, total } = await adminListSubscriptions({
			page,
			pageSize,
			status: statusParsed.data ?? null,
			q,
		});

		const data = rows.map((r) => ({
			id: r.id,
			profile_id: r.profile_id,
			plan_code: r.plan_code,
			status: r.status,
			trial_ends_at: r.trial_ends_at ? r.trial_ends_at.toISOString() : null,
			current_period_start: r.current_period_start.toISOString(),
			current_period_end: r.current_period_end.toISOString(),
			cancel_at_period_end: r.cancel_at_period_end,
			razorpay_subscription_id: r.razorpay_subscription_id,
			staff_override: r.staff_override,
			full_name: r.full_name,
			email: r.email,
			created_at: r.created_at ? r.created_at.toISOString() : null,
			updated_at: r.updated_at ? r.updated_at.toISOString() : null,
		}));

		return adminListResponse({ data, total, page, pageSize });
	});
}
