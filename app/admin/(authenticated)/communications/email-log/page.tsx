import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { emailLog } from "@/db/schema/comms-audit";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Email log · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminEmailLogPage() {
	const rows = await db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(100);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Email log</h1>
					<p className="text-sm text-muted-foreground">Resend sends mirrored from transactional mail.</p>
				</div>
				<Link className="text-sm text-primary underline" href="/admin/communications/email-log/suppressions">
					Suppressions
				</Link>
			</div>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.communicationsEmailLog}
					filenameBase="email-log"
					headers={["id", "recipient_email", "subject", "template", "status", "created_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						recipient_email: r.recipientEmail,
						subject: r.subject,
						template: r.template ?? "",
						status: r.status,
						created_at: r.createdAt?.toISOString?.() ?? "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[800px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">To</th>
							<th className="px-3 py-2 font-medium">Subject</th>
							<th className="px-3 py-2 font-medium">Template</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">When</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.recipientEmail}</td>
								<td className="px-3 py-2">{r.subject}</td>
								<td className="px-3 py-2">{r.template ?? "—"}</td>
								<td className="px-3 py-2">{r.status}</td>
								<td className="px-3 py-2 text-muted-foreground">{r.createdAt?.toISOString?.() ?? ""}</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No rows yet — trigger any transactional email.</p>
				:	null}
			</div>
		</div>
	);
}
