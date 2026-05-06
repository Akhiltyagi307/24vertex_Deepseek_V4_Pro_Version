import { and, count, desc, isNotNull, isNull, type SQL } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { billingReconciliationDrift } from "@/db/schema/billing";

export const metadata = {
	title: "Admin · Billing · Reconciliation",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; resolved?: string }> };

export default async function AdminBillingReconciliationPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 60;
	const offset = (page - 1) * pageSize;
	const resolved = sp.resolved?.trim();

	const conditions: SQL[] = [];
	if (resolved === "1") conditions.push(isNotNull(billingReconciliationDrift.resolvedAt));
	if (resolved === "0") conditions.push(isNull(billingReconciliationDrift.resolvedAt));
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const listBase = db
		.select({
			id: billingReconciliationDrift.id,
			subscriptionId: billingReconciliationDrift.subscriptionId,
			paymentId: billingReconciliationDrift.paymentId,
			idempotencyKey: billingReconciliationDrift.idempotencyKey,
			field: billingReconciliationDrift.field,
			localValue: billingReconciliationDrift.localValue,
			razorpayValue: billingReconciliationDrift.razorpayValue,
			detectedAt: billingReconciliationDrift.detectedAt,
			resolvedAt: billingReconciliationDrift.resolvedAt,
		})
		.from(billingReconciliationDrift);
	const listFiltered = whereSql ? listBase.where(whereSql) : listBase;
	const rows = await listFiltered.orderBy(desc(billingReconciliationDrift.detectedAt)).limit(pageSize).offset(offset);

	const countBase = db.select({ total: count() }).from(billingReconciliationDrift);
	const countFiltered = whereSql ? countBase.where(whereSql) : countBase;
	const [{ total }] = await countFiltered;
	const totalPages = Math.max(1, Math.ceil(Number(total ?? 0) / pageSize));

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Reconciliation" },
				]}
				title="Billing reconciliation"
				description="Daily diff between our DB and Razorpay (subscriptions + pending refund idempotency rows). Open drift means a missed webhook or a refund whose status couldn't be confirmed."
			/>

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex w-36 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="rd-res">
						Status
					</label>
					<select
						id="rd-res"
						name="resolved"
						defaultValue={resolved ?? "0"}
						className="h-9 rounded-md border border-input bg-background px-2 text-sm"
					>
						<option value="">Any</option>
						<option value="0">Open</option>
						<option value="1">Resolved</option>
					</select>
				</div>
				<button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
					Apply
				</button>
			</form>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Detected</th>
							<th className="px-3 py-2">Field</th>
							<th className="px-3 py-2">Local</th>
							<th className="px-3 py-2">Razorpay</th>
							<th className="px-3 py-2">Subscription</th>
							<th className="px-3 py-2">Payment / Key</th>
							<th className="px-3 py-2">Status</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 text-muted-foreground">{r.detectedAt.toISOString().slice(0, 19)}</td>
								<td className="px-3 py-2 font-mono">{r.field}</td>
								<td className="max-w-xs truncate px-3 py-2">{r.localValue ?? "—"}</td>
								<td className="max-w-xs truncate px-3 py-2">{r.razorpayValue ?? "—"}</td>
								<td className="px-3 py-2 font-mono text-xs">{r.subscriptionId?.slice(0, 8) ?? "—"}</td>
								<td className="px-3 py-2 font-mono text-xs">{r.paymentId?.slice(0, 8) ?? r.idempotencyKey?.slice(0, 16) ?? "—"}</td>
								<td className="px-3 py-2">{r.resolvedAt ? "resolved" : "open"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No drift recorded.</p> : null}
			</div>

			{totalPages > 1 ? (
				<nav className="flex gap-2 text-sm text-muted-foreground">
					<span>
						Page {page} / {totalPages}
					</span>
				</nav>
			) : null}
		</div>
	);
}
