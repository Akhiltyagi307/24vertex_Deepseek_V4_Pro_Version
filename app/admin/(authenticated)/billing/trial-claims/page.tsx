import { count, desc, isNotNull, isNull } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminTrialClaimsActions } from "@/components/admin/billing/admin-trial-claims-actions";
import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { freeTrialClaims } from "@/db/schema/billing";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin · Billing · Trial claims",
	robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ page?: string; released?: string }> };

export default async function AdminTrialClaimsPage({ searchParams }: Props) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 40;
	const offset = (page - 1) * pageSize;
	const released = sp.released?.trim();

	const whereClause =
		released === "1" ? isNotNull(freeTrialClaims.releasedAt)
		: released === "0" ? isNull(freeTrialClaims.releasedAt)
		: undefined;

	const listBase = db.select().from(freeTrialClaims);
	const listFiltered = whereClause ? listBase.where(whereClause) : listBase;
	const rows = await listFiltered.orderBy(desc(freeTrialClaims.claimedAt)).limit(pageSize).offset(offset);

	const countBase = db.select({ total: count() }).from(freeTrialClaims);
	const countFiltered = whereClause ? countBase.where(whereClause) : countBase;
	const [{ total: totalRaw }] = await countFiltered;
	const total = Number(totalRaw ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const qs = (p: number) => {
		const u = new URLSearchParams();
		if (released) u.set("released", released);
		if (p > 1) u.set("page", String(p));
		const s = u.toString();
		return s ? `?${s}` : "";
	};

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Billing", href: "/admin/billing/plans" },
					{ label: "Trial claims" },
				]}
				title="Free trial claims"
				description="One row per normalized identity. Release to allow a new claim; block adds an identity to the deny list."
			/>

			<AdminTrialClaimsActions />

			<form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
				<div className="flex w-44 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="tc-rel">
						Released
					</label>
					<select id="tc-rel" name="released" defaultValue={released ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
						<option value="">Any</option>
						<option value="0">Active lock</option>
						<option value="1">Released</option>
					</select>
				</div>
				<button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
					Apply
				</button>
			</form>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.billingTrialClaims}
					filenameBase="billing-trial-claims"
					headers={["identity_key", "first_profile_id", "claimed_at", "released_at", "released_by"]}
					rows={rows.map((r) => ({
						identity_key: r.identityKey,
						first_profile_id: r.firstProfileId,
						claimed_at: r.claimedAt.toISOString(),
						released_at: r.releasedAt?.toISOString() ?? "",
						released_by: r.releasedBy ?? "",
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-3 py-2">Identity</th>
							<th className="px-3 py-2">First profile</th>
							<th className="px-3 py-2">Claimed</th>
							<th className="px-3 py-2">Released</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.identityKey} className="border-b border-border/80">
								<td className="max-w-xs truncate px-3 py-2 font-mono text-xs">{r.identityKey}</td>
								<td className="px-3 py-2 font-mono text-xs">{r.firstProfileId}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.claimedAt.toISOString().slice(0, 10)}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.releasedAt ? r.releasedAt.toISOString().slice(0, 10) : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No rows.</p> : null}
			</div>

			{totalPages > 1 ?
				<nav className="flex gap-2 text-sm">
					{page > 1 ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/trial-claims${qs(page - 1)}`}>
							Previous
						</Link>
					:	null}
					<span className="text-muted-foreground">
						Page {page} / {totalPages}
					</span>
					{page < totalPages ?
						<Link className="text-primary underline-offset-4 hover:underline" href={`/admin/billing/trial-claims${qs(page + 1)}`}>
							Next
						</Link>
					:	null}
				</nav>
			:	null}
		</div>
	);
}
