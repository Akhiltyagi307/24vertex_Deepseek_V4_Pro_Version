import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { adminListSubscriptions } from "@/lib/admin/billing/subscriptions-list";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Billing · Subscriptions",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; q?: string; status?: string }> };

export default async function AdminBillingSubscriptionsPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 25;
	const q = sp.q?.trim() || null;
	const status = sp.status?.trim() || null;

	const { rows, total } = await adminListSubscriptions({ page, pageSize, q, status });
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const qs = (p: number) => {
		const u = new URLSearchParams();
		if (q) u.set("q", q);
		if (status) u.set("status", status);
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
					{ label: "Subscriptions" },
				]}
				title="Subscriptions"
				description="One row per profile. Detail pages support cancel-at-period-end, immediate cancel, offline status flips, staff override, and test quota grants."
			/>

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex min-w-[12rem] flex-1 flex-col gap-1">
					<label htmlFor="sub-q" className="text-xs font-medium text-muted-foreground">
						Search
					</label>
					<input
						id="sub-q"
						name="q"
						type="search"
						defaultValue={q ?? ""}
						placeholder="Name, email, plan code"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
					/>
				</div>
				<div className="flex w-40 flex-col gap-1">
					<label htmlFor="sub-status" className="text-xs font-medium text-muted-foreground">
						Status
					</label>
					<input
						id="sub-status"
						name="status"
						type="text"
						defaultValue={status ?? ""}
						placeholder="e.g. active"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
					/>
				</div>
				<button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
					Apply
				</button>
			</form>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingSubscriptions}
					filenameBase="billing-subscriptions"
					headers={[
						"id",
						"profile_id",
						"plan_code",
						"status",
						"email",
						"full_name",
						"current_period_end",
						"razorpay_subscription_id",
					]}
					rows={rows.map((r) => ({
						id: r.id,
						profile_id: r.profile_id,
						plan_code: r.plan_code,
						status: r.status,
						email: r.email ?? "",
						full_name: r.full_name,
						current_period_end: r.current_period_end.toISOString(),
						razorpay_subscription_id: r.razorpay_subscription_id ?? "",
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Subscription</th>
							<th className="px-3 py-2">User</th>
							<th className="px-3 py-2">Plan</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2">Period end</th>
							<th className="px-3 py-2">Razorpay sub</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2">
									<Link className="font-mono text-xs text-primary underline-offset-4 hover:underline" href={`/admin/billing/subscriptions/${r.id}`}>
										{r.id.slice(0, 8)}…
									</Link>
								</td>
								<td className="px-3 py-2">
									<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/users/${r.profile_id}`}>
										{r.full_name}
									</Link>
									{r.email ? <div className="text-xs text-muted-foreground">{r.email}</div> : null}
								</td>
								<td className="px-3 py-2 font-mono text-xs">{r.plan_code}</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2 tabular-nums text-muted-foreground">{r.current_period_end.toISOString().slice(0, 10)}</td>
								<td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.razorpay_subscription_id ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No subscriptions match.</p> : null}
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
				<span>
					Page {page} of {totalPages} · {total} total
				</span>
				<div className="flex gap-3">
					{page > 1 ?
						<Link className="text-primary hover:underline" href={`/admin/billing/subscriptions${qs(page - 1)}`}>
							Previous
						</Link>
					:	<span className="opacity-40">Previous</span>}
					{page < totalPages ?
						<Link className="text-primary hover:underline" href={`/admin/billing/subscriptions${qs(page + 1)}`}>
							Next
						</Link>
					:	<span className="opacity-40">Next</span>}
				</div>
			</div>
		</div>
	);
}
