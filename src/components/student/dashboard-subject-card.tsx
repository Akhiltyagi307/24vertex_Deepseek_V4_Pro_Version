"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

/** Frame + hover/focus ring; padding comes from `SubjectCard` (`default` vs `compact`). */
export const dashboardSubjectCardSurfaceClassName = cn(
	cardSurfaceFrameClassName,
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
	/** No attempts yet: warm, non-alarming cue (Performance / dashboard cold start). */
	ready_to_start: {
		label: "Ready when you are",
		narrowLabel: "When ready",
		extraNarrowLabel: "Ready",
		dotColor: "bg-primary/55",
		textColor: "text-primary",
		ringColor: "stroke-primary/35",
		scoreColor: "text-muted-foreground",
		defaultCta: "Open this subject",
	},
};

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

	const ringSize = compact ? 96 : 118;
	const ringCenter = ringSize / 2;
	const radius = compact ? 38 : 48;
	const strokeWidth = compact ? 6 : 7;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - coverage / 100);
	const metaLine = subtitle ?? `Last test · ${lastTestDate}`;
	const showScorePercent = status !== "ready_to_start";
	const avgScoreAria = showScorePercent
		? `${avgScore}%`
		: "No tests yet, no average score yet";

	return (
		<div
			className={cn(
				dashboardSubjectCardSurfaceClassName,
				compact ? "p-4" : "p-5",
				"flex h-full flex-col",
				compact ? "gap-2" : "gap-3",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1 pr-1">
					<h3
						id={titleId}
						className="m-0 truncate text-sm font-semibold leading-snug text-foreground"
						title={subject}
					>
						{subject}
					</h3>
					<p
						className={cn(
							"m-0 text-xs text-muted-foreground leading-snug",
							compact ? "line-clamp-2 [overflow-wrap:anywhere]" : "truncate",
						)}
						title={metaLine}
					>
						{metaLine}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 self-start pt-0.5 min-[360px]:gap-2.5">
					<div className="flex min-w-0 max-w-[11rem] items-center justify-end gap-1.5 sm:max-w-[13.5rem]">
						<span
							className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotColor)}
							aria-hidden
						/>
						<span
							className={cn(
								"text-right text-[0.6875rem] font-medium uppercase leading-tight tracking-[0.05em] sm:text-xs sm:tracking-[0.06em]",
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
												className="inline min-[360px]:hidden sm:hidden"
											>
												{config.extraNarrowLabel}
											</span>
											<span
												aria-hidden
												className="hidden min-[360px]:inline sm:hidden"
											>
												{config.narrowLabel}
											</span>
										</>
									) : (
										<span aria-hidden className="sm:hidden">
											{config.narrowLabel}
										</span>
									)}
									<span aria-hidden className="hidden sm:inline">
										{config.label}
									</span>
								</>
							) : (
								config.label
							)}
						</span>
					</div>
					{metricsIconSlot ? <div className="shrink-0">{metricsIconSlot}</div> : null}
				</div>
			</div>

			<div
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 min-[400px]:gap-3 sm:gap-4",
					compact ? "min-h-[96px]" : "min-h-[118px]",
				)}
			>
				<div
					className="relative flex-shrink-0"
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
							className="stroke-border/60"
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
						className="absolute inset-0 flex flex-col items-center justify-center gap-px"
						aria-hidden
					>
						<span
							className={cn(
								"font-semibold leading-none text-foreground tabular-nums",
								compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-[1.65rem]",
							)}
						>
							{coverage}%
						</span>
						<span
							className={cn(
								"uppercase leading-none tracking-wider text-muted-foreground",
								compact ? "text-[0.6rem]" : "text-[0.65rem]",
							)}
						>
							Coverage
						</span>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 self-stretch">
					<div
						className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 sm:gap-x-5"
						role="group"
						aria-label="Practice stats"
					>
						<span
							className={cn(
								"border-b border-border/50 text-xs text-muted-foreground sm:text-[0.8125rem]",
								compact ? "py-1.5" : "py-2",
							)}
						>
							Topics
						</span>
						<span
							className={cn(
								"border-b border-border/50 text-right text-sm font-medium tabular-nums text-foreground sm:text-[0.9375rem]",
								compact ? "py-1.5" : "py-2",
							)}
						>
							{topicsAttempted} / {topicsTotal}
						</span>
						<span
							className={cn(
								"border-b border-border/50 text-xs text-muted-foreground sm:text-[0.8125rem]",
								compact ? "py-1.5" : "py-2",
							)}
						>
							Tests taken
						</span>
						<span
							className={cn(
								"border-b border-border/50 text-right text-sm font-medium tabular-nums text-foreground sm:text-[0.9375rem]",
								compact ? "py-1.5" : "py-2",
							)}
						>
							{testsTaken}
						</span>
						<span className={cn("text-xs text-muted-foreground sm:text-[0.8125rem]", compact ? "py-1.5" : "py-2")}>
							Avg score
						</span>
						<span
							className={cn(
								"text-right text-sm font-medium tabular-nums sm:text-[0.9375rem]",
								compact ? "py-1.5" : "py-2",
								config.scoreColor,
							)}
							aria-label={avgScoreAria}
						>
							{showScorePercent ? `${avgScore}%` : "—"}
						</span>
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
	if (label === "Good") return "on_track";
	if (label === "Bad") return "needs_attention";
	return "in_progress";
}
