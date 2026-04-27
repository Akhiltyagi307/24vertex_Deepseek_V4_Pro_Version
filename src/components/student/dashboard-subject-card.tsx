"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import type { SubjectStatusLabel } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

/** Matches dashboard `Card`: `bg-card`, `border-border`, same ring treatment. */
export const dashboardSubjectCardSurfaceClassName = cn(
	"rounded-xl border border-border bg-card p-[22px] text-card-foreground ring-1 ring-foreground/10",
	"transition-colors hover:border-border/80",
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
	className,
}: SubjectCardProps) {
	const config = STATUS_CONFIG[status];
	const coverage =
		topicsTotal > 0 ? Math.round((topicsAttempted / topicsTotal) * 100) : 0;

	const radius = 36;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - coverage / 100);

	return (
		<div className={cn(dashboardSubjectCardSurfaceClassName, "flex h-full flex-col", className)}>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className="m-0 text-sm font-semibold leading-snug text-foreground">{subject}</h3>
					<p className="m-0 text-xs text-muted-foreground leading-snug">
						{subtitle ?? `Last test · ${lastTestDate}`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5 pt-0.5">
					<span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
					<span
						className={cn(
							"text-xs font-medium uppercase tracking-[0.06em]",
							config.textColor,
						)}
					>
						{config.label}
					</span>
				</div>
			</div>

			<div className="my-1 flex flex-1 items-center gap-2.5 sm:gap-3">
				<div className="relative h-[84px] w-[84px] flex-shrink-0">
					<svg width="84" height="84" className="-rotate-90" aria-hidden>
						<circle
							cx="42"
							cy="42"
							r={radius}
							strokeWidth="6"
							fill="none"
							className="stroke-border/60"
						/>
						<circle
							cx="42"
							cy="42"
							r={radius}
							strokeWidth="6"
							fill="none"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={dashOffset}
							className={cn(
								"transition-[stroke-dashoffset] duration-500",
								config.ringColor,
							)}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
						<span className="text-xl font-semibold leading-none text-foreground tabular-nums">
							{coverage}%
						</span>
						<span className="text-[0.65rem] uppercase leading-none tracking-wider text-muted-foreground">Done</span>
					</div>
				</div>

				<div className="flex min-w-0 flex-1 justify-end">
					<div
						className="grid w-max max-w-full grid-cols-[auto_auto] items-baseline gap-x-3"
						role="group"
						aria-label="Subject progress"
					>
						<span className="border-b border-border/50 py-1.5 text-xs text-muted-foreground">Topics</span>
						<span className="border-b border-border/50 py-1.5 text-right text-sm font-medium tabular-nums text-foreground">
							{topicsAttempted} / {topicsTotal}
						</span>
						<span className="border-b border-border/50 py-1.5 text-xs text-muted-foreground">Tests taken</span>
						<span className="border-b border-border/50 py-1.5 text-right text-sm font-medium tabular-nums text-foreground">
							{testsTaken}
						</span>
						<span className="py-1.5 text-xs text-muted-foreground">Avg score</span>
						<span
							className={cn(
								"py-1.5 text-right text-sm font-medium tabular-nums",
								config.scoreColor,
							)}
						>
							{avgScore}%
						</span>
					</div>
				</div>
			</div>

			<Button
				variant="secondary"
				size="sm"
				onClick={ctaRender ? undefined : onCtaClick}
				render={ctaRender}
				className={cn(dashboardSubjectCardCtaClassName, "mt-3 w-full")}
			>
				{ctaLabel ?? config.defaultCta}
			</Button>
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
