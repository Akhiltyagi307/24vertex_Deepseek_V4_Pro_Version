import Link from "next/link";
import { desc } from "drizzle-orm";

import { DeadlineBadge } from "@/components/admin/compliance/deadline-badge";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const metadata = {
	title: "Compliance · Requests · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminComplianceRequestsPage() {
	const rows = await db.select().from(complianceRequests).orderBy(desc(complianceRequests.createdAt)).limit(200);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Compliance", href: "/admin/compliance/requests" },
					{ label: "Requests" },
				]}
				title="Data subject requests"
				description="GDPR / COPPA / FERPA / DPDP workflow queue."
			/>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[900px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">ID</th>
							<th className="px-3 py-2 font-medium">Type</th>
							<th className="px-3 py-2 font-medium">Subject</th>
							<th className="px-3 py-2 font-medium">Requester</th>
							<th className="px-3 py-2 font-medium">Basis</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Due</th>
							<th className="px-3 py-2 font-medium">Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">
									<Link className="text-primary underline" href={`/admin/compliance/requests/${r.id}`}>
										{r.id.slice(0, 8)}…
									</Link>
								</td>
								<td className="px-3 py-2">{r.requestType}</td>
								<td className="px-3 py-2 font-mono text-xs">{r.subjectUserId ?? r.subjectEmail ?? "—"}</td>
								<td className="px-3 py-2">{r.requesterEmail}</td>
								<td className="px-3 py-2">{r.legalBasis}</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2">
									<DeadlineBadge dueAt={r.dueAt} />
								</td>
								<td className="px-3 py-2 text-muted-foreground">{r.createdAt?.toISOString?.() ?? ""}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No requests yet.</p>
				:	null}
			</div>
		</div>
	);
}
