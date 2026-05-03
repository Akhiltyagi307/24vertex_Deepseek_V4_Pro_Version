import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { broadcasts } from "@/db/schema/broadcasts";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Broadcasts · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminBroadcastsPage() {
	const rows = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(100);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
					<p className="text-sm text-muted-foreground">Email + in-app announcements.</p>
				</div>
				<Link
					className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
					href="/admin/communications/broadcasts/compose"
				>
					Compose
				</Link>
			</div>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.communicationsBroadcasts}
					filenameBase="broadcasts"
					headers={["id", "subject", "status", "recipient_count", "created_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						subject: r.subject,
						status: r.status,
						recipient_count: r.recipientCount ?? "",
						created_at: r.createdAt?.toISOString?.() ?? "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[720px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Subject</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Recipients</th>
							<th className="px-3 py-2 font-medium">Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2">{r.subject}</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2">{r.recipientCount ?? "—"}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.createdAt?.toISOString?.() ?? ""}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No broadcasts yet.</p>
				:	null}
			</div>
		</div>
	);
}
