import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = {
	title: "Page not found · Parent",
	robots: { index: false, follow: false },
};

/**
 * Parent-portal scoped 404. Replaces the root not-found when a missing path
 * lands inside /parent/*, so the parent keeps their portal context instead
 * of being bounced to the marketing-site 404 shell.
 */
export default function ParentNotFound() {
	return (
		<main
			role="main"
			className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center"
		>
			<div className="flex flex-col gap-2">
				<p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">404</p>
				<h1 className="text-balance font-semibold text-2xl tracking-tight">
					This parent-portal page doesn&apos;t exist.
				</h1>
				<p className="text-sm leading-relaxed text-muted-foreground">
					The link may be stale or mistyped. Head back to the dashboard, or check your linked
					children if you arrived from an old notification.
				</p>
			</div>
			<div className="flex flex-col gap-2 medium:flex-row">
				<Button render={<Link href="/parent/dashboard" />}>Back to dashboard</Button>
				<Button variant="outline" render={<Link href="/parent/select-student" />}>
					Switch child
				</Button>
			</div>
		</main>
	);
}
