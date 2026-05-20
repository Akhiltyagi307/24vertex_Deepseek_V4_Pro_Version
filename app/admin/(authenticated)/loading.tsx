import { Skeleton } from "@/components/ui/skeleton";

/**
 * D22 / D28: shared loading skeleton for every page inside the admin shell.
 * Renders an empty page body with a header, breadcrumb, and table-style
 * skeleton. The admin shell (sidebar + topbar) lives in the parent layout,
 * so it remains visible while this skeleton replaces only the page content.
 */
export default function AdminAuthenticatedLoading() {
	return (
		<div className="space-y-6 p-6" aria-busy="true" aria-live="polite">
			<div className="space-y-3">
				<Skeleton className="h-7 w-72" />
				<Skeleton className="h-4 w-96" />
			</div>
			<div className="space-y-2">
				<div className="flex items-center gap-3">
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-9 w-28" />
					<Skeleton className="h-9 w-28" />
					<div className="ml-auto flex gap-2">
						<Skeleton className="h-9 w-24" />
						<Skeleton className="h-9 w-24" />
					</div>
				</div>
				<div className="overflow-hidden rounded-md border">
					<div className="flex border-b bg-muted/40 px-4 py-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="ml-6 h-4 w-32" />
						<Skeleton className="ml-6 h-4 w-28" />
						<Skeleton className="ml-auto h-4 w-16" />
					</div>
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							key={i}
							className="flex items-center border-b px-4 py-3 last:border-b-0"
						>
							<Skeleton className="h-4 w-24" />
							<Skeleton className="ml-6 h-4 w-40" />
							<Skeleton className="ml-6 h-4 w-32" />
							<Skeleton className="ml-auto h-8 w-8 rounded-md" />
						</div>
					))}
				</div>
			</div>
			<span className="sr-only">Loading admin page</span>
		</div>
	);
}
