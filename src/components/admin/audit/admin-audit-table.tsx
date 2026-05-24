import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

export type AdminAuditRow = {
	id: number;
	action: string;
	targetType: string | null;
	targetId: string | null;
	payload: unknown;
	createdAt: string;
};

export function AdminAuditTable({
	rows,
	emptyMessage,
	caption = "Recent admin actions",
}: {
	rows: AdminAuditRow[];
	emptyMessage?: string;
	caption?: string;
}) {
	if (rows.length === 0) {
		return <p className="text-sm text-muted-foreground">{emptyMessage ?? "No audit entries."}</p>;
	}

	return (
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full min-w-[720px] text-left text-sm">
				<caption className="sr-only">{caption}</caption>
				<thead className="border-b border-border bg-muted/40">
					<tr>
						<th className="px-3 py-2 font-medium">When</th>
						<th className="px-3 py-2 font-medium">Action</th>
						<th className="px-3 py-2 font-medium">Target</th>
						<th className="px-3 py-2 font-medium">Payload</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.id} className="border-b border-border/80 align-top">
							<td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
								{r.createdAt ?
									<time dateTime={r.createdAt} title={r.createdAt}>
										{formatDateTimeMediumShortInAppTimeZone(r.createdAt)}
									</time>
								:	"—"}
							</td>
							<td className="px-3 py-2 font-mono text-xs" title={r.action}>
								{r.action}
							</td>
							<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
								{r.targetType ?? "—"}
								{r.targetId ? ` · ${r.targetId.slice(0, 8)}…` : ""}
							</td>
							<td className="max-w-md px-3 py-2">
								<pre className="max-h-24 overflow-auto text-xs text-muted-foreground">
									{JSON.stringify(r.payload, null, 0)}
								</pre>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
