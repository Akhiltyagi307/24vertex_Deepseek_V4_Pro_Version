import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminKpiCard } from "@/components/admin/dashboard/kpi-card";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { formatRelativeTime } from "@/components/student/notifications/relative-time";
import { getContextChunkStats, listRecentContextChunks } from "@/lib/admin/context-chunk-coverage";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

export const metadata = {
	title: "Context chunks · EduAI Admin",
	robots: { index: false, follow: false },
};

const RECENT_LIMIT = 50;

function pct(numerator: number, denominator: number): string {
	if (denominator <= 0) return "—";
	const value = (numerator / denominator) * 100;
	return `${value.toFixed(value >= 99.95 || value < 1 ? 1 : 0)}%`;
}

export default async function AdminContextChunksPage() {
	const [stats, recent] = await Promise.all([getContextChunkStats(), listRecentContextChunks(RECENT_LIMIT)]);

	const coveragePct = pct(stats.distinctTopics, stats.activeTopics);
	const embeddingsPct = pct(stats.embeddedCount, stats.totalChunks);
	const lastIngestedLabel = stats.lastIngestedAt ? formatRelativeTime(stats.lastIngestedAt) : "never";

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Context chunks" },
				]}
				title="Context chunks"
				description="RAG grounding for topic-aware practice generation. Snapshot of coverage and recent ingestion."
			/>

			<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-4">
				<AdminKpiCard label="Total chunks" value={stats.totalChunks.toLocaleString()} />
				<AdminKpiCard
					label="Topic coverage"
					value={coveragePct}
					hint={`${stats.distinctTopics.toLocaleString()} of ${stats.activeTopics.toLocaleString()} active topics`}
				/>
				<AdminKpiCard
					label="Embeddings ready"
					value={embeddingsPct}
					hint={`${stats.embeddedCount.toLocaleString()} of ${stats.totalChunks.toLocaleString()} chunks`}
				/>
				<AdminKpiCard
					label="Last ingested"
					value={lastIngestedLabel}
					hint={
						stats.lastIngestedAt ?
							formatDateTimeMediumShortInAppTimeZone(stats.lastIngestedAt)
						:	"no data"
					}
				/>
			</div>

			<div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
				<span>
					Context: <strong className="tabular-nums text-foreground">{stats.contextCount.toLocaleString()}</strong>
				</span>
				<span>
					Exercise: <strong className="tabular-nums text-foreground">{stats.exerciseCount.toLocaleString()}</strong>
				</span>
			</div>

			<div className="flex flex-wrap gap-3 text-sm">
				<Link href="/admin/curriculum/context-chunks/tools" className="text-primary hover:underline">
					Coverage tools (zero-chunk topics)
				</Link>
				<span aria-hidden className="text-muted-foreground">
					·
				</span>
				<Link href="/admin/curriculum/import" className="text-primary hover:underline">
					CSV import
				</Link>
				<span aria-hidden className="text-muted-foreground">
					·
				</span>
				<Link href="/admin/curriculum/topics" className="text-primary hover:underline">
					Browse topics
				</Link>
			</div>

			<div className="space-y-3">
				<div className="flex items-end justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold">Recent chunks</h2>
						<p className="text-xs text-muted-foreground">Last {RECENT_LIMIT} by ingestion time.</p>
					</div>
				</div>
				<Suspense fallback={null}>
					<AdminServerRowsToolbar
						listId={ADMIN_LIST_ID.curriculumChunks}
						filenameBase="context-chunks-recent"
						headers={["id", "topic_id", "topic_name", "chunk_type", "source_ref", "has_embedding", "created_at"]}
						rows={recent.map((r) => ({
							id: r.id,
							topic_id: r.topic_id,
							topic_name: r.topic_name ?? "",
							chunk_type: r.chunk_type,
							source_ref: r.source_ref ?? "",
							has_embedding: r.has_embedding ? "yes" : "no",
							created_at: r.created_at,
						}))}
					/>
				</Suspense>
				{recent.length === 0 ?
					<p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
						No chunks yet. Use the API or the curriculum import page to add some.
					</p>
				:	<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full min-w-[860px] text-left text-sm">
							<thead className="border-b border-border bg-muted/40">
								<tr>
									<th className="px-3 py-2 font-medium">Topic</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium">Preview</th>
									<th className="px-3 py-2 font-medium">Source</th>
									<th className="px-3 py-2 font-medium">Embed</th>
									<th className="px-3 py-2 font-medium">Created</th>
								</tr>
							</thead>
							<tbody>
								{recent.map((r) => (
									<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
										<td className="px-3 py-2">
											<Link
												href={`/admin/curriculum/topics/${r.topic_id}`}
												className="text-primary underline-offset-4 hover:underline"
											>
												{r.topic_name ?? r.topic_id.slice(0, 8)}
											</Link>
										</td>
										<td className="px-3 py-2">
											<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r.chunk_type}</span>
										</td>
										<td className="max-w-md px-3 py-2 text-muted-foreground">
											<span className="line-clamp-2">{r.content_preview}</span>
										</td>
										<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
											{r.source_ref ?? "—"}
										</td>
										<td className="px-3 py-2 text-xs">{r.has_embedding ? "yes" : "no"}</td>
										<td className="px-3 py-2 font-mono text-xs text-muted-foreground" title={r.created_at}>
											{formatRelativeTime(r.created_at)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				}
			</div>

			<details className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
				<summary className="cursor-pointer font-medium text-foreground">API endpoints</summary>
				<ul className="mt-2 list-inside list-disc space-y-1">
					<li>
						List: <code className="text-foreground">GET /api/admin/context-chunks?topic_id=…</code>
					</li>
					<li>
						Create: <code className="text-foreground">POST /api/admin/context-chunks</code> with{" "}
						<code className="text-foreground">{`{ topic_id, content, chunk_type, source_ref?, metadata? }`}</code>
					</li>
					<li>
						Update: <code className="text-foreground">PATCH /api/admin/context-chunks/[id]</code>
					</li>
					<li>
						Delete: <code className="text-foreground">DELETE /api/admin/context-chunks/[id]</code>
					</li>
				</ul>
			</details>
		</div>
	);
}
