import { Skeleton } from "@/components/ui/skeleton";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { cn } from "@/lib/utils";

/** Subscription-shaped skeleton: header, plan cards, payment history. */
export default function StudentSubscriptionLoading() {
	return (
		<div className={cn("min-w-0 py-6 medium:py-8", studentHubPageShellClassName)}>
			<div className="flex w-full min-w-0 flex-col gap-8">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-9 w-56" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<div className="grid grid-cols-1 gap-4 medium:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-64 w-full rounded-xl" />
					))}
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-5 w-36" />
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}
