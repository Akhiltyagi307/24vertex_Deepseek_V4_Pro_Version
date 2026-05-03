import { Suspense } from "react";

import { AdminSqlConsoleClient } from "./sql-console-client";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export const metadata = {
	title: "Admin SQL console · EduAI",
	robots: { index: false, follow: false },
};

export default function AdminSqlConsolePage() {
	const writeEnabled =
		process.env.ADMIN_SQL_WRITE_ENABLED?.trim().toLowerCase() === "true" ||
		process.env.ADMIN_SQL_WRITE_ENABLED?.trim() === "1";

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/sql-console" },
					{ label: "SQL console" },
				]}
				title="SQL console"
				description="Read-only queries against DATABASE_URL with EXPLAIN cost gate and audit logging. Optional gated writes when enabled on the server."
			/>
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading editor…</p>}>
				<AdminSqlConsoleClient writeEnabled={writeEnabled} />
			</Suspense>
		</div>
	);
}
