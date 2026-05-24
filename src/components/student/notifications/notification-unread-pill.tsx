import { cn } from "@/lib/utils";

/** iOS system red for notification badges (matches top-bar bell) */
export const IOS_SIDEBAR_BADGE =
	"bg-[#FF3B30] text-white ring-2 ring-sidebar dark:ring-sidebar";

const IOS_BADGE = IOS_SIDEBAR_BADGE;

/**
 * Red dot (no count) for sidebar attention states (e.g. open assignments).
 * Parent should be `position: relative` on the icon wrapper.
 */
export function SidebarAttentionDot({ show }: { show: boolean }) {
	if (!show) return null;
	return (
		<span
			aria-hidden
			className={cn(
				"pointer-events-none absolute -right-0.5 -top-0.5 z-10 size-2.5 rounded-full shadow-sm",
				IOS_SIDEBAR_BADGE,
			)}
		/>
	);
}

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
