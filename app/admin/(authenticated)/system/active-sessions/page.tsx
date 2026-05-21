import { Suspense } from "react";

import { AdminActiveSessionsClient } from "./active-sessions-client";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export const metadata = {
	title: "Admin active sessions · 24Vertex",
	robots: { index: false, follow: false },
};

export default function AdminActiveSessionsPage() {
	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/active-sessions" },
					{ label: "Active sessions" },
				]}
				title="Active sessions"
				description="Non-revoked admin JWT sessions. Kill ends access on the next request."
			/>
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
				<AdminActiveSessionsClient />
			</Suspense>
		</div>
	);
}
