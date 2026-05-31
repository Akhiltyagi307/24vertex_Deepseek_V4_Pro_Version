import { Skeleton } from "@/components/ui/skeleton";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { cn } from "@/lib/utils";

/** Form-shaped skeleton so navigating to Settings doesn't flash the generic dashboard skeleton. */
export default function StudentSettingsLoading() {
	return (
		<div className={cn("flex min-w-0 flex-col gap-6 py-6 medium:py-8", studentHubPageShellClassName)}>
			<Skeleton className="h-8 w-48" />
			<div className="border-border/60 flex flex-col gap-6 rounded-xl border p-6">
				<Skeleton className="h-5 w-40" />
				<div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex flex-col gap-2">
							<Skeleton className="h-3.5 w-24" />
							<Skeleton className="h-10 w-full" />
						</div>
					))}
				</div>
				<Skeleton className="h-10 w-32" />
			</div>
		</div>
	);
}
