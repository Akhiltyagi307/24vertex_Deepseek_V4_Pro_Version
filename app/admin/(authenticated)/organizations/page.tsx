import { AdminOrganizationsManager } from "@/components/admin/organizations/admin-organizations-manager";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export default function AdminOrganizationsPage() {
	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Organizations" },
				]}
				title="Organizations"
				description="Create and manage schools or tuition centers that students and teachers can connect to."
			/>
			<AdminOrganizationsManager />
		</div>
	);
}
