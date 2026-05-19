import Link from "next/link";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
	title: "Not found",
	robots: { index: false, follow: false },
};

export default function TeacherNotFound() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
			<div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
				<div className="space-y-2">
					<p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">404</p>
					<h1 className="text-xl font-semibold tracking-tight text-foreground">
						This teacher page doesn&rsquo;t exist.
					</h1>
					<p className="text-sm text-muted-foreground">
						The link may be broken or the page may have moved. Pick up where you left off from the teacher
						dashboard.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link
						href="/teacher/dashboard"
						className={cn(buttonVariants({ variant: "default", size: "default" }))}
					>
						Back to dashboard
					</Link>
					<Link
						href="/teacher/assignments"
						className={cn(buttonVariants({ variant: "outline", size: "default" }))}
					>
						Assignments
					</Link>
				</div>
			</div>
		</div>
	);
}
