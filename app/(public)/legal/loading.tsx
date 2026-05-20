export default function LegalLoading() {
	return (
		<main
			aria-busy="true"
			aria-label="Loading legal page"
			className="w-full min-w-0 max-w-none px-4 py-12 text-foreground medium:px-8"
		>
			<div className="mb-6 flex items-center justify-between">
				<div className="h-5 w-16 animate-pulse rounded bg-muted/60" />
				<div className="h-4 w-28 animate-pulse rounded bg-muted/60" />
			</div>
			<div className="h-8 w-2/3 animate-pulse rounded bg-muted/70" />
			<div className="mt-3 h-4 w-40 animate-pulse rounded bg-muted/50" />
			<div className="mt-8 space-y-3">
				<div className="h-4 w-full animate-pulse rounded bg-muted/40" />
				<div className="h-4 w-11/12 animate-pulse rounded bg-muted/40" />
				<div className="h-4 w-10/12 animate-pulse rounded bg-muted/40" />
				<div className="h-4 w-full animate-pulse rounded bg-muted/40" />
				<div className="h-4 w-9/12 animate-pulse rounded bg-muted/40" />
				<div className="h-4 w-11/12 animate-pulse rounded bg-muted/40" />
			</div>
		</main>
	);
}
