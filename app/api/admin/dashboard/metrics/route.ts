import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getAdminDashboardMetrics, metricToNumber } from "@/lib/admin/dashboard-metrics";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const row = await getAdminDashboardMetrics();
		if (!row) {
			return NextResponse.json(
				{ error: "Metrics unavailable", code: "no_metrics" },
				{ status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } },
			);
		}

		const data = {
			total_students: metricToNumber(row.total_students),
			active_24h: metricToNumber(row.active_24h),
			tests_submitted_today: metricToNumber(row.tests_submitted_today),
			tests_in_progress: metricToNumber(row.tests_in_progress),
			active_subscriptions: metricToNumber(row.active_subscriptions),
			mrr_inr: metricToNumber(row.mrr_inr),
			pending_teacher_approvals: metricToNumber(row.pending_teacher_approvals),
			stuck_webhooks: metricToNumber(row.stuck_webhooks),
			open_dsrs: metricToNumber(row.open_dsrs),
			open_mod_flags: metricToNumber(row.open_mod_flags),
			failed_jobs_24h: metricToNumber(row.failed_jobs_24h),
			computed_at: row.computed_at instanceof Date ? row.computed_at.toISOString() : String(row.computed_at ?? ""),
		};

		return NextResponse.json({ data }, { headers: { "X-Robots-Tag": "noindex, nofollow" } });
	});
}
