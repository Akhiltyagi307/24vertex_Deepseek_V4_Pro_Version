"use client";

import { useMemo, useState } from "react";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { parseCsvWithHeader } from "@/lib/admin/import/csv-parser";
import { previewTopicCsvDiff } from "@/lib/admin/import/diff-preview";

export const metadata = {
	title: "Curriculum import · EduAI Admin",
	robots: { index: false, follow: false },
};


export default function AdminCurriculumImportPage() {
	const [tab, setTab] = useState<"subjects" | "topics" | "chunks">("topics");
	const [raw, setRaw] = useState("");
	const [preview, setPreview] = useState<string>("");

	const runPreview = () => {
		const { rows, errors } = parseCsvWithHeader<Record<string, string>>(raw);
		if (errors.length) {
			setPreview(errors.join("\n"));
			return;
		}
		if (tab === "topics") {
			const existing = new Map<string, Record<string, string>>();
			const diff = previewTopicCsvDiff("topic_id", rows, existing);
			const counts = diff.reduce(
				(acc, d) => {
					acc[d.action] += 1;
					return acc;
				},
				{ insert: 0, update: 0, skip: 0 },
			);
			setPreview(JSON.stringify({ counts, sample: diff.slice(0, 20) }, null, 2));
			return;
		}
		setPreview(JSON.stringify({ row_count: rows.length }, null, 2));
	};

	const title = useMemo(() => {
		if (tab === "subjects") return "Import subjects (CSV)";
		if (tab === "chunks") return "Import context chunks (CSV)";
		return "Import topics (CSV)";
	}, [tab]);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Import" },
				]}
				title="Curriculum CSV import"
				description="Paste CSV with headers. Preview uses diff-preview (topics keyed by topic_id)."
			/>
			<div className="flex flex-wrap justify-end gap-2">
				<AdminSavedViews listId={ADMIN_LIST_ID.curriculumImport} />
				<AdminExportButton
					filenameBase="curriculum-import-preview"
					headers={["preview_json"]}
					rows={preview ? [{ preview_json: preview }] : []}
					disabled={!preview}
				/>
			</div>
			<div className="flex gap-2 text-sm">
				<button
					type="button"
					className={`rounded-md border px-3 py-1 ${tab === "subjects" ? "border-primary" : "border-border"}`}
					onClick={() => setTab("subjects")}
				>
					Subjects
				</button>
				<button
					type="button"
					className={`rounded-md border px-3 py-1 ${tab === "topics" ? "border-primary" : "border-border"}`}
					onClick={() => setTab("topics")}
				>
					Topics
				</button>
				<button
					type="button"
					className={`rounded-md border px-3 py-1 ${tab === "chunks" ? "border-primary" : "border-border"}`}
					onClick={() => setTab("chunks")}
				>
					Context chunks
				</button>
			</div>
			<div>
				<h2 className="text-sm font-medium">{title}</h2>
				<textarea
					className="mt-2 min-h-[200px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
					value={raw}
					onChange={(e) => setRaw(e.target.value)}
					placeholder="topic_id,name\n..."
				/>
				<button type="button" className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={runPreview}>
					Preview diff
				</button>
			</div>
			{preview ?
				<pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{preview}</pre>
			:	null}
		</div>
	);
}
