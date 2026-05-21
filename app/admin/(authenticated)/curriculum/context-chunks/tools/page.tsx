import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { listTopicsWithZeroContextChunks } from "@/lib/admin/context-chunk-coverage";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Context chunk tools · 24Vertex Admin",
	robots: { index: false, follow: false },
};


export default async function AdminContextChunkToolsPage() {
	const rows = await listTopicsWithZeroContextChunks();

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Context chunks", href: "/admin/curriculum/context-chunks" },
					{ label: "Tools" },
				]}
				title="Context chunk tools"
				description="Topics with zero context chunks (practice generation soft-fails when empty)."
			/>
			<p className="text-sm text-muted-foreground">Showing up to 500 rows.</p>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.curriculumChunkTools}
					filenameBase="context-chunk-zero-topics"
					headers={["topic_id", "topic_name", "subject_id", "grade"]}
					rows={rows.map((r) => ({
						topic_id: r.topic_id,
						topic_name: r.topic_name ?? "",
						subject_id: r.subject_id ?? "",
						grade: r.grade ?? "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40">
						<tr>
							<th className="px-3 py-2 text-left">Topic</th>
							<th className="px-3 py-2 text-left">Subject id</th>
							<th className="px-3 py-2 text-left">Grade</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.topic_id} className="border-t border-border">
								<td className="px-3 py-2">{r.topic_name ?? "—"}</td>
								<td className="px-3 py-2 font-mono text-xs">{r.subject_id ?? "—"}</td>
								<td className="px-3 py-2 tabular-nums">{r.grade ?? "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="text-sm">
				<Link href="/admin/curriculum/import" className="text-primary hover:underline">
					CSV import
				</Link>
			</p>
		</div>
	);
}
