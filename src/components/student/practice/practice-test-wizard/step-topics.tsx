"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { forwardWheelToWizardStepScroll } from "./helpers";
import {
	type ChapterSection,
	TrackerSelector,
} from "./tracker-selector";
import { FOCUS_AREA_OPTIONS, type FocusArea, practiceTopicMatrixSurfaceClass } from "./types";

export type StepTopicsProps = {
	subjectName: string | null;
	canPickEnoughTopics: boolean;
	focusArea: FocusArea;
	selectedTrackerIds: Set<string>;
	practiceChapterSections: ChapterSection[];
	chapterOpenMode: "initial" | "all" | "none";
	chapterVersion: number;
	attemptedContinue: boolean;
	selectionOk: boolean;
	onPickFocusArea: (area: FocusArea) => void;
	onClearSelection: () => void;
	onExpandAll: () => void;
	onCollapseAll: () => void;
	bulkSelectTrackers: (trackerIds: string[], shouldSelect: boolean) => void;
	toggleTracker: (id: string) => void;
};

export function StepTopics({
	subjectName,
	canPickEnoughTopics,
	focusArea,
	selectedTrackerIds,
	practiceChapterSections,
	chapterOpenMode,
	chapterVersion,
	attemptedContinue,
	selectionOk,
	onPickFocusArea,
	onClearSelection,
	onExpandAll,
	onCollapseAll,
	bulkSelectTrackers,
	toggleTracker,
}: StepTopicsProps) {
	return (
		<div className={cn(cardSurfaceFrameClassName, "flex flex-col gap-6 p-5 medium:p-7")}>
			<div className="space-y-1.5 shrink-0">
				<h2 className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]">
					Topics
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
					Select the chapters or topics you want in this test for{" "}
					<span className="text-foreground font-medium">{subjectName}</span>. Need a refresher?{" "}
					<Link
						href="/student/performance"
						className="font-medium text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
					>
						Open your performance grid
						<span aria-hidden> →</span>
					</Link>
				</p>
			</div>
			{!canPickEnoughTopics ? (
				<Alert>
					<AlertTitle>Not enough topics</AlertTitle>
					<AlertDescription>
						This subject doesn&apos;t have topics in your tracker yet. Pick a different subject or reach out to
						support if the list should be there.
					</AlertDescription>
				</Alert>
			) : (
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2.5 shrink-0">
						<span className="font-mono text-muted-foreground text-[11.5px] font-medium uppercase tracking-[0.09em]">
							Quick pick
						</span>
						<div
							role="radiogroup"
							aria-label="Quick pick"
							className="flex flex-wrap items-center gap-1.5"
						>
							{FOCUS_AREA_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									role="radio"
									aria-checked={focusArea === opt.value}
									onClick={() => onPickFocusArea(opt.value)}
									className={cn(
										"rounded-full border px-3 py-1.5 text-sm transition-colors",
										"focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
										focusArea === opt.value
											? "border-emerald-600 bg-emerald-600/10 text-emerald-900 dark:border-emerald-500 dark:text-emerald-200"
											: "border-border bg-background hover:border-emerald-600/40 hover:bg-muted/40",
									)}
								>
									{opt.label}
								</button>
							))}
						</div>
						<p className="text-muted-foreground text-xs leading-snug">
							Quick picks add related topics; adjust the list below if you need something specific.
						</p>
					</div>

					<Separator className="shrink-0" />

					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
							<h3 className="font-mono text-muted-foreground text-[11.5px] font-medium uppercase tracking-[0.09em]">
								Chapters
							</h3>
							<div className="flex items-center gap-3 text-xs tabular-nums">
								<span
									className={cn(
										"transition-colors",
										selectedTrackerIds.size > 0
											? "text-foreground font-medium"
											: "text-muted-foreground",
									)}
								>
									{selectedTrackerIds.size} selected
								</span>
								{selectedTrackerIds.size > 0 ? (
									<>
										<span aria-hidden className="text-border">·</span>
										<button
											type="button"
											onClick={onClearSelection}
											className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
										>
											Clear
										</button>
									</>
								) : null}
								<span aria-hidden className="text-border">·</span>
								<button
									type="button"
									onClick={onExpandAll}
									className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
								>
									Expand all
								</button>
								<span aria-hidden className="text-border">·</span>
								<button
									type="button"
									onClick={onCollapseAll}
									className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
								>
									Collapse all
								</button>
							</div>
						</div>
						<p className="text-muted-foreground text-xs leading-snug">
							Expand a chapter to pick topics, or use the chapter checkbox to select the whole
							chapter.
						</p>
						{attemptedContinue && !selectionOk ? (
							<p className="text-destructive text-sm" role="status">
								Select at least one topic to continue.
							</p>
						) : null}
						<div
							className={cn("rounded-lg", practiceTopicMatrixSurfaceClass)}
							onWheel={forwardWheelToWizardStepScroll}
						>
							<TrackerSelector
								practiceChapterSections={practiceChapterSections}
								selectedTrackerIds={selectedTrackerIds}
								chapterOpenMode={chapterOpenMode}
								chapterVersion={chapterVersion}
								bulkSelectTrackers={bulkSelectTrackers}
								toggleTracker={toggleTracker}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
