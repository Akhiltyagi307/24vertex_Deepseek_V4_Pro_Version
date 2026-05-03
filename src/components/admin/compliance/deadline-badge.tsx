import { cn } from "@/lib/utils";

/** Server or client: uses current time at render (avoid in long-lived client-only trees). */
export function DeadlineBadge({ dueAt }: { dueAt: Date | string | null }) {
	if (!dueAt) return <span className="text-xs text-muted-foreground">No deadline</span>;
	const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
	// Relative to request render time (server lists / infrequent client re-renders).
	// eslint-disable-next-line react-hooks/purity -- wall clock for SLA badge
	const now = Date.now();
	const ms = d.getTime() - now;
	const days = ms / (24 * 60 * 60 * 1000);
	const overdue = ms < 0;
	const urgent = !overdue && days <= 7;

	return (
		<span
			className={cn(
				"inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
				overdue && "bg-destructive/15 text-destructive",
				urgent && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
				!overdue && !urgent && "bg-muted text-muted-foreground",
			)}
		>
			{overdue ? "Overdue" : `${Math.max(0, Math.ceil(days))}d left`}
		</span>
	);
}
