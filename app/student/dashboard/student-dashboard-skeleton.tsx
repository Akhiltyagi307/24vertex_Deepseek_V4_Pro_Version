import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";
import { cardSurfaceFrameClassName } from "@/components/ui/card";

/** RSC Suspense fallback while dashboard data loads. */
export function StudentDashboardSkeleton() {
	return (
		<div className="flex flex-col gap-8 py-6 md:py-8" aria-busy aria-label="Loading dashboard">
			<div className="flex shrink-0 flex-col gap-1.5">
				<Skeleton className="h-9 w-48 max-w-full" />
				<div className={pageHeaderSubtextScrollClass}>
					<Skeleton className={cn("h-5 w-full max-w-md", pageHeaderSubtextTextClass)} />
				</div>
			</div>
			<section className="flex flex-col gap-3">
				<Skeleton className="h-4 w-28" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className={cn("h-28 rounded-xl", cardSurfaceFrameClassName)} />
					))}
				</div>
			</section>
			<div className={cn(cardSurfaceFrameClassName, "flex min-h-[200px] flex-col gap-4 bg-muted/20 p-6")}>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-[160px] w-full rounded-lg" />
			</div>
		</div>
	);
}
