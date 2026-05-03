import Link from "next/link";

import { AdminCouponCreateForm } from "@/components/admin/billing/admin-coupon-create-form";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export const metadata = {
	title: "Admin · Billing · New coupon",
	robots: { index: false, follow: false },
};

export default function AdminNewCouponPage() {
	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Coupons", href: "/admin/billing/coupons" },
					{ label: "New" },
				]}
				title="Create coupon"
				description="Codes are normalized to uppercase. Plan must exist in the local catalog."
			/>
			<AdminCouponCreateForm />
			<p className="text-sm text-muted-foreground">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/coupons">
					← All coupons
				</Link>
			</p>
		</div>
	);
}
