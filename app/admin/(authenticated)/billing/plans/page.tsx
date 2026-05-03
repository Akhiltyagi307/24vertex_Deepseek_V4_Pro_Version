import { asc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { plans } from "@/db/schema/billing";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Billing · Plans",
	robots: { index: false, follow: false },
};

export default async function AdminBillingPlansPage() {
	const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.code));

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Plans" },
				]}
				title="Plans"
				description="SaaS catalog. Edit quotas and pricing on each plan page; use Razorpay sync to compare remote amounts."
			/>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingPlans}
					filenameBase="billing-plans"
					headers={[
						"code",
						"name",
						"interval",
						"price_paise",
						"tests_per_period",
						"razorpay_plan_id",
						"is_active",
						"sort_order",
					]}
					rows={rows.map((r) => ({
						code: r.code,
						name: r.name,
						interval: r.interval,
						price_paise: r.pricePaise,
						tests_per_period: r.testsPerPeriod,
						razorpay_plan_id: r.razorpayPlanId ?? "",
						is_active: r.isActive,
						sort_order: r.sortOrder,
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Code</th>
							<th className="px-3 py-2">Name</th>
							<th className="px-3 py-2">Interval</th>
							<th className="px-3 py-2">Price (paise)</th>
							<th className="px-3 py-2">Tests / period</th>
							<th className="px-3 py-2">Razorpay plan</th>
							<th className="px-3 py-2">Active</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.code} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">
									<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/plans/${encodeURIComponent(r.code)}`}>
										{r.code}
									</Link>
								</td>
								<td className="px-3 py-2">{r.name}</td>
								<td className="px-3 py-2">{r.interval}</td>
								<td className="px-3 py-2 tabular-nums">{r.pricePaise}</td>
								<td className="px-3 py-2 tabular-nums">{r.testsPerPeriod}</td>
								<td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.razorpayPlanId ?? "—"}</td>
								<td className="px-3 py-2">{r.isActive ? "yes" : "no"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No plans.</p> : null}
			</div>
		</div>
	);
}
