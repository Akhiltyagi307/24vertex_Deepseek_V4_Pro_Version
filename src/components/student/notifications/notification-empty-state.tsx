import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

export function NotificationsEmptyState({
	filter,
	className,
}: {
	filter: Filter;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-5 py-10 text-center",
				className,
			)}
		>
			<div className="flex size-11 items-center justify-center rounded-full bg-muted">
				<InboxIcon className="size-5 text-muted-foreground" />
			</div>
			<div className="space-y-1">
				<p className="text-[15px] font-semibold tracking-tight text-foreground">
					{filter === "unread" ? "You're all caught up" : "No notifications yet"}
				</p>
				<p className="text-[13px] leading-snug text-muted-foreground">
					{filter === "unread"
						? "New alerts and report-ready updates will show up here."
						: "Practice reports and plan alerts will appear here as they arrive."}
				</p>
			</div>
		</div>
	);
}
