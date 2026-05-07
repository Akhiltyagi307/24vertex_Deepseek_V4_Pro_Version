import { Skeleton } from "@/components/ui/skeleton";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** RSC Suspense fallback while the reports table query runs. */
export function StudentReportsSkeleton() {
	return (
		<div className="flex flex-col gap-6 py-6 medium:py-8" aria-busy aria-label="Loading reports">
			<div className="flex shrink-0 flex-col gap-1.5">
				<Skeleton className="h-9 w-48 max-w-full" />
				<Skeleton className="h-5 w-full max-w-md" />
			</div>
			<div className={cn(cardSurfaceFrameClassName, "flex min-h-[480px] flex-col gap-3 p-6")}>
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-24" />
				</div>
				<div className="flex flex-col gap-2">
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} className="h-12 w-full rounded-md" />
					))}
				</div>
			</div>
		</div>
	);
}
