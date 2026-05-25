import { Skeleton } from "@/components/ui/skeleton";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StudentDashboardLeaderboardSkeleton() {
	return (
		<Skeleton
			className={cn("h-full min-h-[280px] w-full rounded-xl", cardSurfaceFrameClassName)}
			aria-busy
			aria-label="Loading leaderboard"
		/>
	);
}
