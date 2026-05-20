import Link from "next/link";

import { DeadlineBadge } from "@/components/admin/compliance/deadline-badge";

import type { ComplianceRow } from "./types";

interface ComplianceTabProps {
	dsrs: ComplianceRow[];
}

export function ComplianceTab({ dsrs }: ComplianceTabProps) {
	return (
		<div className="space-y-3 rounded-lg border border-border p-4 text-sm">
			<p className="text-muted-foreground">
				Data subject requests where this user is the subject.
			</p>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th scope="col" className="px-3 py-2 font-medium">
								Request
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Type
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Status
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Due
							</th>
						</tr>
					</thead>
					<tbody>
						{dsrs.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
									No DSRs for this user
								</td>
							</tr>
						) : (
							dsrs.map((r) => (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-3 py-2">
										<Link
											className="text-primary underline"
											href={`/admin/compliance/requests/${r.id}`}
										>
											{r.id.slice(0, 8)}…
										</Link>
									</td>
									<td className="px-3 py-2">{r.requestType}</td>
									<td className="px-3 py-2">{r.status}</td>
									<td className="px-3 py-2">
										<DeadlineBadge dueAt={r.dueAt} />
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<Link className="text-primary text-sm underline" href="/admin/compliance/requests">
				Open compliance queue
			</Link>
		</div>
	);
}
