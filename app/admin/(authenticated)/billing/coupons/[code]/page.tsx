import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminCouponDetailForm } from "@/components/admin/billing/admin-coupon-detail-form";
import { AdminCouponRedemptions } from "@/components/admin/billing/admin-coupon-redemptions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { coupons } from "@/db/schema/billing";

export const metadata = {
	title: "Admin · Billing · Coupon",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ code: string }> };

export default async function AdminCouponDetailPage({ params }: Props) {
	const raw = decodeURIComponent((await params).code).trim().toUpperCase();
	if (!raw) notFound();

	const rows = await db.select().from(coupons).where(eq(coupons.code, raw)).limit(1);
	const row = rows[0];
	if (!row) notFound();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Coupons", href: "/admin/billing/coupons" },
					{ label: row.code },
				]}
				title={`Coupon · ${row.code}`}
				description={
					row.kind === "checkout_discount"
						? `Checkout ${row.discountPercent ?? "?"}% off · max ${row.maxRedemptions} uses`
						: `Grants plan ${row.grantsPlanCode ?? "—"} · duration ${row.durationDays}d`
				}
			/>

			<AdminCouponDetailForm
				initial={{
					code: row.code,
					kind: row.kind,
					description: row.description,
					max_redemptions: row.maxRedemptions,
					redemptions_count: row.redemptionsCount,
					duration_days: row.durationDays,
					is_active: row.isActive,
					expires_at: row.expiresAt?.toISOString() ?? null,
					single_use_globally: row.singleUseGlobally,
					discount_percent: row.discountPercent,
					eligible_plan_codes: row.eligiblePlanCodes,
					razorpay_offers_by_plan: row.razorpayOffersByPlan,
				}}
			/>

			<div>
				<h3 className="mb-2 text-sm font-semibold">Redemptions</h3>
				<AdminCouponRedemptions code={row.code} />
			</div>

			<p className="text-sm text-muted-foreground">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/coupons">
					← All coupons
				</Link>
			</p>
		</div>
	);
}
