import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { payments } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Billing · Payments",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminBillingPaymentsPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 40;
	const offset = (page - 1) * pageSize;
	const q = sp.q?.trim();

	const conditions: SQL[] = [];
	if (q) {
		const pattern = `%${q.replace(/%/g, "\\%")}%`;
		conditions.push(
			or(ilike(payments.razorpayPaymentId, pattern), ilike(profiles.fullName, pattern), ilike(authUsers.email, pattern))!,
		);
	}
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const listBase = db
		.select({
			id: payments.id,
			razorpayPaymentId: payments.razorpayPaymentId,
			amountPaise: payments.amountPaise,
			status: payments.status,
			refundedAt: payments.refundedAt,
			fullName: profiles.fullName,
			email: authUsers.email,
			createdAt: payments.createdAt,
		})
		.from(payments)
		.innerJoin(profiles, eq(payments.profileId, profiles.id))
		.leftJoin(authUsers, eq(authUsers.id, profiles.id));
	const listFiltered = whereSql ? listBase.where(whereSql) : listBase;
	const rows = await listFiltered.orderBy(desc(payments.createdAt)).limit(pageSize).offset(offset);

	const countBase = db
		.select({ total: count() })
		.from(payments)
		.innerJoin(profiles, eq(payments.profileId, profiles.id))
		.leftJoin(authUsers, eq(authUsers.id, profiles.id));
	const countFiltered = whereSql ? countBase.where(whereSql) : countBase;
	const [{ total: totalRaw }] = await countFiltered;
	const total = Number(totalRaw ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const qs = (p: number) => {
		const u = new URLSearchParams();
		if (q) u.set("q", q);
		if (p > 1) u.set("page", String(p));
		const s = u.toString();
		return s ? `?${s}` : "";
	};

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Payments" },
				]}
				title="Payments"
				description="Captured charges. Refunds require Razorpay id and Idempotency-Key on the detail page."
			/>

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex min-w-[12rem] flex-1 flex-col gap-1">
					<label htmlFor="pay-q" className="text-xs font-medium text-muted-foreground">
						Search
					</label>
					<input
						id="pay-q"
						name="q"
						type="search"
						defaultValue={q ?? ""}
						placeholder="Razorpay id, name, email"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
					/>
				</div>
				<button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
					Apply
				</button>
			</form>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingPayments}
					filenameBase="billing-payments"
					headers={["id", "razorpay_payment_id", "amount_paise", "status", "email", "full_name", "refunded_at", "created_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						razorpay_payment_id: r.razorpayPaymentId ?? "",
						amount_paise: r.amountPaise,
						status: r.status,
						email: r.email ?? "",
						full_name: r.fullName,
						refunded_at: r.refundedAt?.toISOString() ?? "",
						created_at: r.createdAt.toISOString(),
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Created</th>
							<th className="px-3 py-2">Amount</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2">User</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 text-muted-foreground">{r.createdAt.toISOString().slice(0, 19)}</td>
								<td className="px-3 py-2 tabular-nums">
									<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/payments/${r.id}`}>
										₹{(r.amountPaise / 100).toFixed(2)}
									</Link>
								</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2">
									{r.fullName}
									{r.email ? <span className="block text-xs text-muted-foreground">{r.email}</span> : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No payments.</p> : null}
			</div>

			{totalPages > 1 ?
				<nav className="flex gap-2 text-sm">
					{page > 1 ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/payments${qs(page - 1)}`}>
							Previous
						</Link>
					:	null}
					<span className="text-muted-foreground">
						Page {page} / {totalPages}
					</span>
					{page < totalPages ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/payments${qs(page + 1)}`}>
							Next
						</Link>
					:	null}
				</nav>
			:	null}
		</div>
	);
}
