import { cn } from "@/lib/utils";

/** iOS system red for notification badges (matches top-bar bell) */
const IOS_BADGE = "bg-[#FF3B30] text-white ring-2 ring-sidebar dark:ring-sidebar";

/**
 * Red count pill for unread notifications. Parent should be `position: relative`
 * (e.g. icon wrapper or bell button).
 */
export function NotificationUnreadPill({ count }: { count: number }) {
	if (count <= 0) return null;
	const label = count > 99 ? "99+" : String(count);
	return (
		<span
			aria-hidden
			className={cn(
				"pointer-events-none absolute -right-1 -top-1 z-10 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums leading-none shadow-sm",
				IOS_BADGE,
			)}
		>
			{label}
		</span>
	);
}
