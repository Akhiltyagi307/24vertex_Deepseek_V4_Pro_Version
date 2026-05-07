import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminQuotaGrantsPanel } from "@/components/admin/billing/admin-quota-grants-panel";
import { AdminSubscriptionActions } from "@/components/admin/billing/admin-subscription-actions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { adminGetSubscriptionById } from "@/lib/admin/billing/subscription-detail";

export const metadata = {
	title: "Admin · Billing · Subscription",
	robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillingSubscriptionDetailPage({ params }: Props) {
	const id = (await params).id;
	const detail = await adminGetSubscriptionById(id);
	if (!detail) notFound();

	const s = detail.subscription;
	const rzpLinked = Boolean(s.razorpay_subscription_id);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Subscriptions", href: "/admin/billing/subscriptions" },
					{ label: s.plan_code },
				]}
				title={`${detail.plan_name} · ${s.status}`}
				description={
					detail.email ?
						`Subscriber: ${detail.profile.full_name} (${detail.email}).`
					:	`Subscriber: ${detail.profile.full_name}.`
				}
			/>
			<p className="-mt-4 text-sm">
				<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/users/${s.profile_id}`}>
					View user profile
				</Link>
			</p>

			<div className="grid max-w-3xl gap-3 rounded-lg border border-border p-4 text-sm">
				<Row label="Subscription id" value={<span className="font-mono text-xs">{s.id}</span>} />
				<Row label="Plan" value={`${s.plan_code} — ${detail.plan_name}`} />
				<Row label="Status" value={s.status} />
				<Row label="Current period" value={`${s.current_period_start.toISOString().slice(0, 10)} → ${s.current_period_end.toISOString().slice(0, 10)}`} />
				<Row label="Cancel at period end" value={s.cancel_at_period_end ? "yes" : "no"} />
				<Row label="Staff override" value={s.staff_override ? "yes" : "no"} />
				<Row label="Razorpay subscription" value={s.razorpay_subscription_id ? <span className="font-mono text-xs">{s.razorpay_subscription_id}</span> : "—"} />
				<Row label="Pending plan change" value={s.pending_plan_code ?? "—"} />
				<Row label="Trial ends" value={s.trial_ends_at ? s.trial_ends_at.toISOString() : "—"} />
			</div>

			<AdminSubscriptionActions
				subscriptionId={s.id}
				cancelAtPeriodEnd={s.cancel_at_period_end}
				razorpayLinked={rzpLinked}
				staffOverride={s.staff_override}
				currentStatus={s.status}
			/>

			<AdminQuotaGrantsPanel subscriptionId={s.id} />

			<div>
				<h3 className="mb-2 text-sm font-semibold">Usage periods (recent)</h3>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
								<th className="px-3 py-2">Period</th>
								<th className="px-3 py-2">Tests</th>
								<th className="px-3 py-2">Tokens</th>
							</tr>
						</thead>
						<tbody>
							{detail.usage_periods.map((p) => (
								<tr key={p.id} className="border-b border-border/80">
									<td className="px-3 py-2 text-muted-foreground">
										{p.period_start.slice(0, 10)} → {p.period_end.slice(0, 10)}
									</td>
									<td className="px-3 py-2 tabular-nums">
										{p.tests_used}/{p.tests_quota}
									</td>
									<td className="px-3 py-2 tabular-nums">
										{p.tokens_used}/{p.tokens_quota}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{detail.usage_periods.length === 0 ?
						<p className="p-4 text-sm text-muted-foreground">No usage period rows.</p>
					:	null}
				</div>
			</div>
		</div>
	);
}

function Row({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 medium:flex-row medium:items-baseline medium:gap-4">
			<dt className="w-52 shrink-0 text-muted-foreground">{label}</dt>
			<dd className="min-w-0 font-medium">{value}</dd>
		</div>
	);
}
