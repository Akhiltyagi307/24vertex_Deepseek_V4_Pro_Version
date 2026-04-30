import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { pageHeaderSubtextScrollClass, pageHeaderSubtextTextClass } from "@/components/student/page-header-subtext";

/** RSC Suspense fallback while practice hub data loads. */
export function StudentPracticeSkeleton() {
	return (
		<div className="w-full min-w-0 py-6 md:py-8" aria-busy aria-label="Loading practice">
			<div className="flex shrink-0 flex-col gap-1.5">
				<Skeleton className="h-9 w-44 max-w-full" />
				<div className={pageHeaderSubtextScrollClass}>
					<Skeleton className={cn("h-5 w-full max-w-lg", pageHeaderSubtextTextClass)} />
				</div>
			</div>
			<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-36 rounded-xl border border-border/60" />
				))}
			</div>
		</div>
	);
}
