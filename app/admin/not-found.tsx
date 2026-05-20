import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Page not found · EduAI Admin",
	robots: { index: false, follow: false },
};

/**
 * D29: admin-scoped 404 page. Sits one level above `(authenticated)` so the
 * full admin shell is bypassed (the shell layout calls `requireAdmin()` and
 * a stray slug shouldn't trigger an auth redirect). Renders a minimal page
 * with a link back to the admin dashboard.
 */
export default function AdminNotFound() {
	return (
		<main
			id="admin-not-found"
			className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
		>
			<h1 className="text-3xl font-semibold">404 — Admin page not found</h1>
			<p className="max-w-prose text-muted-foreground">
				The admin route you visited does not exist. It may have been moved or
				renamed during a recent release.
			</p>
			<div className="flex gap-3">
				<Button render={<Link href="/admin/dashboard">Back to dashboard</Link>} />
				<Button
					variant="outline"
					render={<Link href="/admin/audit">Open audit log</Link>}
				/>
			</div>
		</main>
	);
}
