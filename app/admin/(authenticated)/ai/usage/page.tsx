import { and, desc, gte, sql } from "drizzle-orm";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "AI usage · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAiUsagePage() {
	const since = new Date();
	since.setDate(since.getDate() - 14);

	const byFeature = await db
		.select({
			feature: aiCalls.feature,
			n: sql<number>`count(*)::int`,
			inSum: sql<number>`sum(${aiCalls.inputTokens})::bigint`,
			outSum: sql<number>`sum(${aiCalls.outputTokens})::bigint`,
		})
		.from(aiCalls)
		.where(and(gte(aiCalls.createdAt, since)))
		.groupBy(aiCalls.feature);

	const recent = await db.select().from(aiCalls).orderBy(desc(aiCalls.createdAt)).limit(40);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">AI usage</h1>
				<p className="text-sm text-muted-foreground">Last 14 days rollups from `ai_calls`.</p>
			</div>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.aiUsage}
					filenameBase="ai-usage-recent"
					headers={["id", "feature", "model", "input_tokens", "output_tokens", "status", "created_at"]}
					rows={recent.map((r) => ({
						id: r.id,
						feature: r.feature,
						model: r.model,
						input_tokens: r.inputTokens,
						output_tokens: r.outputTokens,
						status: r.status,
						created_at: r.createdAt?.toISOString?.() ?? "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[560px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Feature</th>
							<th className="px-3 py-2 font-medium">Calls</th>
							<th className="px-3 py-2 font-medium">In tok</th>
							<th className="px-3 py-2 font-medium">Out tok</th>
						</tr>
					</thead>
					<tbody>
						{byFeature.map((r) => (
							<tr key={r.feature} className="border-b border-border/80">
								<td className="px-3 py-2 font-mono text-xs">{r.feature}</td>
								<td className="px-3 py-2">{r.n}</td>
								<td className="px-3 py-2">{String(r.inSum)}</td>
								<td className="px-3 py-2">{String(r.outSum)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div>
				<h2 className="mb-2 text-lg font-medium">Recent calls</h2>
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[900px] text-xs">
						<thead className="border-b border-border bg-muted/40 text-left">
							<tr>
								<th className="px-2 py-2">Feature</th>
								<th className="px-2 py-2">Model</th>
								<th className="px-2 py-2">In</th>
								<th className="px-2 py-2">Out</th>
								<th className="px-2 py-2">Status</th>
								<th className="px-2 py-2">When</th>
							</tr>
						</thead>
						<tbody>
							{recent.map((r) => (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-2 py-1 font-mono">{r.feature}</td>
									<td className="px-2 py-1">{r.model}</td>
									<td className="px-2 py-1">{r.inputTokens}</td>
									<td className="px-2 py-1">{r.outputTokens}</td>
									<td className="px-2 py-1">{r.status}</td>
									<td className="px-2 py-1 text-muted-foreground">{r.createdAt?.toISOString?.()}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
