"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * Quota / progress meter shared across billing UI surfaces. Used in the
 * sidebar plan card and the doubt-chat composer.
 *
 * Bar color (state-driven, same in both surfaces):
 *   - 0–79%   → primary (calm)
 *   - 80–99%  → amber (warn before paywall)
 *   - 100%+   → rose (depleted)
 *
 * `surface` selects the text-color tokens. `"sidebar"` uses
 * `text-sidebar-foreground/*` so the meter sits cleanly inside the sidebar's
 * own theme; `"default"` uses the document-level `text-foreground` /
 * `text-muted-foreground` tokens for in-flow contexts (e.g. the doubt-chat
 * composer footer). The original sidebar implementation used the sidebar
 * tokens — restoring that here so the sidebar plan card doesn't visually
 * regress after the component was extracted.
 */
export function AnimatedMeter({
	label,
	display,
	pct,
	reduceMotion,
	className,
	surface = "default",
}: {
	label: string;
	display: string;
	pct: number;
	reduceMotion: boolean;
	className?: string;
	surface?: "default" | "sidebar";
}) {
	const clamped = Math.max(0, Math.min(100, pct));
	const barColor =
		pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-primary";
	const labelColor =
		surface === "sidebar" ? "text-sidebar-foreground/80" : "text-foreground/80";
	const valueColor =
		surface === "sidebar" ? "text-sidebar-foreground/60" : "text-muted-foreground";

	return (
		<div
			role="meter"
			aria-label={label}
			aria-valuenow={clamped}
			aria-valuemin={0}
			aria-valuemax={100}
			className={cn("flex items-center gap-2 text-[11px] leading-none", className)}
		>
			<span className={cn("w-12 shrink-0 font-medium", labelColor)}>{label}</span>
			<div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
				<motion.div
					className={cn("h-full rounded-full", barColor)}
					initial={{ width: "0%" }}
					animate={{ width: `${clamped}%` }}
					transition={
						reduceMotion
							? { duration: 0 }
							: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }
					}
				/>
			</div>
			<span className={cn("shrink-0 tabular-nums", valueColor)}>{display}</span>
		</div>
	);
}
