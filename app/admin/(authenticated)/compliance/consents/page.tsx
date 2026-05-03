import { desc } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { ConsentRerequestForm } from "@/components/admin/compliance/consent-rerequest-form";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";

export const metadata = {
	title: "Compliance · Consents · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminComplianceConsentsPage() {
	const rows = await db.select().from(parentalConsents).orderBy(desc(parentalConsents.grantedAt)).limit(500);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Compliance", href: "/admin/compliance/requests" },
					{ label: "Consents" },
				]}
				title="Parental consents"
				description="COPPA ledger and consent re-request."
			/>
			<ConsentRerequestForm />
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[800px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Student</th>
							<th className="px-3 py-2 font-medium">Parent email</th>
							<th className="px-3 py-2 font-medium">Method</th>
							<th className="px-3 py-2 font-medium">Text v</th>
							<th className="px-3 py-2 font-medium">Granted</th>
							<th className="px-3 py-2 font-medium">Revoked</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.studentId}</td>
								<td className="px-3 py-2">{r.parentEmail}</td>
								<td className="px-3 py-2">{r.consentMethod}</td>
								<td className="px-3 py-2">{r.consentTextV}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.grantedAt?.toISOString?.() ?? "—"}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.revokedAt?.toISOString?.() ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No consent rows yet.</p>
				:	null}
			</div>
		</div>
	);
}
