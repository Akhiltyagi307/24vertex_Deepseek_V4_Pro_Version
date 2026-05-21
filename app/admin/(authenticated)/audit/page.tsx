import { and, desc, eq, ilike } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { db } from "@/db";
import { adminActionLog } from "@/db/schema/admin-action-log";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Admin audit · 24Vertex",
	robots: { index: false, follow: false },
};

const PAGE = 80;

export default async function AdminAuditPage({
	searchParams,
}: {
	searchParams: Promise<{ targetId?: string; targetType?: string; action?: string }>;
}) {
	const sp = await searchParams;
	const targetId = sp.targetId?.trim();
	const targetType = sp.targetType?.trim();
	const actionRaw = sp.action?.trim();

	const conditions = [];
	if (targetId) conditions.push(eq(adminActionLog.targetId, targetId));
	if (targetType) conditions.push(eq(adminActionLog.targetType, targetType));
	if (actionRaw) {
		const actionClean = actionRaw.replace(/[%_\\]/g, "").slice(0, 80);
		if (actionClean) conditions.push(ilike(adminActionLog.action, `%${actionClean}%`));
	}
	const whereClause = conditions.length ? and(...conditions) : undefined;

	const base = db
		.select({
			id: adminActionLog.id,
			action: adminActionLog.action,
			targetType: adminActionLog.targetType,
			targetId: adminActionLog.targetId,
			payload: adminActionLog.payload,
			createdAt: adminActionLog.createdAt,
		})
		.from(adminActionLog);

	const rows = await (whereClause ? base.where(whereClause) : base).orderBy(desc(adminActionLog.id)).limit(PAGE);

	const qs = new URLSearchParams();
	if (targetId) qs.set("targetId", targetId);
	if (targetType) qs.set("targetType", targetType);
	if (actionRaw) qs.set("action", actionRaw);
	const qsStr = qs.toString();
	const clearHref = "/admin/audit";

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
				<p className="text-sm text-muted-foreground">Append-only operator actions (read-only).</p>
			</div>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.auditLog}
					filenameBase="admin-audit"
					headers={["id", "action", "target_type", "target_id", "created_at"]}
					rows={rows.map((r) => ({
						id: String(r.id),
						action: r.action,
						target_type: r.targetType ?? "",
						target_id: r.targetId ?? "",
						created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
					}))}
				/>
			</Suspense>

			<form className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3" action="/admin/audit" method="get">
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					target_id
					<input
						name="targetId"
						defaultValue={targetId ?? ""}
						placeholder="UUID"
						className="min-w-[220px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					target_type
					<input
						name="targetType"
						defaultValue={targetType ?? ""}
						placeholder="e.g. user"
						className="min-w-[140px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs text-muted-foreground">
					action contains
					<input
						name="action"
						defaultValue={actionRaw ?? ""}
						placeholder="substring"
						className="min-w-[160px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
					/>
				</label>
				<button
					type="submit"
					className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/80"
				>
					Apply
				</button>
			</form>

			<div className="flex flex-wrap items-center gap-3 text-sm">
				{targetId || targetType || actionRaw ?
					<span className="text-muted-foreground">
						Filtered
						{targetId ? ` · target_id=${targetId}` : ""}
						{targetType ? ` · target_type=${targetType}` : ""}
						{actionRaw ? ` · action contains ${actionRaw}` : ""}
					</span>
				:	<span className="text-muted-foreground">Latest {PAGE} entries (no filter).</span>}
				{qsStr ?
					<Link href={clearHref} className="font-medium text-primary underline-offset-4 hover:underline">
						Clear filters
					</Link>
				:	null}
			</div>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">ID</th>
							<th className="px-3 py-2 font-medium">Action</th>
							<th className="px-3 py-2 font-medium">Target</th>
							<th className="px-3 py-2 font-medium">When</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80 last:border-0">
								<td className="px-3 py-2 font-mono text-xs">{r.id}</td>
								<td className="px-3 py-2">{r.action}</td>
								<td className="px-3 py-2 text-muted-foreground">
									{r.targetType ?? "—"}
									{r.targetId ? ` · ${r.targetId}` : ""}
								</td>
								<td className="px-3 py-2 text-muted-foreground">
									{r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? "")}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
