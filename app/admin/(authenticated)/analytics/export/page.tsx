import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import {
	listPracticeAnalyticsEventsOrdered,
	practiceAnalyticsRowsToExportRecords,
} from "@/lib/admin/analytics/export-preview-rows";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Analytics export · Admin",
	robots: { index: false, follow: false },
};

const PREVIEW_LIMIT = 500;

export default async function AdminAnalyticsExportPage() {
	const raw = await listPracticeAnalyticsEventsOrdered(PREVIEW_LIMIT);
	const rows = practiceAnalyticsRowsToExportRecords(raw);

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold tracking-tight">Export</h1>
			<p className="text-sm text-muted-foreground">
				Download a CSV snapshot of practice analytics events (capped at 50k in the API).{" "}
				<Link className="font-medium text-primary underline" href="/api/admin/analytics/export">
					Download CSV
				</Link>
			</p>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.analyticsExport}
					filenameBase="analytics-export-preview"
					headers={["id", "student_id", "event_name", "occurred_at", "props_json"]}
					rows={rows}
				/>
			</Suspense>
		</div>
	);
}
