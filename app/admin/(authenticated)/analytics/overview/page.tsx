import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { db } from "@/db";
import { practiceAnalyticsEvents } from "@/db/schema/practice-tables";
import { profiles } from "@/db/schema/profiles";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Analytics overview · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAnalyticsOverviewPage() {
	const since30 = new Date();
	since30.setDate(since30.getDate() - 30);

	const [students] = await db
		.select({ c: count() })
		.from(profiles)
		.where(and(eq(profiles.role, "student"), isNull(profiles.deletedAt)));

	const funnel = await db
		.select({
			eventName: practiceAnalyticsEvents.eventName,
			n: count(),
		})
		.from(practiceAnalyticsEvents)
		.where(gte(practiceAnalyticsEvents.occurredAt, since30))
		.groupBy(practiceAnalyticsEvents.eventName)
		.orderBy(desc(count()));

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Analytics overview</h1>
				<p className="text-sm text-muted-foreground">Student totals + practice funnel events (30d).</p>
			</div>
			<p className="text-sm">
				Students (non-deleted): <strong>{Number(students?.c ?? 0)}</strong>
			</p>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.analyticsOverview}
					filenameBase="analytics-overview-funnel"
					headers={["event_name", "count_30d"]}
					rows={funnel.map((r) => ({
						event_name: r.eventName,
						count_30d: String(r.n),
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[480px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Event</th>
							<th className="px-3 py-2 font-medium">Count (30d)</th>
						</tr>
					</thead>
					<tbody>
						{funnel.map((r) => (
							<tr key={r.eventName} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.eventName}</td>
								<td className="px-3 py-2">{String(r.n)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
