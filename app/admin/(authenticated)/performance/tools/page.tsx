import { AdminBulkReinitPanel } from "@/components/admin/performance/admin-bulk-reinit-panel";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";

export const metadata = {
	title: "Admin performance tools · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminPerformanceToolsPage() {
	await requireAdmin();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Performance", href: "/admin/performance/tracker" },
					{ label: "Tools" },
				]}
				title="Performance tools"
				description="Bulk operations and job polling (Phase 3)."
			/>
			<p className="text-sm text-muted-foreground">
				Saved views and export are not attached to this job panel yet. Use bulk re-init below and audit logs for
				tracing.
			</p>
			<AdminBulkReinitPanel />
		</div>
	);
}
