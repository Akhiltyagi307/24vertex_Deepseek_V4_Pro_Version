import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminJobSchedulesTable } from "@/components/admin/system/admin-job-schedules-table";

export const metadata = {
	title: "Job schedules · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default function AdminJobSchedulesPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Jobs", href: "/admin/system/jobs" },
					{ label: "Schedules" },
				]}
				title="Schedules"
				description="Supabase pg_cron jobs that call internal admin routes (Vault `app_base_url` + `cron_secret`)."
			/>
			<div className="flex flex-wrap gap-3 text-sm">
				<Link className="text-primary underline" href="/admin/system/jobs">
					Operator jobs
				</Link>
				<Link className="text-primary underline" href="/admin/system/jobs/queues">
					Queues
				</Link>
			</div>
			<AdminJobSchedulesTable />
		</div>
	);
}
