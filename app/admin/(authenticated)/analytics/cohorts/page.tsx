import { sql } from "drizzle-orm";
import { Suspense } from "react";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { db } from "@/db";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { safeParseOrError } from "@/lib/validations/parse";

const cohortRowSchema = z.object({
	cohort_month: z
		.union([z.string(), z.date()])
		.transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)),
	cohort_size: z.number(),
});

export const metadata = {
	title: "Analytics cohorts · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAnalyticsCohortsPage() {
	const q = sql`
		select date_trunc('month', created_at)::date as cohort_month,
		       count(*)::int as cohort_size
		from profiles
		where role = 'student'
		  and deleted_at is null
		  and created_at >= now() - interval '12 months'
		group by 1
		order by 1 asc
	`;
	const rows = await db.execute(q);
	const parsed = safeParseOrError(z.array(cohortRowSchema), Array.from(rows as Iterable<unknown>));
	if (!parsed.ok) {
		Sentry.captureException(new Error(`Analytics cohorts row shape drift: ${parsed.issues.join("; ")}`), {
			tags: { area: "admin_analytics", op: "cohorts" },
		});
	}
	const cohortRows = parsed.ok ? parsed.data : [];

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold tracking-tight">Cohorts</h1>
			<p className="text-sm text-muted-foreground">Monthly student signup cohort sizes (12 months).</p>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.analyticsCohorts}
					filenameBase="analytics-cohorts"
					headers={["cohort_month", "cohort_size"]}
					rows={cohortRows.map((r) => ({
						cohort_month: r.cohort_month,
						cohort_size: r.cohort_size,
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[360px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Month</th>
							<th className="px-3 py-2 font-medium">Signups</th>
						</tr>
					</thead>
					<tbody>
						{cohortRows.map((r) => (
							<tr key={r.cohort_month} className="border-b border-border/80">
								<td className="px-3 py-2">{r.cohort_month}</td>
								<td className="px-3 py-2">{r.cohort_size}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
