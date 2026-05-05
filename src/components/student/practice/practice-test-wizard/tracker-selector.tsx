"use client";

import { ChevronDownIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ChapterGroup } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

import {
	IndeterminateCheckbox,
	formatLastTest,
	formatScore,
	performanceStatusBadgeClass,
	selectionFlagsForIds,
	statusBadgeVariant,
	statusLabel,
	statusRowAccentClass,
	trackerIdsForChapter,
	trendIcon,
	trendLabel,
} from "./helpers";
import { practiceTopicMatrixCheckCircleClass } from "./types";

export type ChapterSection = {
	sectionKey: string;
	unitName: string;
	chapter: ChapterGroup;
};

export type TrackerSelectorProps = {
	practiceChapterSections: ChapterSection[];
	selectedTrackerIds: Set<string>;
	chapterOpenMode: "initial" | "all" | "none";
	chapterVersion: number;
	bulkSelectTrackers: (trackerIds: string[], shouldSelect: boolean) => void;
	toggleTracker: (id: string) => void;
};

export function TrackerSelector({
	practiceChapterSections,
	selectedTrackerIds,
	chapterOpenMode,
	chapterVersion,
	bulkSelectTrackers,
	toggleTracker,
}: TrackerSelectorProps) {
	return (
		<div className="flex flex-col gap-2.5 p-2 medium:p-2.5">
			{practiceChapterSections.map(({ sectionKey, unitName, chapter }, ci) => {
				const chapterIds = trackerIdsForChapter(chapter);
				const chSel = selectionFlagsForIds(selectedTrackerIds, chapterIds);
				const selectedCountInChapter = chapterIds.reduce(
					(n, id) => (selectedTrackerIds.has(id) ? n + 1 : n),
					0,
				);
				const defaultOpen =
					chapterOpenMode === "all"
						? true
						: chapterOpenMode === "none"
							? false
							: ci === 0;
				return (
					<Collapsible
						key={`${sectionKey}-v${chapterVersion}`}
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
									disabled={chapterIds.length === 0}
									aria-label={`Select all topics in chapter ${chapter.chapterNumber}: ${chapter.chapterName}`}
									className={practiceTopicMatrixCheckCircleClass}
									onClick={(e) => e.stopPropagation()}
									onChange={(e) => {
										e.stopPropagation();
										bulkSelectTrackers(chapterIds, e.target.checked);
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
										className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/12 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-800 tabular-nums dark:bg-emerald-500/15 dark:text-emerald-300"
										aria-label={`${selectedCountInChapter} selected in this chapter`}
									>
										<span
											aria-hidden
											className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
										/>
										{selectedCountInChapter} selected
									</span>
								) : null}
								<span className="font-mono text-muted-foreground text-[11px] tabular-nums">
									{chapter.rows.length} topics
								</span>
							</CollapsibleTrigger>
						</div>
						<CollapsibleContent className="p-3 medium:p-3.5">
							<div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/90 bg-background/70 p-3 shadow-sm dark:bg-background/50">
								<table className="w-full min-w-[42rem] text-sm">
									<caption className="sr-only">
										Topics for Chapter {chapter.chapterNumber}: {chapter.chapterName}. Syllabus unit:{" "}
										{unitName}.
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
										{chapter.rows.map((row) => {
											const checked = selectedTrackerIds.has(row.trackerId);
											return (
												<tr
													key={row.trackerId}
													className={cn(
														"border-border border-s-4 border-b last:border-b-0",
														statusRowAccentClass(row.status),
														"cursor-pointer hover:bg-muted/35",
													)}
													onClick={() => {
														toggleTracker(row.trackerId);
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															toggleTracker(row.trackerId);
														}
													}}
													tabIndex={0}
													title={`${row.subjectName} — ${statusLabel(row.status)}. Average ${formatScore(row.averageScore)}, ${row.testsTaken} tests taken.`}
												>
													<td
														className="px-2 py-2.5 align-middle"
														onClick={(e) => e.stopPropagation()}
													>
														<input
															type="checkbox"
															checked={checked}
															aria-label={`Select ${row.topicName}`}
															className={practiceTopicMatrixCheckCircleClass}
															onChange={() => toggleTracker(row.trackerId)}
														/>
													</td>
													<th
														scope="row"
														className="max-w-[20rem] px-3 py-2.5 text-start align-middle text-sm text-foreground/95 leading-snug font-normal medium:text-[15px]"
													>
														{row.topicName}
													</th>
													<td className="px-3 py-2.5 align-middle">
														<div className="flex flex-wrap items-center gap-1.5">
															<Badge
																variant={statusBadgeVariant(row.status)}
																className={performanceStatusBadgeClass(row.status)}
															>
																{statusLabel(row.status)}
															</Badge>
															{row.averageScore != null ? (
																<span className="text-muted-foreground text-xs tabular-nums">
																	Avg {Math.round(row.averageScore)}%
																</span>
															) : null}
														</div>
													</td>
													<td className="px-3 py-2.5 align-middle">
														<div className="flex flex-col gap-0.5">
															<span className="font-semibold text-foreground text-xl tabular-nums tracking-tight leading-none">
																{row.testsTaken}
															</span>
															<span className="text-[11px] text-muted-foreground leading-tight">
																{row.testsTaken === 1 ? "test" : "tests"}
															</span>
														</div>
													</td>
													<td className="px-3 py-2.5 align-middle font-mono text-muted-foreground text-xs tabular-nums">
														{formatLastTest(row.lastTestDate)}
													</td>
													<td className="px-3 py-2.5 align-middle">
														<span className="inline-flex items-center gap-1.5">
															{trendIcon(row)}
															<span className="text-muted-foreground text-xs">
																{trendLabel(row.trend)}
															</span>
														</span>
													</td>
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
	);
}
