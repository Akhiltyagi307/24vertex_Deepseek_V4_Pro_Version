import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AccountIncompletePage() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-2 text-center">
				<h1 className="text-2xl font-bold tracking-tight">Account could not be loaded</h1>
				<p className="text-balance text-sm text-muted-foreground">
					Your session is active, but we could not load your portal profile. Common causes are
					out-of-date database migrations (run the latest Supabase migrations) or a brief database
					error. If it persists, check the dev server log for{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">getCachedAppProfileRow</code>,
					then sign out and try again.
				</p>
			</div>
			<div className="flex flex-col gap-3 medium:flex-row medium:justify-center">
				<SignOutButton />
				<Link
					href="/"
					className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
				>
					Home
				</Link>
			</div>
		</div>
	);
}
