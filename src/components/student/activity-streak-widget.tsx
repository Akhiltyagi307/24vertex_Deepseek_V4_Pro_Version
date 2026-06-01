"use client";

import * as React from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { CheckCircle2Icon, ChevronDownIcon, LoaderIcon, ZapIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
	"w-[min(calc(100vw-1.25rem),22rem)] overflow-hidden rounded-[14px] border border-border/60 bg-popover p-0 shadow-lg ring-1 ring-black/[0.06] dark:border-border dark:bg-popover dark:ring-white/[0.08]";

const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

/** At-risk trigger: border + dot only */
const streakUrgencyTriggerChrome = "border-amber-500/40 dark:border-amber-500/35";

const streakUrgencyText = "text-amber-900 dark:text-amber-100";
const streakUrgencyBadge =
	"rounded-md bg-amber-500/12 px-1.5 py-0.5 text-2xs font-semibold text-amber-900 dark:text-amber-100";

const MILESTONE_SEGMENT_WEEKS = 4;
const MILESTONE_COUNT = STREAK_REWARD_TARGET_WEEKS / MILESTONE_SEGMENT_WEEKS;

const STREAK_WEEKLY_RULE =
	"Submit at least one practice test or assignment each calendar week (India time).";
const STREAK_RESET_RULE =
	"If you skip a full week without using a streak freeze, your streak count resets to zero.";
const STREAK_FREEZE_AVAILABLE_RULE =
	"You have one streak freeze. It covers a single missed week, then you need four active weeks to earn it back.";
const STREAK_FREEZE_USED_RULE =
	"Your streak freeze was used. Stay active for four weeks in a row to earn another one.";

export type ActivityStreakWidgetProps = {
	initialSnapshot?: StudentActivityStreakSnapshot | null;
};

type StreakVisualTone = "reward" | "active" | "at-risk" | "idle" | "new";

function resolveStreakVisualTone({
	rewardGranted,
	isActiveThisWeek,
	isAtRisk,
	streakWeeks,
}: {
	rewardGranted: boolean;
	isActiveThisWeek: boolean;
	isAtRisk: boolean;
	streakWeeks: number;
}): StreakVisualTone {
	if (rewardGranted) return "reward";
	if (isAtRisk) return "at-risk";
	if (isActiveThisWeek) return "active";
	if (streakWeeks > 0) return "idle";
	return "new";
}

function StreakZapIcon({
	tone,
	className,
}: {
	tone: StreakVisualTone;
	className?: string;
}) {
	return (
		<ZapIcon
			className={cn(
				"shrink-0 transition-colors duration-200 ease-out motion-reduce:transition-none",
				tone === "reward" || tone === "active" ?
					"fill-primary text-primary"
				: tone === "at-risk" ?
					"fill-amber-500 text-amber-600 dark:fill-amber-400 dark:text-amber-400"
				: tone === "idle" ?
					"fill-muted-foreground/25 text-muted-foreground/80"
				:	"text-muted-foreground/55",
				className,
			)}
			aria-hidden
		/>
	);
}

function shortenWeekDeadline(deadline: string): string {
	return deadline.replace(/^Submit by end of /i, "Due by ");
}

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
	captionMode = "full",
	compact = false,
}: {
	streakWeeks: number;
	tone: "active" | "at-risk" | "idle" | "complete";
	captionMode?: "full" | "hidden";
	compact?: boolean;
}) {
	const fillClass =
		tone === "complete" || tone === "active" ? "bg-primary"
		: tone === "at-risk" ? "bg-amber-500 dark:bg-amber-400"
		: "bg-muted-foreground/35";

	const captionId = React.useId();
	const caption = `${streakWeeks} of ${STREAK_REWARD_TARGET_WEEKS} weeks toward a free year of Pro. Each bar is ${MILESTONE_SEGMENT_WEEKS} weeks.`;
	const barHeight = compact ? "h-2.5" : "h-1.5";

	return (
		<div className="space-y-1">
			<div className="flex gap-0.5" role="img" aria-labelledby={captionId}>
				{Array.from({ length: MILESTONE_COUNT }, (_, index) => {
					const fill = tone === "complete" ? 1 : milestoneFillForWeek(streakWeeks, index);
					return (
						<div
							key={index}
							className={cn("min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/80", barHeight)}
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
			{captionMode === "full" ? (
				<p id={captionId} className="text-2xs text-muted-foreground">
					{caption}
				</p>
			) : (
				<p id={captionId} className="sr-only">
					{caption}
				</p>
			)}
		</div>
	);
}

function StreakTrayHeader() {
	return (
		<div className="flex shrink-0 flex-col items-center border-b border-border/50 bg-muted/20 px-3 pb-2.5 pt-2">
			<div
				className="mb-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25 medium:hidden"
				aria-hidden
			/>
			<h2 className="w-full px-1 text-[17px] font-semibold tracking-tight text-foreground">
				Weekly streak
			</h2>
		</div>
	);
}

function StreakTraySkeleton() {
	return (
		<div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Loading streak">
			<div className="space-y-2">
				<div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
				<div className="h-6 w-48 animate-pulse rounded bg-muted/70" />
				<div className="h-4 w-full animate-pulse rounded bg-muted/60" />
			</div>
			<div className="flex gap-0.5">
				{Array.from({ length: MILESTONE_COUNT }, (_, i) => (
					<div key={i} className="h-1.5 min-w-0 flex-1 animate-pulse rounded-sm bg-muted/70" />
				))}
			</div>
		</div>
	);
}

function StreakIconTile({ tone }: { tone: StreakVisualTone }) {
	return (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-lg",
				tone === "reward" || tone === "active" ?
					"bg-primary/15"
				: tone === "at-risk" ?
					"bg-amber-500/15"
				:	"bg-muted/60",
			)}
		>
			{tone === "reward" ?
				<CheckCircle2Icon className="size-4 text-primary" aria-hidden />
			:	<StreakZapIcon tone={tone} className="size-4" />}
		</div>
	);
}

function StreakFreezeChip({ available }: { available: boolean }) {
	if (!available) return null;
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-2xs font-semibold tabular-nums text-sky-800 dark:text-sky-200">
			<span aria-hidden>❄</span>
			1 freeze
		</span>
	);
}

function StreakRulesDisclosure({
	freezesAvailable,
}: {
	freezesAvailable: number;
}) {
	const [rulesOpen, setRulesOpen] = React.useState(false);
	const freezeRule =
		freezesAvailable > 0 ? STREAK_FREEZE_AVAILABLE_RULE : STREAK_FREEZE_USED_RULE;

	return (
		<Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
			<CollapsibleTrigger
				type="button"
				className={cn(
					"group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-muted-foreground outline-none",
					"hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
				)}
			>
				<ChevronDownIcon
					className={cn(
						"size-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
						rulesOpen ? "rotate-0" : "-rotate-90",
					)}
					aria-hidden
				/>
				How weekly streaks work
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
					<li>{STREAK_WEEKLY_RULE}</li>
					<li>{freezeRule}</li>
					<li>{STREAK_RESET_RULE}</li>
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

function StreakRefreshSpinner({ show }: { show: boolean }) {
	if (!show) return null;
	return (
		<LoaderIcon
			className="size-4 shrink-0 animate-spin text-muted-foreground"
			aria-label="Updating streak"
		/>
	);
}

function StreakAtRiskTrayBody({
	streakWeeks,
	weekDeadline,
	freezesAvailable,
	displayWeeks,
	isRefreshing,
	weeksToReward,
}: {
	streakWeeks: number;
	weekDeadline: string;
	freezesAvailable: number;
	displayWeeks: number;
	isRefreshing: boolean;
	weeksToReward: number;
}) {
	const deadlineShort = shortenWeekDeadline(weekDeadline);

	return (
		<div
			className={cn(
				"flex flex-col gap-4 transition-opacity duration-200 ease-out motion-reduce:transition-none",
				isRefreshing && "opacity-60",
			)}
			aria-busy={isRefreshing}
		>
			<div className="relative flex flex-col items-center gap-3 text-center">
				<div className="absolute top-0 right-0">
					<StreakRefreshSpinner show={isRefreshing} />
				</div>
				<div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/12 ring-1 ring-amber-500/20">
					<StreakZapIcon tone="at-risk" className="size-8" />
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					<StreakStatusBadge variant="at-risk" />
					<StreakFreezeChip available={freezesAvailable > 0} />
				</div>
				<div className="tabular-nums">
					<p className="text-5xl font-bold leading-none tracking-tight text-foreground">{streakWeeks}</p>
					<p className="mt-1 text-sm font-medium text-muted-foreground">week streak</p>
				</div>
				<p className="text-sm font-medium text-foreground">{deadlineShort}</p>
				<p className="text-2xs text-muted-foreground">
					{weeksToReward} weeks to free Pro · {STREAK_REWARD_TARGET_WEEKS}-week goal
				</p>
			</div>

			<StreakMilestoneTrack
				streakWeeks={displayWeeks}
				tone="at-risk"
				captionMode="hidden"
				compact
			/>

			<StreakRulesDisclosure freezesAvailable={freezesAvailable} />
		</div>
	);
}

function StreakProgressTrayBody({
	rewardGranted,
	isActiveThisWeek,
	streakWeeks,
	displayWeeks,
	milestoneTone,
	rewardLine,
	contextMetaLines,
	freezesAvailable,
	isRefreshing,
	statusCopy,
	statusBadgeVariant,
}: {
	rewardGranted: boolean;
	isActiveThisWeek: boolean;
	streakWeeks: number;
	displayWeeks: number;
	milestoneTone: "active" | "idle" | "complete";
	rewardLine: string;
	contextMetaLines: string[];
	freezesAvailable: number;
	isRefreshing: boolean;
	statusCopy: string;
	statusBadgeVariant: "active" | "reward" | null;
}) {
	const iconTone = resolveStreakVisualTone({
		rewardGranted,
		isActiveThisWeek,
		isAtRisk: false,
		streakWeeks,
	});

	return (
		<div
			className={cn(
				"flex flex-col gap-4 transition-opacity duration-200 ease-out motion-reduce:transition-none",
				isRefreshing && "opacity-60",
			)}
			aria-busy={isRefreshing}
		>
			<div className="flex items-start gap-3">
				<StreakIconTile tone={iconTone} />
				<div className="min-w-0 flex-1 space-y-1.5">
					{statusBadgeVariant ? <StreakStatusBadge variant={statusBadgeVariant} /> : null}
					<p className="text-sm leading-snug text-muted-foreground">{statusCopy}</p>
				</div>
				<StreakRefreshSpinner show={isRefreshing} />
			</div>

			<div className="space-y-2">
				<div className="flex items-baseline gap-1.5 tabular-nums">
					<span className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
						{displayWeeks}
					</span>
					<span className="text-sm text-muted-foreground">of {STREAK_REWARD_TARGET_WEEKS} weeks</span>
				</div>
				<StreakMilestoneTrack streakWeeks={displayWeeks} tone={milestoneTone} captionMode="full" />
				{!rewardGranted ? (
					<p className="text-xs text-muted-foreground">{rewardLine}</p>
				) : (
					<p className="text-xs font-medium text-foreground/90">{rewardLine}</p>
				)}
			</div>

			{contextMetaLines.length > 0 ? (
				<ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
					{contextMetaLines.map((line) => (
						<li key={line}>{line}</li>
					))}
				</ul>
			) : null}

			{!rewardGranted ? <StreakRulesDisclosure freezesAvailable={freezesAvailable} /> : null}
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
	const freezesAvailable = snapshot?.freezesAvailable ?? 1;
	const isAtRisk = streakWeeks > 0 && !isActiveThisWeek && !rewardGranted;
	const isInitialLoad = loading && !snapshot;
	const isRefreshing = loading && Boolean(snapshot);

	const weekLabel = streakWeeks === 1 ? "1 week" : `${streakWeeks} weeks`;
	const triggerLabel = rewardGranted ? "Earned" : isAtRisk ? "Due" : "Streak";
	const weekDeadline = formatStreakWeekDeadline();

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
		: weeksToReward <= MILESTONE_SEGMENT_WEEKS ?
			`${weeksToReward} ${weeksToReward === 1 ? "week" : "weeks"} left for a free year of Pro`
		:	`${weeksToReward} weeks until a free year of Pro`;

	const statusCopy =
		rewardGranted ?
			`You completed ${STREAK_REWARD_TARGET_WEEKS} weeks in a row.`
		: isActiveThisWeek ?
			"You are set for this week. Another submit still counts toward your streak."
		: streakWeeks > 0 ?
			"Submit a practice test or assignment to extend your streak."
		:	"Submit a practice test or assignment to start your streak.";

	const contextMetaLines = [
		formatLastActiveWeekLabel(snapshot?.lastActiveWeekStart ?? null),
		longestStreakWeeks > streakWeeks ? formatLongestStreakLabel(longestStreakWeeks) : null,
	].filter(Boolean) as string[];

	const statusBadgeVariant =
		rewardGranted ? "reward"
		: isActiveThisWeek ? "active"
		: null;

	const displayWeeks = rewardGranted ? STREAK_REWARD_TARGET_WEEKS : streakWeeks;
	const visualTone = resolveStreakVisualTone({
		rewardGranted,
		isActiveThisWeek,
		isAtRisk,
		streakWeeks,
	});

	const primaryCtaLabel =
		isAtRisk || streakWeeks === 0 ?
			"Submit practice or assignment"
		:	"Go to practice";

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
					isAtRisk && streakUrgencyTriggerChrome,
					rewardGranted && "border-primary/35 ring-1 ring-primary/20",
				)}
			>
				{rewardGranted ? (
					<CheckCircle2Icon className="size-4 shrink-0 text-primary" aria-hidden />
				) : (
					<StreakZapIcon tone={visualTone} className="size-4" />
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
						className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-600 ring-2 ring-sidebar dark:bg-amber-500 dark:ring-sidebar"
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
								Try again
							</Button>
						</div>
					) : isInitialLoad ? (
						<StreakTraySkeleton />
					) : (
						<div className="flex flex-col gap-4 p-4">
							{isAtRisk ?
								<StreakAtRiskTrayBody
									streakWeeks={streakWeeks}
									weekDeadline={weekDeadline}
									freezesAvailable={freezesAvailable}
									displayWeeks={displayWeeks}
									isRefreshing={isRefreshing}
									weeksToReward={weeksToReward}
								/>
							:	<StreakProgressTrayBody
									rewardGranted={rewardGranted}
									isActiveThisWeek={isActiveThisWeek}
									streakWeeks={streakWeeks}
									displayWeeks={displayWeeks}
									milestoneTone={
										milestoneTone === "at-risk" ? "idle" : milestoneTone
									}
									rewardLine={rewardLine}
									contextMetaLines={contextMetaLines}
									freezesAvailable={freezesAvailable}
									isRefreshing={isRefreshing}
									statusCopy={statusCopy}
									statusBadgeVariant={statusBadgeVariant}
								/>
							}

							<div className="flex flex-col gap-2 border-t border-border/50 pt-4">
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
													{primaryCtaLabel}
												</Link>
											}
											variant="default"
											size="sm"
											className="w-full"
										/>
										{isAtRisk ? (
											<Button
												render={
													<Link href="/student/assignments" onClick={() => setOpen(false)}>
														Go to assignments
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
