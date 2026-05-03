/**
 * Renders immediately during teacher-segment navigations so the shell isn't blank
 * while the layout's auth checks resolve.
 */
export default function TeacherLoading() {
	return (
		<div className="flex w-full flex-col gap-6 px-2 py-6 sm:px-4">
			<div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="h-32 w-full animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		</div>
	);
}
