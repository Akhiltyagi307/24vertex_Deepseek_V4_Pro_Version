import { desc, eq } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { integrityCheckResults } from "@/db/schema/integrity-check-results";
import { INTEGRITY_CHECK_NAMES } from "@/lib/admin/integrity/check-runners";

export const metadata = {
	title: "Data integrity · EduAI Admin",
	robots: { index: false, follow: false },
};

export default async function AdminIntegrityPage() {
	const summaries = await Promise.all(
		INTEGRITY_CHECK_NAMES.map(async (name) => {
			const rows = await db
				.select()
				.from(integrityCheckResults)
				.where(eq(integrityCheckResults.checkName, name))
				.orderBy(desc(integrityCheckResults.ranAt))
				.limit(1);
			return { name, last: rows[0] };
		}),
	);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "System", href: "/admin/system/sql-console" },
					{ label: "Integrity" },
				]}
				title="Integrity checks"
				description="Run checks on demand via API, or daily via Supabase pg_cron → `/api/internal/admin/integrity-checks`."
			/>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Check</th>
							<th className="px-3 py-2 font-medium">Last rows</th>
							<th className="px-3 py-2 font-medium">Last run</th>
							<th className="px-3 py-2 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{summaries.map(({ name, last }) => (
							<tr key={name} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{name}</td>
								<td className="px-3 py-2">{last?.rowsFound ?? "—"}</td>
								<td className="px-3 py-2 text-muted-foreground">{last?.ranAt?.toISOString() ?? "—"}</td>
								<td className="px-3 py-2 text-muted-foreground">POST /api/admin/system/integrity/checks/{name}/run</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="text-xs text-muted-foreground">
				Use curl or the operator CLI: POST /api/admin/system/integrity/checks/&lt;name&gt;/run with admin cookie.
			</p>
		</div>
	);
}
