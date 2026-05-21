import Link from "next/link";
import { desc } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export const metadata = {
	title: "Operator jobs · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default async function AdminOperatorJobsPage() {
	const rows = await db.select().from(operatorJobs).orderBy(desc(operatorJobs.createdAt)).limit(200);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/sql-console" },
					{ label: "Jobs" },
				]}
				title="Operator jobs"
				description="Queued work in Postgres (`jobs` table). Drained by Supabase pg_cron → `/api/internal/admin/process-operator-jobs`, or inline fallback when the app cannot self-fetch."
			/>
			<div className="flex flex-wrap gap-3 text-sm">
				<Link className="text-primary underline" href="/admin/system/jobs/queues">
					Queues
				</Link>
				<Link className="text-primary underline" href="/admin/system/jobs/schedules">
					Schedules
				</Link>
			</div>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[720px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Id</th>
							<th className="px-3 py-2 font-medium">Queue</th>
							<th className="px-3 py-2 font-medium">Name</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Progress</th>
							<th className="px-3 py-2 font-medium">Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={6} className="px-3 py-6 text-muted-foreground">
									No jobs yet. Trigger bulk re-init from Performance tools.
								</td>
							</tr>
						:	rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
									<td className="px-3 py-2">{r.queue}</td>
									<td className="px-3 py-2">{r.name}</td>
									<td className="px-3 py-2">{r.status}</td>
									<td className="px-3 py-2">{r.progress}%</td>
									<td className="px-3 py-2 text-muted-foreground">{r.createdAt?.toISOString() ?? ""}</td>
								</tr>
							))
						}
					</tbody>
				</table>
			</div>
		</div>
	);
}
