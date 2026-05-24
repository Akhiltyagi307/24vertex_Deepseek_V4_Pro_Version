import { AdminJobQueuesPanel } from "@/components/admin/system/admin-job-queues-panel";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { ADMIN_OPERATOR_QUEUE_NAMES } from "@/lib/admin/jobs/schedules";
import { isOperatorQueuePaused } from "@/lib/jobs/operator-queue-pause";

export const metadata = {
	title: "Job queues · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default async function AdminJobQueuesPage() {
	const queues = await Promise.all(
		ADMIN_OPERATOR_QUEUE_NAMES.map(async (name) => ({
			name,
			paused: await isOperatorQueuePaused(name),
		})),
	);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Jobs", href: "/admin/system/jobs" },
					{ label: "Queues" },
				]}
				title="Queues"
				description="Pause or resume operator job queues. State is stored in Postgres (`admin_runtime_kv`)."
			/>
			<AdminJobQueuesPanel queues={queues} />
		</div>
	);
}
