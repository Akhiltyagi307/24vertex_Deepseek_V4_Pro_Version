import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { getAdminAnalyticsFunnelData } from "@/lib/admin/analytics/funnel-data";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import Link from "next/link";

export const metadata = {
	title: "Analytics funnel · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAnalyticsFunnelPage() {
	const { stages, events_90d } = await getAdminAnalyticsFunnelData();

	const stageRows: Record<string, unknown>[] = stages.map((s) => ({
		event_name: s.event_name,
		count: s.count,
	}));
	const eventRows: Record<string, unknown>[] = events_90d.map((e) => ({
		event_name: e.eventName,
		count: e.n,
	}));

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold tracking-tight">Funnel</h1>
			<p className="text-sm text-muted-foreground">
				Use the JSON API for charts or wire widgets later.{" "}
				<Link className="text-primary underline" href="/api/admin/analytics/funnel">
					/api/admin/analytics/funnel
				</Link>
			</p>
			<Suspense fallback={null}>
				<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stages (90d)</p>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.analyticsFunnel}
					filenameBase="analytics-funnel-stages"
					headers={["event_name", "count"]}
					rows={stageRows}
				/>
				<p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">All events (90d)</p>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.analyticsFunnelEvents}
					filenameBase="analytics-funnel-events-90d"
					headers={["event_name", "count"]}
					rows={eventRows}
				/>
			</Suspense>
		</div>
	);
}
