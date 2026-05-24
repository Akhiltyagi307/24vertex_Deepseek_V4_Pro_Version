"use client";

import { ChevronRight } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

/** Frame + hover/focus ring; matches `Card` surface tokens (see `cardSurfaceFrameClassName`). */
export const dashboardSubjectCardSurfaceClassName = cn(
	cardSurfaceFrameClassName,
	"rounded-2xl shadow-none",
	"motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
	"motion-reduce:transition-none",
	"hover:border-emerald-500/50 hover:shadow-[0_2px_14px_-4px_rgba(16,185,129,0.2)]",
	"focus-within:border-emerald-500/50 focus-within:shadow-[0_2px_14px_-4px_rgba(16,185,129,0.2)]",
	"dark:hover:border-emerald-400/45 dark:hover:shadow-[0_2px_16px_-4px_rgba(52,211,153,0.18)]",
	"dark:focus-within:border-emerald-400/45 dark:focus-within:shadow-[0_2px_16px_-4px_rgba(52,211,153,0.18)]",
);

/** Shared CTA: pair with `variant="secondary"` `size="sm"` (white text on emerald, compact). */
export const dashboardSubjectCardCtaClassName = cn(
	"h-8 rounded-lg px-3.5",
	"text-xs font-semibold shadow-sm",
	"border border-emerald-400/35",
);

// ============================================================================
// Types
// ============================================================================

type SubjectStatus = "needs_attention" | "in_progress" | "on_track" | "ready_to_start";

/** Topic buckets from the performance tracker (same semantics as the topic matrix). */
export type SubjectCardTopicStatusCounts = {
	good: number;
	satisfactory: number;
	bad: number;
	notTested: number;
};

export interface SubjectCardProps {
	subject: string;
	/** Shown as `Last test · …` unless `subtitle` is set. */
	lastTestDate: string;
	/** When set, replaces the default “Last test · …” line (e.g. “No tests recorded yet”). */
	subtitle?: string;
	topicsAttempted: number;
	topicsTotal: number;
	testsTaken: number;
	avgScore: number;
	status: SubjectStatus;
	ctaLabel?: string;
	onCtaClick?: () => void;
	ctaRender?: ComponentProps<typeof Button>["render"];
	/** When false, the bottom CTA is omitted (e.g. Performance where the card is wrapped in a link). */
	showCta?: boolean;
	/**
	 * Compact tiles only: footer hint that the card opens a destination. Parent link should include
	 * Tailwind `group/tile` for hover styling.
	 */
	showTileHint?: boolean;
	/**
	 * Performance subject grid: per-topic status counts + segmented bar. When set (with `compact`),
	 * the subtitle line no longer duplicates “Last test · …”; last test moves into the stats grid.
	 */
	topicStatusCounts?: SubjectCardTopicStatusCounts;
	/** Renders in the header after the status label (e.g. per-subject icon), top-right. */
	metricsIconSlot?: ReactNode;
	className?: string;
	/** Tighter padding, smaller ring, shorter metric rows (Performance subject grid). */
	density?: "default" | "compact";
}

// ============================================================================
// Status configuration — single source of truth for colors + copy
// ============================================================================

const STATUS_CONFIG: Record<
	SubjectStatus,
	{
		label: string;
		/** Shown from `min-[360px]` until `sm` when `extraNarrowLabel` is set; else shown for all widths below `sm`. */
		narrowLabel?: string;
		/** With `narrowLabel`: shown below viewport 360px (Tailwind `min-[360px]`). */
		extraNarrowLabel?: string;
		/** Calmer label styling (Performance compact); other statuses stay uppercase. */
		sentenceCaseLabel?: boolean;
		dotColor: string;
		textColor: string;
		ringColor: string;
		scoreColor: string;
		defaultCta: string;
	}
> = {
	needs_attention: {
		label: "Needs attention",
		dotColor: "bg-red-400",
		textColor: "text-red-400",
		ringColor: "stroke-red-400",
		scoreColor: "text-red-400",
		defaultCta: "Start focus session",
	},
	in_progress: {
		label: "In progress",
		dotColor: "bg-amber-400",
		textColor: "text-amber-400",
		ringColor: "stroke-amber-400",
		scoreColor: "text-amber-400",
		defaultCta: "Continue practice",
	},
	on_track: {
		label: "On track",
		dotColor: "bg-emerald-400",
		textColor: "text-emerald-400",
		ringColor: "stroke-emerald-400",
		scoreColor: "text-emerald-400",
		defaultCta: "Take next test",
	},
	/** Enrolled but no attempts yet: neutral, avoids sounding like “all green”. */
	ready_to_start: {
		label: "Not started",
		sentenceCaseLabel: true,
		dotColor: "bg-muted-foreground/45",
		textColor: "text-muted-foreground",
		ringColor: "stroke-muted-foreground/35",
		scoreColor: "text-muted-foreground",
		defaultCta: "Open this subject",
	},
};

function TopicMasteryBar({ counts }: { counts: SubjectCardTopicStatusCounts }) {
	const { good, satisfactory, bad, notTested } = counts;
	const total = good + satisfactory + bad + notTested;
	const tested = good + satisfactory + bad;

	if (total > 0 && tested === 0 && notTested > 0) {
		return (
			<p
				className="m-0 text-[0.65rem] leading-snug text-muted-foreground tabular-nums"
				role="status"
			>
				<span className="font-medium text-foreground/90">{notTested}</span> untested
			</p>
		);
	}

	const segments = [
		{ key: "good", n: good, className: "bg-emerald-500 dark:bg-emerald-400" },
		{ key: "ok", n: satisfactory, className: "bg-amber-500 dark:bg-amber-400" },
		{ key: "bad", n: bad, className: "bg-red-500 dark:bg-red-400" },
		{
			key: "nt",
			n: notTested,
			className: "bg-muted-foreground/25 dark:bg-muted-foreground/30",
		},
	] as const;
	const label = `Topic mix: ${good} strong, ${satisfactory} on track, ${bad} strengthen, ${notTested} not tested.`;
	if (total === 0) {
		return (
			<div className="flex w-full flex-col gap-1.5">
				<div className="h-2 w-full rounded-full bg-muted/80" aria-hidden />
				<p className="m-0 text-[0.65rem] leading-snug text-muted-foreground">No topics</p>
			</div>
		);
	}
	return (
		<div className="flex w-full min-w-0 flex-col gap-1.5">
			<div
				className="flex h-2 w-full overflow-hidden rounded-full bg-muted/60"
				role="img"
				aria-label={label}
				title={label}
			>
				{segments.map(({ key, n, className: segClass }) => {
					if (n <= 0) return null;
					return (
						<div
							key={key}
							className={cn(segClass, "min-w-[2px]")}
							style={{ flex: `${n} 1 0%` }}
						/>
					);
				})}
			</div>
			<p
				className="m-0 text-[0.65rem] leading-none text-muted-foreground [overflow-wrap:anywhere]"
				aria-hidden
			>
				<span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">{good}</span>
				<span className="text-muted-foreground/45"> · </span>
				<span className="font-medium text-amber-600 tabular-nums dark:text-amber-400">{satisfactory}</span>
				<span className="text-muted-foreground/45"> · </span>
				<span className="font-medium text-red-600 tabular-nums dark:text-red-400">{bad}</span>
				<span className="text-muted-foreground/45"> · </span>
				<span className="font-medium tabular-nums text-foreground/85">{notTested}</span>
			</p>
		</div>
	);
}

// ============================================================================
// Component
// ============================================================================

export function SubjectCard({
	subject,
	lastTestDate,
	subtitle,
	topicsAttempted,
	topicsTotal,
	testsTaken,
	avgScore,
	status,
	ctaLabel,
	onCtaClick,
	ctaRender,
	showCta = true,
	showTileHint = false,
	topicStatusCounts,
	metricsIconSlot,
	className,
	density = "default",
}: SubjectCardProps) {
	const titleId = useId();
	const config = STATUS_CONFIG[status];
	const compact = density === "compact";
	const coverage =
		topicsTotal > 0 ? Math.round((topicsAttempted / topicsTotal) * 100) : 0;
	const coverageAriaValueText =
		topicsTotal > 0
			? `${coverage}% topic coverage, ${topicsAttempted} of ${topicsTotal} topics`
			: `${coverage}% topic coverage, no topics in plan yet`;

	const ringSize = compact ? 88 : 118;
	const ringCenter = ringSize / 2;
	const radius = compact ? 34 : 48;
	const strokeWidth = compact ? 5.5 : 7;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - coverage / 100);
	const lastTestMetaLine = lastTestDate.trim() ? `Last test · ${lastTestDate}` : "";
	const metaLine = subtitle !== undefined ? subtitle : lastTestMetaLine;
	const performanceTile = compact && topicStatusCounts != null;
	/** Tracker rows exist, syllabus has topics, but nothing attempted yet (Performance grid only). */
	const performanceQuietStart =
		performanceTile &&
		testsTaken === 0 &&
		topicsAttempted === 0 &&
		topicsTotal > 0;
	const showMetaLine = performanceTile
		? Boolean(subtitle !== undefined && subtitle.trim()) && !performanceQuietStart
		: Boolean(metaLine.trim());
	const showScorePercent = status !== "ready_to_start";
	const avgScoreAria = showScorePercent
		? `${avgScore}%`
		: "No tests yet, no average score yet";
	const showLinkedTileHint = compact && !showCta && showTileHint;
	const statusPill = compact && config.sentenceCaseLabel;

	return (
		<div
			className={cn(
				dashboardSubjectCardSurfaceClassName,
				compact ? "p-4 medium:p-[1.125rem]" : "p-5",
				"flex h-full flex-col",
				compact ? "gap-3" : "gap-3",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-start justify-between gap-3",
					performanceTile && "pb-3 border-b border-border/50",
				)}
			>
				<div className="min-w-0 flex-1 pr-1">
					<h3
						id={titleId}
						className={cn(
							"m-0 truncate font-semibold leading-snug tracking-tight text-foreground",
							compact ? "text-base medium:text-[1.0625rem]" : "text-sm",
						)}
						title={subject}
					>
						{subject}
					</h3>
					{showMetaLine ? (
						<p
							className={cn(
								"m-0 text-xs text-muted-foreground leading-snug",
								compact ? "line-clamp-2 [overflow-wrap:anywhere]" : "truncate",
							)}
							title={performanceTile ? subtitle : metaLine}
						>
							{performanceTile ? subtitle : metaLine}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-start gap-2 self-start pt-0.5 min-[360px]:gap-2.5">
					<div
						className={cn(
							"flex min-w-0 max-w-[11rem] items-center justify-end gap-1.5 medium:max-w-[13.5rem]",
							statusPill &&
								cn(
									"rounded-full border px-2.5 py-1",
									status === "ready_to_start"
										? "border-border/55 bg-muted/15 dark:bg-muted/[0.14]"
										: "border-border/60 bg-muted/20 dark:bg-muted/15",
								),
						)}
					>
						<span
							className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotColor)}
							aria-hidden
						/>
						<span
							className={cn(
								"text-right text-[0.6875rem] font-medium leading-tight medium:text-xs",
								config.sentenceCaseLabel
									? "normal-case tracking-tight"
									: "uppercase tracking-[0.05em] medium:tracking-[0.06em]",
								config.textColor,
							)}
						>
							{config.narrowLabel ? (
								<>
									<span className="sr-only">{config.label}</span>
									{config.extraNarrowLabel ? (
										<>
											<span
												aria-hidden
												className="inline min-[360px]:hidden medium:hidden"
											>
												{config.extraNarrowLabel}
											</span>
											<span
												aria-hidden
												className="hidden min-[360px]:inline medium:hidden"
											>
												{config.narrowLabel}
											</span>
										</>
									) : (
										<span aria-hidden className="medium:hidden">
											{config.narrowLabel}
										</span>
									)}
									<span aria-hidden className="hidden medium:inline">
										{config.label}
									</span>
								</>
							) : (
								config.label
							)}
						</span>
					</div>
					{metricsIconSlot ? (
						<div className="flex shrink-0 items-center self-center">{metricsIconSlot}</div>
					) : null}
				</div>
			</div>

			<div
				className={cn(
					"flex min-w-0 flex-1 flex-col gap-3 min-[400px]:gap-3 medium:gap-4",
					compact ? "min-h-0" : "min-h-[118px]",
					!compact && "flex-row items-center",
				)}
			>
				<div
					className={cn(
						"flex min-w-0 flex-1 gap-2 min-[400px]:gap-3 medium:gap-4",
						compact && performanceTile ? "items-stretch" : "items-center",
						compact && performanceTile
							? "rounded-xl border border-border/60 bg-muted/[0.62] p-3 dark:border-white/[0.11] dark:bg-muted/[0.36]"
							: "",
						compact ? "min-h-0" : "",
					)}
				>
				<div
					className="relative flex-shrink-0 self-center"
					style={{ width: ringSize, height: ringSize }}
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={coverage}
					aria-valuetext={coverageAriaValueText}
					aria-labelledby={titleId}
				>
					<svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden>
						<circle
							cx={ringCenter}
							cy={ringCenter}
							r={radius}
							strokeWidth={strokeWidth}
							fill="none"
							className="stroke-border/70 dark:stroke-border/55"
						/>
						<circle
							cx={ringCenter}
							cy={ringCenter}
							r={radius}
							strokeWidth={strokeWidth}
							fill="none"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={dashOffset}
							className={cn(
								"motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
								config.ringColor,
							)}
						/>
					</svg>
					<div
						className="absolute inset-0 flex flex-col items-center justify-center gap-px px-1"
						aria-hidden
					>
						{compact ? (
							<>
								<span className="font-semibold leading-none text-foreground tabular-nums text-sm medium:text-[0.9375rem]">
									{topicsTotal === 0 ? 0 : topicsAttempted} / {topicsTotal}
								</span>
								<span className="max-w-[5.5rem] text-center text-[0.625rem] leading-tight tracking-tight text-muted-foreground">
									{topicsTotal === 0 ? "topics · none in catalog" : "topics"}
								</span>
							</>
						) : (
							<>
								<span
									className={cn(
										"font-semibold leading-none text-foreground tabular-nums",
										"text-2xl medium:text-[1.65rem]",
									)}
								>
									{coverage}%
								</span>
								<span className="text-[0.65rem] uppercase leading-none tracking-wider text-muted-foreground">
									Coverage
								</span>
							</>
						)}
					</div>
				</div>

				<div
					className={cn(
						"flex min-w-0 flex-1 self-stretch",
						compact && performanceTile && "border-border/50 border-s ps-3 ms-0.5 medium:ps-4 medium:ms-1",
					)}
				>
					<div
						className={cn(
							"flex w-full min-w-0 flex-col justify-center",
							compact ? "gap-2.5" : "gap-y-2",
							compact && !performanceTile && "items-end",
						)}
						role="group"
						aria-label={
							performanceTile
								? "Last test, coverage, tests taken, average score, topic mastery mix"
								: compact
									? "Tests and average score"
									: "Practice stats"
						}
					>
						{performanceTile ? (
							<>
								{performanceQuietStart ? (
									<div className="flex w-full flex-col gap-2.5">
										<div className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
											<div className="flex min-w-0 flex-col gap-1">
												<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
													Tests taken
												</span>
												<span className="text-lg font-semibold tabular-nums leading-none text-foreground medium:text-xl">
													{testsTaken}
												</span>
											</div>
											<div className="flex min-w-0 flex-col items-end gap-1 text-right">
												<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
													Avg score
												</span>
												<span
													className="text-lg font-semibold tabular-nums leading-none text-muted-foreground medium:text-xl"
													aria-label={avgScoreAria}
												>
													—
												</span>
											</div>
										</div>
										<p className="m-0 text-[0.65rem] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
											{topicsTotal > 0
												? `Syllabus lists ${topicsTotal} topics. Open this subject to try one and build your average.`
												: "Open this subject to see topics for your grade."}
										</p>
									</div>
								) : (
									<div className="grid w-full grid-cols-2 gap-x-3 gap-y-2">
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
												Last test
											</span>
											<span className="truncate text-sm font-semibold tabular-nums text-foreground medium:text-[0.9375rem]">
												{lastTestDate.trim() ? lastTestDate : "—"}
											</span>
										</div>
										<div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
											<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
												Coverage
											</span>
											<span className="text-sm font-semibold tabular-nums text-foreground medium:text-[0.9375rem]">
												{topicsTotal > 0 ? `${coverage}%` : "—"}
											</span>
										</div>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
												Tests
											</span>
											<span className="text-sm font-semibold tabular-nums text-foreground medium:text-[0.9375rem]">
												{testsTaken}
											</span>
										</div>
										<div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
											<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
												Avg
											</span>
											<span
												className={cn(
													"text-sm font-semibold tabular-nums medium:text-[0.9375rem]",
													showScorePercent ? config.scoreColor : "text-muted-foreground",
												)}
												aria-label={avgScoreAria}
											>
												{showScorePercent ? `${avgScore}%` : "—"}
											</span>
										</div>
									</div>
								)}
								{performanceQuietStart ? null : <TopicMasteryBar counts={topicStatusCounts} />}
							</>
						) : (
							<>
								{!compact ? (
									<div
										className={cn(
											"flex min-w-0 items-baseline justify-between gap-x-3",
											"py-0.5",
										)}
									>
										<span className="shrink-0 text-xs text-muted-foreground medium:text-[0.8125rem]">
											Topics
										</span>
										<span className="min-w-0 truncate text-right text-sm font-medium tabular-nums text-foreground medium:text-[0.9375rem]">
											{topicsAttempted} / {topicsTotal}
										</span>
									</div>
								) : null}
								{compact ? (
									<div className="flex flex-col items-end gap-0.5 text-right">
										<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
											Tests taken
										</span>
										<span className="text-sm font-semibold tabular-nums text-foreground medium:text-[0.9375rem]">
											{testsTaken}
										</span>
									</div>
								) : (
									<div
										className={cn(
											"flex min-w-0 items-baseline justify-between gap-x-3",
											"py-0.5",
										)}
									>
										<span className="shrink-0 text-xs text-muted-foreground medium:text-[0.8125rem]">
											Tests taken
										</span>
										<span className="min-w-0 text-right text-sm font-medium tabular-nums text-foreground medium:text-[0.9375rem]">
											{testsTaken}
										</span>
									</div>
								)}
								{!compact || showScorePercent ? (
									compact ? (
										<div className="flex flex-col items-end gap-0.5 text-right">
											<span className="text-[0.6875rem] font-medium leading-none text-muted-foreground">
												Avg score
											</span>
											<span
												className={cn(
													"text-sm font-semibold tabular-nums medium:text-[0.9375rem]",
													config.scoreColor,
												)}
												aria-label={avgScoreAria}
											>
												{showScorePercent ? `${avgScore}%` : "—"}
											</span>
										</div>
									) : (
										<div
											className={cn(
												"flex min-w-0 items-baseline justify-between gap-x-3",
												"py-0.5",
											)}
										>
											<span className="shrink-0 text-xs text-muted-foreground medium:text-[0.8125rem]">
												Avg score
											</span>
											<span
												className={cn(
													"text-right text-sm font-medium tabular-nums medium:text-[0.9375rem]",
													config.scoreColor,
												)}
												aria-label={avgScoreAria}
											>
												{showScorePercent ? `${avgScore}%` : "—"}
											</span>
										</div>
									)
								) : null}
							</>
						)}
					</div>
				</div>
				</div>
			</div>

			{showCta ? (
				<Button
					variant="secondary"
					size="sm"
					onClick={ctaRender ? undefined : onCtaClick}
					render={ctaRender}
					className={cn(dashboardSubjectCardCtaClassName, "mt-auto w-full shrink-0")}
				>
					{ctaLabel ?? config.defaultCta}
				</Button>
			) : showLinkedTileHint ? (
				<div
					className={cn(
						"mt-auto flex shrink-0 items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/[0.62] px-3 py-2.5 medium:px-3.5 dark:border-white/[0.11] dark:bg-muted/[0.36]",
						"motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
						"group-hover/tile:border-emerald-500/40 group-hover/tile:bg-emerald-500/[0.06] group-hover/tile:shadow-[0_1px_0_0_rgba(16,185,129,0.12)]",
						"dark:group-hover/tile:border-emerald-400/35 dark:group-hover/tile:bg-emerald-400/[0.07]",
					)}
					aria-hidden
				>
					<span className="text-xs font-medium text-muted-foreground group-hover/tile:text-foreground">
						View topic breakdown
					</span>
					<span className="flex items-center gap-0.5 text-xs font-semibold text-foreground/80 group-hover/tile:text-emerald-700 group-focus-within/tile:text-emerald-700 dark:group-hover/tile:text-emerald-400 dark:group-focus-within/tile:text-emerald-400">
						Open
						<ChevronRight className="size-3.5 opacity-80 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100" strokeWidth={2} />
					</span>
				</div>
			) : null}
		</div>
	);
}

export function deriveSubjectStatus(coverage: number, avgScore: number): SubjectStatus {
	if (avgScore < 40 || coverage < 40) return "needs_attention";
	if (avgScore < 75 || coverage < 80) return "in_progress";
	return "on_track";
}

export function subjectStatusLabelToDashboardStatus(label: SubjectStatusLabel): SubjectStatus {
	if (label === "Strong") return "on_track";
	if (label === "Strengthen") return "needs_attention";
	return "in_progress";
}
