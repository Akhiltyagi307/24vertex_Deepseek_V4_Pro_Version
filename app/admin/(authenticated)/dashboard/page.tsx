import { AdminKpiCard } from "@/components/admin/dashboard/kpi-card";
import { AdminRealtimeSmoke } from "@/components/admin/dashboard/admin-realtime-smoke";
import { getAdminDashboardMetrics, metricToNumber } from "@/lib/admin/dashboard-metrics";

export const metadata = {
	title: "Admin dashboard · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
	const row = await getAdminDashboardMetrics();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
				<p className="text-sm text-muted-foreground">Operator metrics (materialized view; refreshes on schedule).</p>
			</div>
			{row ?
				<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-4">
					<AdminKpiCard label="Total students" value={metricToNumber(row.total_students)} />
					<AdminKpiCard label="Active (24h)" value={metricToNumber(row.active_24h)} />
					<AdminKpiCard label="Tests submitted today" value={metricToNumber(row.tests_submitted_today)} />
					<AdminKpiCard label="Tests in progress" value={metricToNumber(row.tests_in_progress)} />
					<AdminKpiCard label="Active subscriptions" value={metricToNumber(row.active_subscriptions)} />
					<AdminKpiCard label="MRR proxy (INR)" value={metricToNumber(row.mrr_inr)} hint="Heuristic from plan mix" />
					<AdminKpiCard label="Pending teacher approvals" value={metricToNumber(row.pending_teacher_approvals)} />
					<AdminKpiCard label="Stuck webhooks (5m+)" value={metricToNumber(row.stuck_webhooks)} />
					<AdminKpiCard label="Open DSRs" value={metricToNumber(row.open_dsrs)} />
					<AdminKpiCard label="Open moderation flags" value={metricToNumber(row.open_mod_flags)} />
					<AdminKpiCard label="Failed operator jobs (24h)" value={metricToNumber(row.failed_jobs_24h)} />
				</div>
			:	<p className="text-sm text-muted-foreground">Metrics view not available yet. Apply the Phase 1 migration.</p>}
			<div className="space-y-1">
				<AdminRealtimeSmoke />
			</div>
		</div>
	);
}
