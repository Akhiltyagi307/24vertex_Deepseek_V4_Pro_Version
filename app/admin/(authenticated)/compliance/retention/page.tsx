import { asc } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { RetentionPolicyRow } from "@/components/admin/compliance/retention-policy-row";
import { db } from "@/db";
import { retentionPolicies } from "@/db/schema/retention-policies";

export const metadata = {
	title: "Compliance · Retention · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminComplianceRetentionPage() {
	const rows = await db.select().from(retentionPolicies).orderBy(asc(retentionPolicies.entity));

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Compliance", href: "/admin/compliance/requests" },
					{ label: "Retention" },
				]}
				title="Retention policies"
				description="Disabled by default. Purges run via POST /api/internal/admin/compliance-retention (cron) or dry-run from each row."
			/>
			<div className="space-y-2">
				{rows.map((r) => (
					<RetentionPolicyRow key={r.entity} policy={r} />
				))}
			</div>
		</div>
	);
}
