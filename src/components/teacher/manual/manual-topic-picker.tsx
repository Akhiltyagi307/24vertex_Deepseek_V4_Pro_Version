"use client";

import * as React from "react";

import { NativeSelect } from "@/components/ui/native-select";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import { cn } from "@/lib/utils";

type Props = {
	topics: AssignmentTopicCatalogRow[];
	value: string;
	onChange: (topicId: string) => void;
	className?: string;
	"aria-label"?: string;
};

type ChapterGroup = { key: string; label: string; topics: AssignmentTopicCatalogRow[] };

/** Group topics by (unit, chapter) and sort, mirroring TeacherAssignmentTopicMatrix bucketing. */
function groupByChapter(rows: AssignmentTopicCatalogRow[]): ChapterGroup[] {
	const byKey = new Map<string, ChapterGroup>();
	for (const row of rows) {
		const key = `${row.unitNumber}:${row.chapterNumber}`;
		let group = byKey.get(key);
		if (!group) {
			group = { key, label: `Ch ${row.chapterNumber}: ${row.chapterName}`, topics: [] };
			byKey.set(key, group);
		}
		group.topics.push(row);
	}
	const groups = [...byKey.values()];
	for (const g of groups) g.topics.sort((a, b) => a.topicNumber - b.topicNumber);
	groups.sort((a, b) => {
		const [au, ac] = a.key.split(":").map(Number);
		const [bu, bc] = b.key.split(":").map(Number);
		return au - bu || ac - bc;
	});
	return groups;
}

export function ManualTopicPicker({ topics, value, onChange, className, ...rest }: Props) {
	const groups = React.useMemo(() => groupByChapter(topics), [topics]);
	return (
		<NativeSelect
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className={cn("rounded-lg border border-input", className)}
			aria-label={rest["aria-label"] ?? "Chapter and topic"}
		>
			<option value="">Select chapter &amp; topic…</option>
			{groups.map((group) => (
				<optgroup key={group.key} label={group.label}>
					{group.topics.map((t) => (
						<option key={t.id} value={t.id}>
							{t.topicName}
						</option>
					))}
				</optgroup>
			))}
		</NativeSelect>
	);
}
