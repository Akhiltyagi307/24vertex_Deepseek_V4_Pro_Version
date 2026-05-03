import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";

export default function AdminContextChunksPage() {
	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Context chunks" },
				]}
				title="Context chunks"
				description="Use the API or Supabase for bulk edits. Coverage tooling lives under Tools."
			/>
			<p className="text-sm text-muted-foreground">
				Saved views and CSV export apply once a tabular list is wired here. Until then, use the API routes below.
			</p>
			<ul className="list-inside list-disc text-sm text-muted-foreground">
				<li>
					List chunks for a topic: <code className="text-foreground">GET /api/admin/context-chunks?topic_id=…</code>
				</li>
				<li>
					Create: <code className="text-foreground">POST /api/admin/context-chunks</code> with JSON body{" "}
					<code className="text-foreground">topic_id, content, chunk_type</code>
				</li>
				<li>
					<a className="text-primary hover:underline" href="/admin/curriculum/context-chunks/tools">
						Open tools (zero-chunk coverage)
					</a>
				</li>
			</ul>
		</div>
	);
}
