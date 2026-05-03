import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "AI prompts · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAiPromptsPage() {
	const rows = await db.select().from(aiPrompts).orderBy(desc(aiPrompts.createdAt)).limit(200);

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">AI prompts</h1>
				<p className="text-sm text-muted-foreground">Versioned prompts — activate to override defaults where wired.</p>
			</div>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.aiPrompts}
					filenameBase="ai-prompts"
					headers={["id", "feature", "name", "version", "model", "is_active", "created_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						feature: r.feature,
						name: r.name,
						version: r.version,
						model: r.model,
						is_active: r.isActive,
						created_at: r.createdAt.toISOString(),
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[960px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Feature</th>
							<th className="px-3 py-2 font-medium">Ver</th>
							<th className="px-3 py-2 font-medium">Model</th>
							<th className="px-3 py-2 font-medium">Active</th>
							<th className="px-3 py-2 font-medium" />
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.feature}</td>
								<td className="px-3 py-2">{r.version}</td>
								<td className="px-3 py-2">{r.model}</td>
								<td className="px-3 py-2">{r.isActive ? "yes" : "no"}</td>
								<td className="px-3 py-2">
									<Link className="text-primary underline" href={`/admin/ai/prompts/${r.id}`}>
										Open
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ?
					<p className="px-3 py-6 text-sm text-muted-foreground">No prompts yet — POST /api/admin/ai/prompts</p>
				:	null}
			</div>
		</div>
	);
}
