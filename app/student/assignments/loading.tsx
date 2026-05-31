import { Skeleton } from "@/components/ui/skeleton";
import { studentMainPageShellClassName } from "@/lib/student/student-hub-page-layout";

/** Kanban-shaped skeleton (three columns) matching the assignments board. */
export default function StudentAssignmentsLoading() {
	return (
		<div className={studentMainPageShellClassName}>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-4 w-96 max-w-full" />
			</div>
			<div className="grid grid-cols-1 gap-4 medium:grid-cols-3">
				{Array.from({ length: 3 }).map((_, col) => (
					<div key={col} className="flex flex-col gap-3">
						<Skeleton className="h-6 w-28" />
						{Array.from({ length: 3 }).map((_, card) => (
							<Skeleton key={card} className="h-28 w-full rounded-lg" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}
