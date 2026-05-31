"use client";

import Link from "next/link";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PerformanceRowSerialized } from "@/lib/student/performance-matrix";
import { computeMasteryState, formatMasteryStateLabel } from "@/lib/student/mastery-states";
import { formatTrackerStatusLabel } from "@/lib/student/tracker-status-labels";

import {
	formatLastTest,
	formatScore,
	performanceStatusBadgeClass,
	practiceHref,
	statusBadgeVariant,
	trendLabel,
} from "./performance-view-helpers";

function trendIcon(row: PerformanceRowSerialized) {
	const common = "size-3.5 shrink-0";
	if (row.trend === "improving") {
		return <TrendingUpIcon className={cn(common, "text-primary")} aria-hidden />;
	}
	if (row.trend === "declining") {
		return <TrendingDownIcon className={cn(common, "text-destructive")} aria-hidden />;
	}
	return <MinusIcon className={cn(common, "text-muted-foreground")} aria-hidden />;
}

export type PerformanceTopicSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sheetRow: PerformanceRowSerialized | null;
	allowPractice: boolean;
	practiceOpts: { basePath: string; allowPractice: boolean };
};

export function PerformanceTopicSheet({
	open,
	onOpenChange,
	sheetRow,
	allowPractice,
	practiceOpts,
}: PerformanceTopicSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="medium:max-w-md">
				{sheetRow ? (
					<>
						<SheetHeader>
							<SheetTitle className="text-pretty">{sheetRow.topicName}</SheetTitle>
							<SheetDescription>
								{sheetRow.subjectName} · Unit {sheetRow.unitNumber}: {sheetRow.unitName} ·{" "}
								{sheetRow.chapterName}
							</SheetDescription>
						</SheetHeader>
						<div className="flex flex-col gap-4 px-4">
							<div className="grid grid-cols-2 gap-3">
								<div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
									<p className="text-muted-foreground text-xs">Performance</p>
									<Badge
										variant={statusBadgeVariant(sheetRow.status)}
										className={cn("mt-2", performanceStatusBadgeClass(sheetRow.status))}
									>
										{formatTrackerStatusLabel(sheetRow.status)}
									</Badge>
									{!allowPractice ? (
										<p className="mt-2 text-muted-foreground text-xs">
											Mastery:{" "}
											<span className="font-medium text-foreground">
												{formatMasteryStateLabel(
													computeMasteryState({
														status: sheetRow.status,
														testsTaken: sheetRow.testsTaken,
														averageScore: sheetRow.averageScore,
													}),
												)}
											</span>
										</p>
									) : null}
								</div>
								<div className="rounded-lg border border-border bg-muted/25 px-3 py-3">
									<p className="text-muted-foreground text-xs">Tests taken</p>
									<p className="mt-1 font-semibold text-2xl text-foreground tabular-nums tracking-tight">
										{sheetRow.testsTaken}
									</p>
									<p className="text-[11px] text-muted-foreground leading-tight">
										{sheetRow.testsTaken === 1 ? "test so far" : "tests so far"}
									</p>
								</div>
							</div>
							<p className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
								{trendIcon(sheetRow)}
								<span>
									Trend: <span className="text-foreground">{trendLabel(sheetRow.trend)}</span>
								</span>
							</p>
							{allowPractice && sheetRow.trend === "improving" ? (
								<p
									className={cn(
										"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
										"bg-primary/10 text-primary",
									)}
								>
									<TrendingUpIcon className="size-3.5 shrink-0" aria-hidden />
									<span>You&apos;re improving here — keep going.</span>
								</p>
							) : null}
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
								<dt className="text-muted-foreground">Average score</dt>
								<dd className="font-mono tabular-nums">{formatScore(sheetRow.averageScore)}</dd>
								<dt className="text-muted-foreground">Last test</dt>
								<dd className="font-mono tabular-nums text-xs">
									{formatLastTest(sheetRow.lastTestDate)}
								</dd>
							</dl>
							<p className="text-muted-foreground text-xs leading-relaxed">
								Test history charts and suggested resources will appear here as those features ship.
							</p>
						</div>
						<SheetFooter className="medium:flex-row">
							{allowPractice ? (
								<Button
									className="w-full medium:w-auto"
									render={
										<Link
											href={practiceHref([sheetRow.topicId], sheetRow.subjectId, practiceOpts)}
										/>
									}
								>
									Practice this topic
								</Button>
							) : null}
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
