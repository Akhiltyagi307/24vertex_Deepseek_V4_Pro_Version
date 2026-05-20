import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminUsersBrowser } from "@/components/admin/users/admin-users-browser";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Teachers · EduAI Admin",
	robots: { index: false, follow: false },
};


export default function AdminTeachersPage() {
	return (
		<div>
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Users", href: "/admin/users/students" },
					{ label: "Teachers" },
				]}
				title="Teachers"
			/>
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
				<AdminUsersBrowser listId={ADMIN_LIST_ID.usersTeachers} role="teacher" title="" />
			</Suspense>
		</div>
	);
}
