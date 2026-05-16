"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
	IndeterminateCheckbox,
	selectionFlagsForIds,
} from "@/components/student/practice/practice-test-wizard/helpers";
import {
	practiceTopicMatrixCheckCircleClass,
	practiceTopicMatrixSurfaceClass,
} from "@/components/student/practice/practice-test-wizard/types";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ChapterBucket = {
	sectionKey: string;
	unitName: string;
	unitNumber: number;
	chapterNumber: number;
	chapterName: string;
	topics: AssignmentTopicCatalogRow[];
};

function bucketTopics(rows: AssignmentTopicCatalogRow[]): ChapterBucket[] {
	const byKey = new Map<string, ChapterBucket>();
	for (const row of rows) {
		const key = `${row.unitNumber}:${row.chapterNumber}`;
		const existing = byKey.get(key);
		if (existing) {
			existing.topics.push(row);
		} else {
			byKey.set(key, {
				sectionKey: key,
				unitName: row.unitName,
				unitNumber: row.unitNumber,
				chapterNumber: row.chapterNumber,
				chapterName: row.chapterName,
				topics: [row],
			});
		}
	}
	return [...byKey.values()]
		.sort((a, b) => a.unitNumber - b.unitNumber || a.chapterNumber - b.chapterNumber)
		.map((chapter) => ({
			...chapter,
			topics: [...chapter.topics].sort((a, b) => a.topicNumber - b.topicNumber),
		}));
}

type Props = {
	topics: AssignmentTopicCatalogRow[];
	subjectId: string;
	selectedTopicIds: Set<string>;
	onSelectedTopicIdsChange: React.Dispatch<React.SetStateAction<Set<string>>>;
	chapterVersion: number;
};

export function TeacherAssignmentTopicMatrix({
	topics,
	subjectId,
	selectedTopicIds,
	onSelectedTopicIdsChange,
	chapterVersion,
}: Props) {
	const chapters = React.useMemo(() => bucketTopics(topics), [topics]);

	const topicIdsForChapter = React.useCallback((chapter: ChapterBucket) => chapter.topics.map((t) => t.id), []);

	const bulkSelect = React.useCallback(
		(ids: string[], select: boolean) => {
			onSelectedTopicIdsChange((prev) => {
				const next = new Set(prev);
				for (const id of ids) {
					if (select) next.add(id);
					else next.delete(id);
				}
				return next;
			});
		},
		[onSelectedTopicIdsChange],
	);

	const toggleTopic = React.useCallback((id: string) => {
		onSelectedTopicIdsChange((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, [onSelectedTopicIdsChange]);

	if (topics.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No active topics found for this subject.</p>
		);
	}

	return (
		<div className={cn("rounded-lg", practiceTopicMatrixSurfaceClass)}>
			<div className="flex flex-col gap-2.5 p-2 medium:p-2.5">
				{chapters.map((chapter, ci) => {
					const ids = topicIdsForChapter(chapter);
					const chSel = selectionFlagsForIds(selectedTopicIds, ids);
					const selectedCountInChapter = ids.reduce((n, id) => (selectedTopicIds.has(id) ? n + 1 : n), 0);
					const defaultOpen = ci === 0;
					return (
						<Collapsible
							key={`${chapter.sectionKey}-${subjectId}-v${chapterVersion}`}
							defaultOpen={defaultOpen}
							className="rounded-lg border border-border/80 bg-muted/20 dark:bg-muted/10"
						>
							<div className="flex w-full items-center gap-1.5 px-3 medium:px-3.5">
								<div
									className="flex shrink-0 items-center"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<IndeterminateCheckbox
										checked={chSel.all}
										indeterminate={chSel.some}
										disabled={ids.length === 0}
										aria-label={`Select all topics in chapter ${chapter.chapterNumber}: ${chapter.chapterName}`}
										className={practiceTopicMatrixCheckCircleClass}
										onClick={(e) => e.stopPropagation()}
										onChange={(e) => {
											e.stopPropagation();
											bulkSelect(ids, e.target.checked);
										}}
									/>
								</div>
								<CollapsibleTrigger
									className={cn(
										"group flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-3.5 text-left outline-none transition-colors",
										"hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
									)}
								>
									<ChevronDownIcon
										className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
										aria-hidden
									/>
									<span className="min-w-0 flex-1 truncate text-base font-bold leading-snug tracking-tight text-foreground medium:text-lg">
										Chapter {chapter.chapterNumber}: {chapter.chapterName}
									</span>
									{selectedCountInChapter > 0 ? (
										<span
											className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 font-mono text-[11px] font-medium text-primary tabular-nums dark:bg-primary/18"
											aria-label={`${selectedCountInChapter} selected in this chapter`}
										>
											<span aria-hidden className="size-1.5 rounded-full bg-primary" />
											{selectedCountInChapter} selected
										</span>
									) : null}
									<span className="font-mono text-muted-foreground text-[11px] tabular-nums">
										{chapter.topics.length} topics
									</span>
								</CollapsibleTrigger>
							</div>
							<CollapsibleContent className="p-3 medium:p-3.5">
								<div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/90 bg-background/70 p-3 shadow-sm dark:bg-background/50">
									<table className="w-full min-w-[42rem] text-sm">
										<caption className="sr-only">
											Topics for Chapter {chapter.chapterNumber}: {chapter.chapterName}. Syllabus unit:{" "}
											{chapter.unitName}.
										</caption>
										<thead>
											<tr className="border-border border-b bg-muted/40 text-left">
												<th
													scope="col"
													className="w-10 px-2 py-2.5 font-mono text-muted-foreground text-xs uppercase tracking-wider"
												>
													<span className="sr-only">Select topic</span>
												</th>
												<th
													scope="col"
													className="min-w-[12rem] px-3 py-2.5 text-start font-medium text-foreground text-xs"
												>
													Topic
												</th>
												<th
													scope="col"
													className="min-w-[10.5rem] px-3 py-2.5 font-medium text-foreground text-xs"
												>
													Performance
												</th>
												<th
													scope="col"
													className="min-w-[5.5rem] px-3 py-2.5 font-medium text-foreground text-xs"
												>
													Tests taken
												</th>
												<th
													scope="col"
													className="min-w-[7rem] px-3 py-2.5 font-medium text-muted-foreground text-xs"
												>
													Last test
												</th>
												<th
													scope="col"
													className="min-w-[6.5rem] px-3 py-2.5 font-medium text-muted-foreground text-xs"
												>
													Trend
												</th>
											</tr>
										</thead>
										<tbody>
											{chapter.topics.map((topic) => {
												const checked = selectedTopicIds.has(topic.id);
												return (
													<tr
														key={topic.id}
														className={cn(
															"border-border border-s-4 border-s-muted-foreground/35 border-b last:border-b-0",
															"cursor-pointer hover:bg-muted/35",
														)}
														onClick={() => {
															toggleTopic(topic.id);
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.preventDefault();
																toggleTopic(topic.id);
															}
														}}
														tabIndex={0}
													>
														<td className="px-2 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
															<input
																type="checkbox"
																checked={checked}
																aria-label={`Select ${topic.topicName}`}
																className={practiceTopicMatrixCheckCircleClass}
																onChange={() => toggleTopic(topic.id)}
															/>
														</td>
														<th
															scope="row"
															className="max-w-[20rem] px-3 py-2.5 text-start align-middle text-sm text-foreground/95 leading-snug font-normal medium:text-[15px]"
														>
															<span className="block">{topic.topicName}</span>
															<span className="mt-0.5 block text-muted-foreground text-xs font-normal leading-snug">
																{topic.unitName} · {chapter.chapterName}
															</span>
														</th>
														<td className="px-3 py-2.5 align-middle text-muted-foreground text-xs">—</td>
														<td className="px-3 py-2.5 align-middle text-muted-foreground text-xs">—</td>
														<td className="px-3 py-2.5 align-middle font-mono text-muted-foreground text-xs tabular-nums">
															—
														</td>
														<td className="px-3 py-2.5 align-middle text-muted-foreground text-xs">—</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</CollapsibleContent>
						</Collapsible>
					);
				})}
			</div>
		</div>
	);
}
