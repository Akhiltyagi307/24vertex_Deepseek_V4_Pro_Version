import { desc, eq } from "drizzle-orm";

import { AdminPerformanceToolsShell } from "@/components/admin/performance/admin-performance-tools-shell";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";
import { BULK_TRACKER_QUEUE } from "@/lib/jobs/queue-names";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export const metadata = {
	title: "Admin performance tools · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminPerformanceToolsPage() {
	await requireAdmin();

	const recentJobs = await db
		.select()
		.from(operatorJobs)
		.where(eq(operatorJobs.queue, BULK_TRACKER_QUEUE))
		.orderBy(desc(operatorJobs.createdAt))
		.limit(20);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Performance", href: "/admin/performance/tracker" },
					{ label: "Tools" },
				]}
				title="Performance tools"
				description="Bulk performance tracker operations and job history."
			/>
			<AdminPerformanceToolsShell
				recentJobs={recentJobs.map((r) => ({
					id: r.id,
					queue: r.queue,
					name: r.name,
					status: r.status,
					progress: r.progress,
					createdAt: r.createdAt?.toISOString() ?? null,
				}))}
			/>
		</div>
	);
}
