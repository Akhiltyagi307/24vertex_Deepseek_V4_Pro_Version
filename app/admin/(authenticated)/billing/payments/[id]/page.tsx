import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefundPaymentButton } from "@/components/admin/billing/admin-refund-payment-button";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { payments } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export const metadata = {
	title: "Admin · Billing · Payment",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillingPaymentDetailPage({ params }: Props) {
	const id = (await params).id;
	const rows = await db
		.select({
			p: payments,
			fullName: profiles.fullName,
			email: authUsers.email,
		})
		.from(payments)
		.innerJoin(profiles, eq(payments.profileId, profiles.id))
		.leftJoin(authUsers, eq(authUsers.id, profiles.id))
		.where(eq(payments.id, id))
		.limit(1);
	const row = rows[0];
	if (!row) notFound();
	const p = row.p;

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Payments", href: "/admin/billing/payments" },
					{ label: p.id.slice(0, 8) },
				]}
				title={`Payment · ${p.status}`}
				description={
					row.email ? `${row.fullName} (${row.email})` : row.fullName
				}
			/>

			<div className="grid max-w-3xl gap-2 rounded-lg border border-border p-4 text-sm">
				<p>
					<span className="text-muted-foreground">Row id:</span> <span className="font-mono text-xs">{p.id}</span>
				</p>
				<p>
					<span className="text-muted-foreground">Razorpay payment:</span>{" "}
					{p.razorpayPaymentId ? <span className="font-mono text-xs">{p.razorpayPaymentId}</span> : "—"}
				</p>
				<p>
					<span className="text-muted-foreground">Amount:</span>{" "}
					<span className="tabular-nums">
						{p.amountPaise} paise ({p.currency})
					</span>
				</p>
				<p>
					<span className="text-muted-foreground">Captured:</span> {p.capturedAt?.toISOString() ?? "—"}
				</p>
				<p>
					<span className="text-muted-foreground">Refund:</span>{" "}
					{p.refundedAt ? `${p.refundAmountPaise ?? "?"} paise @ ${p.refundedAt.toISOString()}` : "—"}
				</p>
			</div>

			<AdminRefundPaymentButton
				paymentId={p.id}
				amountPaise={p.amountPaise}
				refundedAt={p.refundedAt?.toISOString() ?? null}
				razorpayPaymentId={p.razorpayPaymentId}
			/>

			<p className="text-sm text-muted-foreground">
				<Link className="text-primary underline-offset-4 hover:underline" href="/admin/billing/payments">
					← All payments
				</Link>
			</p>
		</div>
	);
}
