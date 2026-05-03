import { and, count, desc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { billingEvents } from "@/db/schema/billing";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Billing · Events",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; processed?: string; q?: string; event_type?: string }> };

export default async function AdminBillingEventsPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 40;
	const offset = (page - 1) * pageSize;
	const processed = sp.processed?.trim();
	const q = sp.q?.trim();
	const eventType = sp.event_type?.trim();

	const conditions: SQL[] = [];
	if (processed === "1") conditions.push(isNotNull(billingEvents.processedAt));
	if (processed === "0") conditions.push(isNull(billingEvents.processedAt));
	if (eventType) conditions.push(eq(billingEvents.eventType, eventType));
	if (q) {
		const pattern = `%${q.replace(/%/g, "\\%")}%`;
		conditions.push(or(ilike(billingEvents.razorpayEventId, pattern), ilike(billingEvents.eventType, pattern))!);
	}
	const whereSql = conditions.length ? and(...conditions) : undefined;

	const listBase = db
		.select({
			id: billingEvents.id,
			razorpayEventId: billingEvents.razorpayEventId,
			eventType: billingEvents.eventType,
			processedAt: billingEvents.processedAt,
			error: billingEvents.error,
			createdAt: billingEvents.createdAt,
			replayCount: billingEvents.replayCount,
			resolvedAt: billingEvents.resolvedAt,
		})
		.from(billingEvents);
	const listFiltered = whereSql ? listBase.where(whereSql) : listBase;
	const rows = await listFiltered.orderBy(desc(billingEvents.createdAt)).limit(pageSize).offset(offset);

	const countBase = db.select({ total: count() }).from(billingEvents);
	const countFiltered = whereSql ? countBase.where(whereSql) : countBase;
	const [{ total: totalRaw }] = await countFiltered;
	const total = Number(totalRaw ?? 0);

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const qs = (p: number) => {
		const u = new URLSearchParams();
		if (q) u.set("q", q);
		if (processed) u.set("processed", processed);
		if (eventType) u.set("event_type", eventType);
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
					{ label: "Webhook events" },
				]}
				title="Billing webhook events"
				description="Deduped Razorpay payloads. Replay re-runs the processor; resolve marks triage complete."
			/>

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex min-w-[10rem] flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="be-q">
						Search
					</label>
					<input
						id="be-q"
						name="q"
						type="search"
						defaultValue={q ?? ""}
						placeholder="event id / type"
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
					/>
				</div>
				<div className="flex w-36 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="be-proc">
						Processed
					</label>
					<select
						id="be-proc"
						name="processed"
						defaultValue={processed ?? ""}
						className="h-9 rounded-md border border-input bg-background px-2 text-sm"
					>
						<option value="">Any</option>
						<option value="1">Yes</option>
						<option value="0">No</option>
					</select>
				</div>
				<div className="flex min-w-[10rem] flex-1 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="be-type">
						Event type
					</label>
					<input
						id="be-type"
						name="event_type"
						type="text"
						defaultValue={eventType ?? ""}
						className="h-9 rounded-md border border-input bg-background px-3 text-sm"
					/>
				</div>
				<button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
					Apply
				</button>
			</form>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingEvents}
					filenameBase="billing-events"
					headers={["id", "event_type", "razorpay_event_id", "processed_at", "replay_count", "resolved_at", "created_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						event_type: r.eventType,
						razorpay_event_id: r.razorpayEventId ?? "",
						processed_at: r.processedAt?.toISOString() ?? "",
						replay_count: r.replayCount,
						resolved_at: r.resolvedAt?.toISOString() ?? "",
						created_at: r.createdAt.toISOString(),
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Created</th>
							<th className="px-3 py-2">Type</th>
							<th className="px-3 py-2">Processed</th>
							<th className="px-3 py-2">Replays</th>
							<th className="px-3 py-2">Error</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 text-muted-foreground">{r.createdAt.toISOString().slice(0, 19)}</td>
								<td className="px-3 py-2">
									<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/events/${r.id}`}>
										{r.eventType}
									</Link>
								</td>
								<td className="px-3 py-2">{r.processedAt ? "yes" : "no"}</td>
								<td className="px-3 py-2 tabular-nums">{r.replayCount}</td>
								<td className="max-w-xs truncate px-3 py-2 text-muted-foreground">{r.error ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No rows.</p> : null}
			</div>

			{totalPages > 1 ?
				<nav className="flex gap-2 text-sm">
					{page > 1 ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/events${qs(page - 1)}`}>
							Previous
						</Link>
					:	null}
					<span className="text-muted-foreground">
						Page {page} / {totalPages}
					</span>
					{page < totalPages ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/events${qs(page + 1)}`}>
							Next
						</Link>
					:	null}
				</nav>
			:	null}
		</div>
	);
}
