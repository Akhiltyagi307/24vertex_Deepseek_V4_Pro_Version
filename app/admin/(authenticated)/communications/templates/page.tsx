import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Email templates · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminEmailTemplatesPage() {
	const slugRows = await db
		.select({
			slug: emailTemplates.slug,
			activeVersion: sql<number>`max(case when ${emailTemplates.isActive} then ${emailTemplates.version} end)`,
			maxVersion: sql<number>`max(${emailTemplates.version})`,
		})
		.from(emailTemplates)
		.groupBy(emailTemplates.slug)
		.orderBy(emailTemplates.slug);

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Email templates</h1>
				<p className="text-sm text-muted-foreground">
					DB-backed MJML versions override built-in HTML when active. Use the API or SQL to seed rows.
				</p>
			</div>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.communicationsTemplates}
					filenameBase="email-templates"
					headers={["slug", "active_version", "latest_version"]}
					rows={slugRows.map((r) => ({
						slug: r.slug,
						active_version: r.activeVersion ?? "",
						latest_version: r.maxVersion ?? "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[560px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Slug</th>
							<th className="px-3 py-2 font-medium">Active ver.</th>
							<th className="px-3 py-2 font-medium">Latest ver.</th>
							<th className="px-3 py-2 font-medium" />
						</tr>
					</thead>
					<tbody>
						{slugRows.map((r) => (
							<tr key={r.slug} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.slug}</td>
								<td className="px-3 py-2">{r.activeVersion ?? "—"}</td>
								<td className="px-3 py-2">{r.maxVersion ?? "—"}</td>
								<td className="px-3 py-2">
									<Link className="text-primary underline" href={`/admin/communications/templates/${encodeURIComponent(r.slug)}`}>
										Versions
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{slugRows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No templates in DB yet.</p>
				:	null}
			</div>
		</div>
	);
}
