import { Skeleton } from "@/components/ui/skeleton";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** RSC Suspense fallback while performance bundle loads (subjects + tests + topics). */
export function StudentPerformanceSkeleton() {
	return (
		<div className="flex flex-col gap-6 py-6 medium:py-8" aria-busy aria-label="Loading performance">
			<div className="flex shrink-0 flex-col gap-1.5">
				<Skeleton className="h-9 w-56 max-w-full" />
				<Skeleton className="h-5 w-full max-w-md" />
			</div>
			<div className="grid gap-3 medium:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className={cn("h-40 rounded-xl", cardSurfaceFrameClassName)} />
				))}
			</div>
			<div className={cn(cardSurfaceFrameClassName, "flex min-h-[420px] flex-col gap-4 bg-muted/20 p-6")}>
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-[320px] w-full rounded-lg" />
			</div>
		</div>
	);
}
