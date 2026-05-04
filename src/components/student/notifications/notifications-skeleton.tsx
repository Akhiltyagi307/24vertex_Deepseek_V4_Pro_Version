import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between border-b border-border pb-3">
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-16 rounded-full" />
					<Skeleton className="h-8 w-20 rounded-full" />
				</div>
				<Skeleton className="h-7 w-32" />
			</div>
			<ul className="flex flex-col gap-2" aria-hidden>
				{[0, 1, 2, 3].map((i) => (
					<li
						key={i}
						className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 ring-1 ring-foreground/5"
					>
						<Skeleton className="size-8 rounded-lg" />
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-1/3" />
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
