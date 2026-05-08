import { desc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminCouponBulkForm } from "@/components/admin/billing/admin-coupon-bulk-form";
import { AdminCouponListRow } from "@/components/admin/billing/admin-coupon-list-row";
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
			kind: coupons.kind,
			discountPercent: coupons.discountPercent,
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
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Coupons" },
				]}
				title="Coupons"
				description="Create and manage coupon codes, redemptions, and disablement from detail pages."
			/>
			<div className="flex flex-wrap gap-3">
				<Link
					className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
					href="/admin/billing/coupons/new"
				>
					New coupon
				</Link>
			</div>
			<AdminCouponBulkForm />
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingCoupons}
					filenameBase="billing-coupons"
					headers={[
						"id",
						"code",
						"kind",
						"grants_plan_code",
						"discount_percent",
						"redemptions",
						"max_redemptions",
						"is_active",
						"expires_at",
					]}
					rows={rows.map((r) => ({
						id: r.id,
						code: r.code,
						kind: r.kind,
						grants_plan_code: r.grantsPlanCode ?? "",
						discount_percent: r.discountPercent ?? "",
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
							<th className="px-3 py-2">Kind</th>
							<th className="px-3 py-2">Plan / %</th>
							<th className="px-3 py-2">Uses</th>
							<th className="px-3 py-2">Active</th>
							<th className="px-3 py-2">Expires</th>
							<th className="px-3 py-2 text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<AdminCouponListRow
								key={r.id}
								id={r.id}
								code={r.code}
								kind={r.kind}
								grantsPlanCode={r.grantsPlanCode}
								discountPercent={r.discountPercent}
								redemptionsCount={r.redemptionsCount}
								maxRedemptions={r.maxRedemptions}
								isActive={r.isActive}
								expiresAt={r.expiresAt}
							/>
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
