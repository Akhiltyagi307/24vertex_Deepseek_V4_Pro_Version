/**
 * Renders immediately during student-segment navigations so the shell isn't blank
 * while the layout's auth + entitlement queries resolve.
 */
export default function StudentLoading() {
	return (
		<div className="flex w-full flex-col gap-6 px-4 py-6 medium:px-6 xl:px-8">
			<div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
			<div className="grid grid-cols-1 gap-4 medium:grid-cols-2 xl:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="h-28 w-full animate-pulse rounded-lg bg-muted" />
				))}
			</div>
			<div className="h-72 w-full animate-pulse rounded-lg bg-muted" />
		</div>
	);
}
