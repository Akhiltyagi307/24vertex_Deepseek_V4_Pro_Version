import { desc } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { moderationFlags } from "@/db/schema/moderation-flags";

export const metadata = {
	title: "Moderation · EduAI Admin",
	robots: { index: false, follow: false },
};

export default async function AdminModerationPage() {
	const rows = await db.select().from(moderationFlags).orderBy(desc(moderationFlags.createdAt)).limit(150);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Moderation" },
				]}
				title="Moderation queue"
				description="User reports and heuristic flags. Blacklist: /api/admin/moderation/blacklist"
			/>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[900px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Created</th>
							<th className="px-3 py-2 font-medium">Entity</th>
							<th className="px-3 py-2 font-medium">Source</th>
							<th className="px-3 py-2 font-medium">Severity</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Reason</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={6} className="px-3 py-6 text-muted-foreground">
									No flags yet.
								</td>
							</tr>
						:	rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-3 py-2 text-muted-foreground">{r.createdAt?.toISOString() ?? ""}</td>
									<td className="px-3 py-2 font-mono text-xs">
										{r.entityType} · {r.entityId}
									</td>
									<td className="px-3 py-2">{r.source}</td>
									<td className="px-3 py-2">{r.severity}</td>
									<td className="px-3 py-2">{r.status}</td>
									<td className="px-3 py-2 max-w-md truncate">{r.reason ?? ""}</td>
								</tr>
							))
						}
					</tbody>
				</table>
			</div>
		</div>
	);
}
