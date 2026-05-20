/**
 * Skeleton for the public landing page. Mirrors `LandingMarketingBody`'s hero
 * shape so layout doesn't shift on hydration.
 */
export default function PublicLoading() {
	return (
		<div
			aria-busy="true"
			aria-label="Loading"
			className="min-h-screen w-full bg-background"
		>
			<div className="box-border min-h-screen min-w-0 w-full" style={{ paddingInline: "10%" }}>
				<div className="flex min-h-screen flex-col items-center justify-center gap-6 py-16">
					<div className="h-3 w-24 animate-pulse rounded bg-muted/60" />
					<div className="h-14 w-3/4 max-w-2xl animate-pulse rounded bg-muted/70" />
					<div className="h-14 w-2/3 max-w-xl animate-pulse rounded bg-muted/70" />
					<div className="mt-4 h-5 w-1/2 max-w-md animate-pulse rounded bg-muted/40" />
					<div className="mt-6 flex gap-3">
						<div className="h-11 w-32 animate-pulse rounded-lg bg-muted/70" />
						<div className="h-11 w-32 animate-pulse rounded-lg bg-muted/40" />
					</div>
				</div>
			</div>
		</div>
	);
}
