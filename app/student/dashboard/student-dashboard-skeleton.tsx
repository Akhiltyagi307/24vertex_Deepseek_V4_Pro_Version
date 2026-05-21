import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";
import { cardSurfaceFrameClassName } from "@/components/ui/card";

/** RSC Suspense fallback while dashboard data loads. */
export function StudentDashboardSkeleton() {
	return (
		<div className="flex flex-col gap-8 py-6 medium:py-8" aria-busy aria-label="Loading dashboard">
			<div className="flex shrink-0 flex-col gap-1.5">
				<Skeleton className="h-9 w-48 max-w-full" />
				<div className={pageHeaderSubtextScrollClass}>
					<Skeleton className={cn("h-5 w-full max-w-md", pageHeaderSubtextTextClass)} />
				</div>
			</div>
			<section className="flex flex-col gap-3">
				<Skeleton className="h-4 w-28" />
				<div className="grid gap-4 medium:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className={cn("h-28 rounded-xl", cardSurfaceFrameClassName)} />
					))}
				</div>
			</section>
			<section className="flex flex-col gap-3">
				<Skeleton className="h-4 w-44" />
				<div className="grid grid-cols-1 gap-6 medium:grid-cols-2 medium:items-stretch">
					<Skeleton className={cn("min-h-[320px] rounded-xl medium:min-h-[360px]", cardSurfaceFrameClassName)} />
					<Skeleton className={cn("min-h-[320px] rounded-xl medium:min-h-[360px]", cardSurfaceFrameClassName)} />
				</div>
			</section>
		</div>
	);
}
