import { desc } from "drizzle-orm";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { coupons } from "@/db/schema/billing";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Coupons",
	robots: { index: false, follow: false },
};

export default async function AdminCouponsPage() {
	const rows = await db
		.select({
			id: coupons.id,
			code: coupons.code,
			description: coupons.description,
			grantsPlanCode: coupons.grantsPlanCode,
			redemptionsCount: coupons.redemptionsCount,
			maxRedemptions: coupons.maxRedemptions,
			isActive: coupons.isActive,
			expiresAt: coupons.expiresAt,
			createdAt: coupons.createdAt,
		})
		.from(coupons)
		.orderBy(desc(coupons.createdAt))
		.limit(500);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/coupons" },
					{ label: "Coupons" },
				]}
				title="Coupons"
				description="Razorpay-linked discount codes (read-only list for Phase 6 search deep-links)."
			/>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingCoupons}
					filenameBase="billing-coupons"
					headers={["id", "code", "grants_plan_code", "redemptions", "max_redemptions", "is_active", "expires_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						code: r.code,
						grants_plan_code: r.grantsPlanCode,
						redemptions: r.redemptionsCount,
						max_redemptions: r.maxRedemptions,
						is_active: r.isActive,
						expires_at: r.expiresAt ? r.expiresAt.toISOString() : "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Code</th>
							<th className="px-3 py-2">Plan</th>
							<th className="px-3 py-2">Uses</th>
							<th className="px-3 py-2">Active</th>
							<th className="px-3 py-2">Expires</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.code}</td>
								<td className="px-3 py-2">{r.grantsPlanCode}</td>
								<td className="px-3 py-2 tabular-nums">
									{r.redemptionsCount}/{r.maxRedemptions}
								</td>
								<td className="px-3 py-2">{r.isActive ? "yes" : "no"}</td>
								<td className="px-3 py-2 text-muted-foreground">
									{r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="p-4 text-sm text-muted-foreground">No coupons.</p>
				:	null}
			</div>
		</div>
	);
}
