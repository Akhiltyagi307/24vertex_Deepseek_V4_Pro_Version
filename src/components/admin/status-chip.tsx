import { cn } from "@/lib/utils";

const variants = {
	good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
	warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
	bad: "bg-destructive/15 text-destructive",
	neutral: "bg-muted text-muted-foreground",
	info: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
	critical: "bg-destructive/20 text-destructive font-medium",
} as const;

export type StatusChipVariant = keyof typeof variants;

export function StatusChip({ status, label, className }: { status: StatusChipVariant; label: string; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
				variants[status],
				className,
			)}
		>
			<span className="size-2 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
			{label}
		</span>
	);
}
