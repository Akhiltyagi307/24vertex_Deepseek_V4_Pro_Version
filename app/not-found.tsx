import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
			<div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
				<div className="space-y-2">
					<p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">404</p>
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						We can&rsquo;t find that page.
					</h1>
					<p className="text-sm text-muted-foreground">
						The link may be broken or the page may have moved. Let&rsquo;s get you back on track.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link href="/" className={cn(buttonVariants({ variant: "default", size: "default" }))}>
						Go home
					</Link>
					<Link
						href="/student/dashboard"
						className={cn(buttonVariants({ variant: "outline", size: "default" }))}
					>
						My dashboard
					</Link>
				</div>
			</div>
		</div>
	);
}
