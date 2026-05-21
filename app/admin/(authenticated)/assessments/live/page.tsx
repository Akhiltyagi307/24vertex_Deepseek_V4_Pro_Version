import { AdminLiveTestsPanel } from "@/components/admin/assessments/admin-live-tests-panel";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";

export const metadata = {
	title: "Admin live tests · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminLiveTestsPage() {
	await requireAdmin();

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Live" },
				]}
				title="Live test sessions"
				description="In-progress tests with recent activity (PDR §4.28). Use test detail for actions."
			/>
			<AdminLiveTestsPanel />
		</div>
	);
}
