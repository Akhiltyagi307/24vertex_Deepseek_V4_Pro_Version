"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

/** Matches shadcn `Card` / shared `cardSurfaceFrameClassName`; subject layout padding + green hover glow. */
export const dashboardSubjectCardSurfaceClassName = cn(
	cardSurfaceFrameClassName,
	"p-[22px]",
	"transition-[border-color,box-shadow] duration-200 ease-out",
	"hover:border-emerald-500/55 hover:shadow-[0_0_28px_-8px_rgba(16,185,129,0.38)]",
	"dark:hover:border-emerald-400/50 dark:hover:shadow-[0_0_30px_-8px_rgba(52,211,153,0.32)]",
);

/** Shared CTA: pair with `variant="secondary"` `size="sm"` — white text on emerald, compact */
export const dashboardSubjectCardCtaClassName = cn(
	"h-8 rounded-lg px-3.5",
	"text-xs font-semibold shadow-sm",
	"border border-emerald-400/35",
);

// ============================================================================
// Types
// ============================================================================

type SubjectStatus = "needs_attention" | "in_progress" | "on_track";

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
}

// ============================================================================
// Status configuration — single source of truth for colors + copy
// ============================================================================

const STATUS_CONFIG: Record<
	SubjectStatus,
	{
		label: string;
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
}: SubjectCardProps) {
	const config = STATUS_CONFIG[status];
	const coverage =
		topicsTotal > 0 ? Math.round((topicsAttempted / topicsTotal) * 100) : 0;

	const ringSize = 118;
	const ringCenter = ringSize / 2;
	const radius = 48;
	const strokeWidth = 7;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - coverage / 100);

	return (
		<div className={cn(dashboardSubjectCardSurfaceClassName, "flex h-full flex-col", className)}>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1 pr-1">
					<h3 className="m-0 text-sm font-semibold leading-snug text-foreground">{subject}</h3>
					<p className="m-0 text-xs text-muted-foreground leading-snug">
						{subtitle ?? `Last test · ${lastTestDate}`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 self-start pt-0.5 min-[360px]:gap-2.5">
					<div className="flex min-w-0 max-w-[9.5rem] items-center justify-end gap-1.5 sm:max-w-[11rem]">
						<span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotColor)} />
						<span
							className={cn(
								"text-right text-[0.6rem] font-medium uppercase leading-tight tracking-[0.05em] sm:text-xs sm:tracking-[0.06em]",
								config.textColor,
							)}
						>
							{config.label}
						</span>
					</div>
					{metricsIconSlot ? <div className="shrink-0">{metricsIconSlot}</div> : null}
				</div>
			</div>

			<div className="my-1 flex min-h-[118px] flex-1 items-center gap-2 min-[400px]:gap-3 sm:gap-4">
				<div
					className="relative flex-shrink-0"
					style={{ width: ringSize, height: ringSize }}
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
							className={cn("transition-[stroke-dashoffset] duration-500", config.ringColor)}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
						<span className="text-2xl font-semibold leading-none text-foreground tabular-nums sm:text-[1.65rem]">
							{coverage}%
						</span>
						<span className="text-[0.65rem] uppercase leading-none tracking-wider text-muted-foreground">
							Done
						</span>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 self-stretch">
					<div
						className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 sm:gap-x-5"
						role="group"
						aria-label="Subject progress"
					>
						<span className="border-b border-border/50 py-2 text-xs text-muted-foreground sm:text-[0.8125rem]">
							Topics
						</span>
						<span className="border-b border-border/50 py-2 text-right text-sm font-medium tabular-nums text-foreground sm:text-[0.9375rem]">
							{topicsAttempted} / {topicsTotal}
						</span>
						<span className="border-b border-border/50 py-2 text-xs text-muted-foreground sm:text-[0.8125rem]">
							Tests taken
						</span>
						<span className="border-b border-border/50 py-2 text-right text-sm font-medium tabular-nums text-foreground sm:text-[0.9375rem]">
							{testsTaken}
						</span>
						<span className="py-2 text-xs text-muted-foreground sm:text-[0.8125rem]">Avg score</span>
						<span
							className={cn(
								"py-2 text-right text-sm font-medium tabular-nums sm:text-[0.9375rem]",
								config.scoreColor,
							)}
						>
							{avgScore}%
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
					className={cn(dashboardSubjectCardCtaClassName, "mt-3 w-full")}
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
