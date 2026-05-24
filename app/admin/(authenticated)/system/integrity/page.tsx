import { desc, eq } from "drizzle-orm";

import { AdminIntegrityChecksPanel } from "@/components/admin/system/admin-integrity-checks-panel";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { integrityCheckResults } from "@/db/schema/integrity-check-results";
import { INTEGRITY_CHECK_NAMES } from "@/lib/admin/integrity/check-runners";

export const metadata = {
	title: "Data integrity · 24Vertex Admin",
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
				description="Run checks on demand, or daily via Supabase pg_cron → `/api/internal/admin/integrity-checks`."
			/>
			<AdminIntegrityChecksPanel
				checks={summaries.map(({ name, last }) => ({
					name,
					lastRows: last?.rowsFound ?? null,
					lastRanAt: last?.ranAt?.toISOString() ?? null,
				}))}
			/>
		</div>
	);
}
