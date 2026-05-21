"use client";

import Link from "next/link";
import * as React from "react";
import { TrophyIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
	formatLeaderboardCohortDescription,
	type LeaderboardScopeId,
	type StudentDashboardLeaderboardPayload,
} from "@/lib/student/dashboard-leaderboard";
import {
	dashboardPortalCardClassName,
	dashboardPortalCardContentClassName,
	dashboardPortalCardEmptyClassName,
	dashboardPortalCardPopulatedClassName,
} from "@/lib/student/dashboard-portal-card-layout";
import { cn } from "@/lib/utils";

const SPARSE_RANKED_THRESHOLD = 3;

function rankBadgeClass(rank: number): string {
	if (rank === 1) return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
	if (rank === 2) return "bg-slate-400/25 text-slate-700 dark:text-slate-200";
	if (rank === 3) return "bg-orange-600/20 text-orange-800 dark:text-orange-200";
	return "bg-muted text-muted-foreground";
}

type StudentDashboardLeaderboardCardProps = {
	leaderboard: StudentDashboardLeaderboardPayload;
	variant: "student" | "parent";
};

export function StudentDashboardLeaderboardCard({
	leaderboard,
	variant,
}: StudentDashboardLeaderboardCardProps) {
	const viewerStudentId = leaderboard.viewerStudentId;
	const isParent = variant === "parent";
	const defaultScope = leaderboard.scopeLabels[0]?.id ?? "overall";
	const [scopeId, setScopeId] = React.useState<LeaderboardScopeId>(defaultScope);

	const scopeResult = leaderboard.byScope[scopeId] ?? leaderboard.byScope.overall;
	const topFive = scopeResult?.topFive ?? [];
	const viewer = scopeResult?.viewer ?? null;
	const rankedCount = scopeResult?.rankedCount ?? 0;
	const cohortSize = scopeResult?.cohortSize ?? leaderboard.cohortSize;
	const hasRankedStudents = rankedCount > 0;
	const isSparse = rankedCount > 0 && rankedCount < SPARSE_RANKED_THRESHOLD;

	const viewerLabel = isParent ? "Your child" : "You";
	const scopeLabelById = React.useMemo(
		() => new Map(leaderboard.scopeLabels.map((scope) => [scope.id, scope.label])),
		[leaderboard.scopeLabels],
	);
	const cohortDescription = formatLeaderboardCohortDescription(leaderboard, variant);

	return (
		<Card
			className={cn(
				cardSurfaceFrameClassName,
				dashboardPortalCardClassName,
				hasRankedStudents && dashboardPortalCardPopulatedClassName,
				"w-full",
			)}
		>
			<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 px-5 pb-3">
				<div className="min-w-0 flex-1">
					<CardTitle className="flex items-center gap-2.5 text-base font-semibold leading-snug">
						<TrophyIcon
							className="size-5 shrink-0 text-primary"
							strokeWidth={2}
							aria-hidden
						/>
						Leaderboard
					</CardTitle>
					<CardDescription className="mt-1.5 text-sm leading-snug">
						{cohortDescription} · Last 30 days
					</CardDescription>
				</div>
				{leaderboard.scopeLabels.length > 1 ? (
					<Select value={scopeId} onValueChange={(v) => setScopeId(v as LeaderboardScopeId)}>
						<SelectTrigger
							className="h-9 w-[min(100%,11rem)] shrink-0 text-sm"
							aria-label="Leaderboard subject"
						>
							<SelectValue placeholder="Overall">
								{(value) =>
									value == null ? "Overall" : (scopeLabelById.get(value) ?? "Overall")
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent align="end">
							{leaderboard.scopeLabels.map((scope) => (
								<SelectItem key={scope.id} value={scope.id} className="text-xs">
									{scope.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
			</CardHeader>
			<CardContent className={cn(dashboardPortalCardContentClassName, "pb-5")}>
				{!hasRankedStudents ? (
					<div className={dashboardPortalCardEmptyClassName}>
						<TrophyIcon
							className="size-10 text-muted-foreground/70"
							strokeWidth={1.5}
							aria-hidden
						/>
						<p className="max-w-sm text-sm text-muted-foreground">
							{isParent
								? "Not enough activity yet. Completed practice tests in the last 30 days will populate this board."
								: "Not enough activity yet. Complete a practice test to join the board."}
						</p>
						{isParent ? (
							<Button variant="outline" render={<Link href="/parent/performance" />}>
								View their performance
							</Button>
						) : (
							<Button variant="outline" render={<Link href="/student/practice" />}>
								Start practice
							</Button>
						)}
					</div>
				) : (
					<>
						{isSparse ? (
							<p className="mb-3 text-sm text-muted-foreground leading-snug">
								{rankedCount} of {cohortSize} learner{cohortSize === 1 ? "" : "s"} active in the last 30
								days. Rankings become more meaningful as more classmates practice.
							</p>
						) : null}
						<ol className="min-h-[220px] flex-1 space-y-2.5">
							{topFive.map((entry) => {
								const isViewerRow =
									viewerStudentId != null
										? entry.studentId === viewerStudentId
										: viewer?.inTopFive && viewer.rank === entry.rank;
								return (
									<li
										key={entry.studentId}
										className={cn(
											"flex items-center gap-3 rounded-lg bg-muted/25 px-4 py-3",
											isViewerRow && "ring-1 ring-primary/20",
										)}
									>
										<span
											className={cn(
												"flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums",
												rankBadgeClass(entry.rank),
											)}
										>
											{entry.rank}
										</span>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">{entry.displayName}</p>
											<p className="text-[11px] text-muted-foreground tabular-nums">
												{entry.testsCount} test{entry.testsCount === 1 ? "" : "s"}
											</p>
										</div>
										<p className="shrink-0 font-semibold text-sm tabular-nums text-foreground">
											{entry.averagePercent}%
										</p>
									</li>
								);
							})}
						</ol>
						{viewer && !viewer.inTopFive ? (
							<div className="mt-3 border-t border-border/60 pt-3">
								<div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-2 ring-1 ring-primary/15">
									<span className="text-sm font-medium">{viewerLabel}</span>
									{viewer.averagePercent != null && viewer.rank > 0 ? (
										<span className="text-sm tabular-nums text-muted-foreground">
											#{viewer.rank} · {viewer.averagePercent}% · {viewer.testsCount} test
											{viewer.testsCount === 1 ? "" : "s"}
										</span>
									) : (
										<span className="text-xs text-muted-foreground">
											No scored tests in this window.{" "}
											{isParent ? (
												<Link
													href="/parent/performance"
													className="text-primary underline underline-offset-2"
												>
													View their performance
												</Link>
											) : (
												<Link
													href="/student/practice"
													className="text-primary underline underline-offset-2"
												>
													Start practice
												</Link>
											)}
										</span>
									)}
								</div>
							</div>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	);
}
