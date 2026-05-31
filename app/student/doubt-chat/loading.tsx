import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chat-shaped skeleton (sidebar rail + conversation area). Without this, the
 * doubt-chat route falls back to the student dashboard skeleton, which flashes
 * KPI cards before snapping to the chat layout.
 */
export default function StudentDoubtChatLoading() {
	return (
		<div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden medium:flex-row">
			<div className="border-border/60 hidden h-full w-72 shrink-0 flex-col gap-3 border-r p-4 medium:flex">
				<Skeleton className="h-9 w-full" />
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-14 w-full rounded-lg" />
				))}
			</div>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="border-border/60 flex shrink-0 items-center gap-3 border-b px-4 py-3 medium:px-6">
					<Skeleton className="size-8 rounded-lg" />
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-3 w-24" />
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col gap-6 px-4 py-6 medium:px-6">
					<Skeleton className="h-16 w-2/3 self-end rounded-2xl" />
					<Skeleton className="h-24 w-3/4 rounded-2xl" />
					<Skeleton className="h-16 w-1/2 self-end rounded-2xl" />
				</div>
				<div className="px-4 py-4 medium:px-6">
					<Skeleton className="h-12 w-full rounded-xl" />
				</div>
			</div>
		</div>
	);
}
