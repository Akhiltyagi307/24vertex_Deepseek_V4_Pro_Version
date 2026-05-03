import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { BULK_TRACKER_QUEUE, HEALTH_QUEUE, INTEGRITY_QUEUE } from "@/lib/jobs/queue-names";

export const metadata = {
	title: "Job queues · EduAI Admin",
	robots: { index: false, follow: false },
};

export default function AdminJobQueuesPage() {
	const queues = [BULK_TRACKER_QUEUE, HEALTH_QUEUE, INTEGRITY_QUEUE];
	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Jobs", href: "/admin/system/jobs" },
					{ label: "Queues" },
				]}
				title="Queues"
				description="Pause/resume stores a flag in Postgres (`admin_runtime_kv`). Operator jobs drain via Supabase pg_cron (pg_net) or POST `/api/internal/admin/process-operator-jobs` with `CRON_SECRET`."
			/>
			<ul className="list-inside list-disc space-y-2 text-sm">
				{queues.map((q) => (
					<li key={q}>
						<code className="rounded bg-muted px-1 py-0.5">{q}</code> — POST{" "}
						<code className="rounded bg-muted px-1 py-0.5">/api/admin/jobs/queues/{q}/pause</code> or{" "}
						<code className="rounded bg-muted px-1 py-0.5">/resume</code>
					</li>
				))}
			</ul>
		</div>
	);
}
