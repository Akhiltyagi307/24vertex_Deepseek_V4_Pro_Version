import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import Link from "next/link";

import { ActionFailureRetryButton } from "@/components/admin/billing/action-failure-retry-button";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { db } from "@/db";
import { billingActionFailures } from "@/db/schema/billing";
import { BILLING_ACTION_FAILURE_KIND_NAMES } from "@/lib/billing/action-failures";

export const metadata = {
	title: "Admin · Billing · Action failures",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; kind?: string; resolved?: string }> };

export default async function AdminBillingActionFailuresPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 40;
	const offset = (page - 1) * pageSize;
	const kind = sp.kind?.trim();
	const resolved = sp.resolved?.trim();

	const conditions: SQL[] = [];
	if (kind && BILLING_ACTION_FAILURE_KIND_NAMES.has(kind as never)) {
		conditions.push(eq(billingActionFailures.kind, kind));
	}
	if (resolved === "1") conditions.push(isNotNull(billingActionFailures.resolvedAt));
	if (resolved === "0") conditions.push(isNull(billingActionFailures.resolvedAt));
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const listBase = db
		.select({
			id: billingActionFailures.id,
			kind: billingActionFailures.kind,
			couponId: billingActionFailures.couponId,
			profileId: billingActionFailures.profileId,
			subscriptionId: billingActionFailures.subscriptionId,
			razorpayEventId: billingActionFailures.razorpayEventId,
			errorMessage: billingActionFailures.errorMessage,
			retryCount: billingActionFailures.retryCount,
			resolvedAt: billingActionFailures.resolvedAt,
			createdAt: billingActionFailures.createdAt,
		})
		.from(billingActionFailures);
	const listFiltered = whereSql ? listBase.where(whereSql) : listBase;
	const rows = await listFiltered.orderBy(desc(billingActionFailures.createdAt)).limit(pageSize).offset(offset);

	const countBase = db.select({ total: count() }).from(billingActionFailures);
	const countFiltered = whereSql ? countBase.where(whereSql) : countBase;
	const [{ total: totalRaw }] = await countFiltered;
	const total = Number(totalRaw ?? 0);

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const qs = (p: number) => {
		const u = new URLSearchParams();
		if (kind) u.set("kind", kind);
		if (resolved) u.set("resolved", resolved);
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
					{ label: "Action failures" },
				]}
				title="Billing action failures"
				description="Non-fatal side-effect failures (coupon redemption, email, partial sync). Retry executes the original handler with the row's saved context."
			/>

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex w-44 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="af-kind">
						Kind
					</label>
					<select
						id="af-kind"
						name="kind"
						defaultValue={kind ?? ""}
						className="h-9 rounded-md border border-input bg-background px-2 text-sm"
					>
						<option value="">Any</option>
						{Array.from(BILLING_ACTION_FAILURE_KIND_NAMES).map((k) => (
							<option key={k} value={k}>
								{k}
							</option>
						))}
					</select>
				</div>
				<div className="flex w-36 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="af-res">
						Resolved
					</label>
					<select
						id="af-res"
						name="resolved"
						defaultValue={resolved ?? ""}
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
							<th className="px-3 py-2">Created</th>
							<th className="px-3 py-2">Kind</th>
							<th className="px-3 py-2">Profile</th>
							<th className="px-3 py-2">Coupon</th>
							<th className="px-3 py-2">Error</th>
							<th className="px-3 py-2">Retries</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 text-muted-foreground">
									{formatDateTimeMediumShortInAppTimeZone(r.createdAt)}
								</td>
								<td className="px-3 py-2">{r.kind}</td>
								<td className="px-3 py-2">
									{r.profileId ?
										<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/users/${r.profileId}`}>
											{r.profileId.slice(0, 8)}…
										</Link>
									:	"—"}
								</td>
								<td className="px-3 py-2">{r.couponId ? r.couponId.slice(0, 8) + "…" : "—"}</td>
								<td className="max-w-md truncate px-3 py-2 text-muted-foreground" title={r.errorMessage}>
									{r.errorMessage}
								</td>
								<td className="px-3 py-2 tabular-nums">{r.retryCount}</td>
								<td className="px-3 py-2">{r.resolvedAt ? "resolved" : "open"}</td>
								<td className="px-3 py-2">
									{!r.resolvedAt ? <ActionFailureRetryButton failureId={r.id} /> : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No rows.</p> : null}
			</div>

			{totalPages > 1 ?
				<nav className="flex gap-2 text-sm">
					{page > 1 ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/action-failures${qs(page - 1)}`}>
							Previous
						</Link>
					:	null}
					<span className="text-muted-foreground">
						Page {page} / {totalPages}
					</span>
					{page < totalPages ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/action-failures${qs(page + 1)}`}>
							Next
						</Link>
					:	null}
				</nav>
			:	null}
		</div>
	);
}
