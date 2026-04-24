import { cn } from "@/lib/utils";

type Props = {
	daysLeft: number;
	daysTotal: number;
	size?: number;
	className?: string;
	label?: string;
};

/**
 * Signature motif for the billing surfaces — a single accent-stroked donut
 * that reveals itself on mount via `stroke-dasharray`. Users on
 * `prefers-reduced-motion` see the final state with no transition.
 */
export function TrialRing({ daysLeft, daysTotal, size = 56, className, label }: Props) {
	const safeTotal = Math.max(1, daysTotal);
	const safeLeft = Math.min(safeTotal, Math.max(0, daysLeft));
	const consumed = safeTotal - safeLeft;
	const stroke = 4;
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = consumed / safeTotal;
	const offset = circumference * (1 - progress);
	const accessibleLabel =
		label ?? `${safeLeft} day${safeLeft === 1 ? "" : "s"} left of ${safeTotal}-day trial`;

	return (
		<div
			role="img"
			aria-label={accessibleLabel}
			className={cn("relative inline-flex items-center justify-center", className)}
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				className="-rotate-90"
				aria-hidden
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					className="text-muted"
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					className="text-primary motion-safe:[transition:stroke-dashoffset_700ms_cubic-bezier(0.23,1,0.32,1)_120ms]"
				/>
			</svg>
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
				<span
					className="font-heading text-base font-semibold tabular-nums tracking-tight"
					aria-hidden
				>
					{safeLeft}
				</span>
				<span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground" aria-hidden>
					{safeLeft === 1 ? "day" : "days"}
				</span>
			</div>
		</div>
	);
}
