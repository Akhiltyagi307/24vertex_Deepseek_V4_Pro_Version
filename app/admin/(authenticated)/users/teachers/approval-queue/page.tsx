import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminTeacherApprovalQueue } from "@/components/admin/users/admin-teacher-approval-queue";

export const metadata = {
	title: "Teacher approval queue · 24Vertex Admin",
	robots: { index: false, follow: false },
};


export default function AdminTeacherApprovalQueuePage() {
	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Users", href: "/admin/users/teachers" },
					{ label: "Teacher approvals" },
				]}
				title="Teacher approval queue"
				description="Approve verified teachers, reject with a reason, or request more information."
			/>
			<AdminTeacherApprovalQueue />
		</div>
	);
}
