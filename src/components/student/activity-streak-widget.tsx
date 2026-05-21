"use client";

import * as React from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { CheckCircle2Icon, LoaderIcon, ZapIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import {
	ACTIVITY_STREAK_REFRESH_EVENT,
	LEGACY_ACTIVITY_STREAK_REFRESH_EVENT,
	formatLastActiveWeekLabel,
	formatLongestStreakLabel,
	formatStreakWeekDeadline,
} from "@/lib/student/activity-streak-display";
import {
	STREAK_REWARD_TARGET_WEEKS,
	type StudentActivityStreakSnapshot,
} from "@/lib/student/activity-streak";
import { cn } from "@/lib/utils";

/** Shared with notifications bell tray */
const trayPopoverClass =
	"w-[min(calc(100vw-1.25rem),22rem)] overflow-hidden p-0 rounded-[14px] border border-border/60 bg-popover/95 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-xl dark:border-border dark:bg-popover/95 dark:ring-white/[0.08]";

const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

const streakUrgencyChrome =
	"border-amber-500/45 bg-amber-500/[0.08] shadow-sm ring-1 ring-amber-500/25 dark:border-amber-500/40 dark:bg-amber-500/[0.12] dark:ring-amber-500/20";

const streakUrgencyIcon = "text-amber-600 dark:text-amber-400";
const streakUrgencyText = "text-amber-800 dark:text-amber-200";
const streakUrgencyBadge =
	"rounded-md bg-amber-500/15 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200";

const MILESTONE_SEGMENT_WEEKS = 4;
const MILESTONE_COUNT = STREAK_REWARD_TARGET_WEEKS / MILESTONE_SEGMENT_WEEKS;

const STREAK_RULES_LINE =
	"One practice or assignment submit per week counts. Skip a full week and your streak resets.";

export type ActivityStreakWidgetProps = {
	initialSnapshot?: StudentActivityStreakSnapshot | null;
};

function milestoneFillForWeek(streakWeeks: number, index: number): number {
	const segmentStart = index * MILESTONE_SEGMENT_WEEKS;
	const segmentEnd = segmentStart + MILESTONE_SEGMENT_WEEKS;
	if (streakWeeks >= segmentEnd) return 1;
	if (streakWeeks <= segmentStart) return 0;
	return (streakWeeks - segmentStart) / MILESTONE_SEGMENT_WEEKS;
}

function StreakStatusBadge({
	variant,
}: {
	variant: "active" | "at-risk" | "reward";
}) {
	if (variant === "at-risk") {
		return <span className={streakUrgencyBadge}>Due this week</span>;
	}
	if (variant === "active") {
		return (
			<span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-2xs font-semibold text-primary">
				Active this week
			</span>
		);
	}
	return (
		<span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-2xs font-semibold text-primary">
			Reward earned
		</span>
	);
}

function StreakMilestoneTrack({
	streakWeeks,
	tone,
}: {
	streakWeeks: number;
	tone: "active" | "at-risk" | "idle" | "complete";
}) {
	const fillClass =
		tone === "complete" || tone === "active" ? "bg-primary"
		: tone === "at-risk" ? "bg-amber-500 dark:bg-amber-400"
		: "bg-muted-foreground/35";

	return (
		<div
			className="flex gap-0.5"
			role="img"
			aria-label={`${streakWeeks} of ${STREAK_REWARD_TARGET_WEEKS} weeks toward a free year of Pro`}
		>
			{Array.from({ length: MILESTONE_COUNT }, (_, index) => {
				const fill = tone === "complete" ? 1 : milestoneFillForWeek(streakWeeks, index);
				return (
					<div
						key={index}
						className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/80"
					>
						<div
							className={cn(
								"h-full rounded-sm transition-[width] duration-300 ease-out motion-reduce:transition-none",
								fillClass,
							)}
							style={{ width: `${Math.round(fill * 100)}%` }}
						/>
					</div>
				);
			})}
		</div>
	);
}

function StreakTrayHeader() {
	return (
		<div className="flex shrink-0 flex-col items-center border-b border-border/50 bg-muted/20 px-3 pb-2.5 pt-2">
			<div className="mb-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
			<h2 className="w-full px-1 text-[17px] font-semibold tracking-tight text-foreground">
				Weekly streak
			</h2>
		</div>
	);
}

function StreakTraySkeleton() {
	return (
		<div className="flex flex-col gap-3.5 p-4" aria-busy="true" aria-label="Loading streak">
			<div className="flex gap-3">
				<div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted/70" />
				<div className="flex flex-1 flex-col gap-2">
					<div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
					<div className="h-3 w-full animate-pulse rounded bg-muted/60" />
				</div>
			</div>
			<div className="h-8 w-36 animate-pulse rounded bg-muted/70" />
			<div className="flex gap-0.5">
				{Array.from({ length: MILESTONE_COUNT }, (_, i) => (
					<div key={i} className="h-1.5 min-w-0 flex-1 animate-pulse rounded-sm bg-muted/70" />
				))}
			</div>
		</div>
	);
}

function StreakIconTile({
	tone,
}: {
	tone: "active" | "at-risk" | "idle" | "reward";
}) {
	return (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-lg",
				tone === "reward" || tone === "active" ?
					"bg-primary/15 text-primary"
				: tone === "at-risk" ?
					"bg-amber-500/15 text-amber-600 dark:text-amber-400"
				:	"bg-muted/60 text-muted-foreground",
			)}
		>
			{tone === "reward" ? (
				<CheckCircle2Icon className="size-4" aria-hidden />
			) : (
				<ZapIcon
					className={cn(
						"size-4",
						tone === "active" && "fill-primary",
						tone === "at-risk" && "fill-amber-500/30",
					)}
					aria-hidden
				/>
			)}
		</div>
	);
}

export function ActivityStreakWidget({ initialSnapshot = null }: ActivityStreakWidgetProps) {
	const [open, setOpen] = React.useState(false);
	const [snapshot, setSnapshot] = React.useState<StudentActivityStreakSnapshot | null>(initialSnapshot);
	const [loading, setLoading] = React.useState(!initialSnapshot);
	const [loadError, setLoadError] = React.useState(false);

	const loadSnapshot = React.useCallback(async () => {
		setLoading(true);
		setLoadError(false);
		try {
			const res = await fetch("/api/student/activity-streak", { cache: "no-store" });
			if (!res.ok) throw new Error(`status=${res.status}`);
			const json = (await res.json()) as StudentActivityStreakSnapshot;
			setSnapshot(json);
		} catch (err) {
			setLoadError(true);
			Sentry.captureException(err, { tags: { area: "activity_streak", op: "load" } });
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		if (initialSnapshot) return;
		void loadSnapshot();
	}, [initialSnapshot, loadSnapshot]);

	React.useEffect(() => {
		if (!open) return;
		void loadSnapshot();
	}, [open, loadSnapshot]);

	React.useEffect(() => {
		const onRefresh = () => void loadSnapshot();
		window.addEventListener(ACTIVITY_STREAK_REFRESH_EVENT, onRefresh);
		window.addEventListener(LEGACY_ACTIVITY_STREAK_REFRESH_EVENT, onRefresh);
		window.addEventListener("focus", onRefresh);
		return () => {
			window.removeEventListener(ACTIVITY_STREAK_REFRESH_EVENT, onRefresh);
			window.removeEventListener(LEGACY_ACTIVITY_STREAK_REFRESH_EVENT, onRefresh);
			window.removeEventListener("focus", onRefresh);
		};
	}, [loadSnapshot]);

	const streakWeeks = snapshot?.streakWeeks ?? 0;
	const isActiveThisWeek = snapshot?.currentWeekActive ?? false;
	const weeksToReward = snapshot?.weeksToReward ?? STREAK_REWARD_TARGET_WEEKS;
	const rewardGranted = snapshot?.rewardGranted ?? false;
	const longestStreakWeeks = snapshot?.longestStreakWeeks ?? 0;
	const isAtRisk = streakWeeks > 0 && !isActiveThisWeek && !rewardGranted;
	const isInitialLoad = loading && !snapshot;
	const isRefreshing = loading && Boolean(snapshot);

	const weekLabel = streakWeeks === 1 ? "1 week" : `${streakWeeks} weeks`;
	const triggerLabel = rewardGranted ? "Earned" : isAtRisk ? "Due" : "Streak";

	const milestoneTone =
		rewardGranted ? "complete"
		: isActiveThisWeek ? "active"
		: isAtRisk ? "at-risk"
		: "idle";

	const ariaLabel = rewardGranted
		? "Weekly streak reward earned"
		: isActiveThisWeek
			? `Weekly streak active, ${weekLabel}`
			: isAtRisk
				? `Weekly streak due this week, ${weekLabel}`
				: streakWeeks > 0
					? `Weekly streak, ${weekLabel}`
					: "Weekly streak not started";

	const rewardLine =
		rewardGranted ?
			snapshot?.rewardGrantedAt ?
				`Free year of Pro, ${formatDateTimeMediumShortInAppTimeZone(snapshot.rewardGrantedAt)}`
			:	"Free year of Pro on your account"
		:	`${weeksToReward} ${weeksToReward === 1 ? "week" : "weeks"} until a free year of Pro`;

	const statusCopy =
		rewardGranted ?
			`You completed ${STREAK_REWARD_TARGET_WEEKS} weeks in a row.`
		: isActiveThisWeek ?
			"You are active this week. Submit again anytime to stay ahead."
		: isAtRisk ?
			"Submit one test before this week ends or your streak resets to zero."
		: streakWeeks > 0 ?
			"Submit a practice test or assignment to continue."
		:	"Submit a practice test or assignment to start.";

	const metaLines = [
		formatLastActiveWeekLabel(snapshot?.lastActiveWeekStart ?? null),
		!rewardGranted && !isActiveThisWeek ? formatStreakWeekDeadline() : null,
		longestStreakWeeks > streakWeeks ? formatLongestStreakLabel(longestStreakWeeks) : null,
		STREAK_RULES_LINE,
	].filter(Boolean) as string[];

	const statusBadgeVariant =
		rewardGranted ? "reward"
		: isAtRisk ? "at-risk"
		: isActiveThisWeek ? "active"
		: null;

	const displayWeeks = rewardGranted ? STREAK_REWARD_TARGET_WEEKS : streakWeeks;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				type="button"
				aria-label={ariaLabel}
				aria-expanded={open}
				className={cn(
					buttonVariants({ variant: "ghost", size: "sm" }),
					"relative min-h-11 min-w-11 shrink-0 gap-1.5 rounded-md px-2.5 text-foreground outline-none transition-colors",
					"medium:h-8 medium:min-h-8 medium:min-w-0 medium:gap-1 medium:px-2",
					"hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-foreground/15",
					topBarControlChrome,
					isAtRisk && streakUrgencyChrome,
					rewardGranted && "border-primary/35 ring-1 ring-primary/20",
				)}
			>
				{rewardGranted ? (
					<CheckCircle2Icon className="size-4 shrink-0 text-primary" aria-hidden />
				) : (
					<ZapIcon
						className={cn(
							"size-4 shrink-0",
							isActiveThisWeek ?
								"fill-primary text-primary"
							: isAtRisk ?
								cn("fill-amber-500/25", streakUrgencyIcon)
							:	"text-muted-foreground/70",
						)}
						aria-hidden
					/>
				)}
				<span
					className={cn(
						"hidden text-xs font-medium medium:inline",
						rewardGranted ? "text-primary"
						: isAtRisk ? streakUrgencyText
						: "text-muted-foreground",
					)}
				>
					{triggerLabel}
				</span>
				<span
					className={cn(
						"min-w-[1ch] text-xs font-semibold tabular-nums tracking-tight",
						rewardGranted ? "text-primary"
						: isActiveThisWeek ? "text-foreground"
						: isAtRisk ? streakUrgencyText
						: "text-muted-foreground",
					)}
					aria-live="polite"
				>
					{isInitialLoad ? "—" : rewardGranted ? STREAK_REWARD_TARGET_WEEKS : streakWeeks}
				</span>
				{isAtRisk ? (
					<span
						className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500 ring-2 ring-sidebar dark:ring-sidebar"
						aria-hidden
					/>
				) : null}
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={10}
				className={cn(
					trayPopoverClass,
					isAtRisk && "border-amber-500/30 ring-amber-500/10",
					rewardGranted && "border-primary/30 ring-primary/10",
				)}
			>
				<div className="flex flex-col">
					<StreakTrayHeader />

					{loadError ? (
						<div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
							<p className="text-sm leading-relaxed text-muted-foreground">
								We could not load your streak. Check your connection and try again.
							</p>
							<Button type="button" variant="outline" size="sm" onClick={() => void loadSnapshot()}>
								Retry
							</Button>
						</div>
					) : isInitialLoad ? (
						<StreakTraySkeleton />
					) : (
						<div className="flex flex-col gap-3.5 p-4">
							<div className="flex items-start gap-3">
								<StreakIconTile
									tone={
										rewardGranted ? "reward"
										: isActiveThisWeek ? "active"
										: isAtRisk ? "at-risk"
										: "idle"
									}
								/>
								<div className="min-w-0 flex-1 space-y-1.5">
									{statusBadgeVariant ? (
										<StreakStatusBadge variant={statusBadgeVariant} />
									) : null}
									<p
										className={cn(
											"text-[13px] leading-snug",
											isAtRisk ? streakUrgencyText : "text-muted-foreground",
										)}
									>
										{statusCopy}
									</p>
								</div>
							</div>

							<div
								className={cn(
									"space-y-2 transition-opacity duration-200 ease-out motion-reduce:transition-none",
									isRefreshing && "opacity-60",
								)}
								aria-busy={isRefreshing}
							>
								<div className="flex items-baseline gap-1.5 tabular-nums">
									<span className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
										{displayWeeks}
									</span>
									<span className="text-sm text-muted-foreground">
										of {STREAK_REWARD_TARGET_WEEKS} weeks
									</span>
									{isRefreshing ? (
										<LoaderIcon
											className="ml-auto size-4 shrink-0 animate-spin text-muted-foreground"
											aria-label="Updating streak"
										/>
									) : null}
								</div>
								<StreakMilestoneTrack streakWeeks={displayWeeks} tone={milestoneTone} />
								<p className="text-xs font-medium text-foreground/90">{rewardLine}</p>
								<ul className="space-y-1 text-2xs leading-relaxed text-muted-foreground">
									{metaLines.map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>
							</div>

							<div className="flex flex-col gap-2 border-t border-border/50 pt-3.5">
								{rewardGranted ? (
									<Button
										render={
											<Link href="/student/subscription" onClick={() => setOpen(false)}>
												View subscription
											</Link>
										}
										variant="outline"
										size="sm"
										className="w-full"
									/>
								) : (
									<>
										<Button
											render={
												<Link href="/student/practice" onClick={() => setOpen(false)}>
													{isAtRisk ? "Submit a test now" : "Go to practice"}
												</Link>
											}
											variant={isAtRisk ? "default" : "outline"}
											size="sm"
											className={cn(
												"w-full",
												isAtRisk &&
													"bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-500 dark:hover:bg-amber-500/90",
											)}
										/>
										{isAtRisk ? (
											<Button
												render={
													<Link href="/student/assignments" onClick={() => setOpen(false)}>
														View assignments
													</Link>
												}
												variant="ghost"
												size="sm"
												className="w-full text-muted-foreground"
											/>
										) : null}
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
