import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminUsersBrowser } from "@/components/admin/users/admin-users-browser";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Parents · 24Vertex Admin",
	robots: { index: false, follow: false },
};


export default function AdminParentsPage() {
	return (
		<div>
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Users", href: "/admin/users/students" },
					{ label: "Parents" },
				]}
				title="Parents"
			/>
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
				<AdminUsersBrowser listId={ADMIN_LIST_ID.usersParents} role="parent" title="" />
			</Suspense>
		</div>
	);
}
