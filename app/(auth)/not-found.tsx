import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Page not found",
};

/** 404 boundary for /login, /signup, /forgot-password — preserves the auth shell. */
export default function AuthNotFound() {
	return (
		<div className="flex w-full flex-col items-center gap-3 py-6 text-center">
			<p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">404</p>
			<h2 className="text-lg font-semibold tracking-tight">We can&rsquo;t find that page.</h2>
			<p className="text-sm text-muted-foreground">
				The link may be broken or the page may have moved. Head back to log in or start a new
				account.
			</p>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button render={<Link href="/login" />}>Back to log in</Button>
				<Button variant="outline" render={<Link href="/signup/role-picker" />}>
					Create an account
				</Button>
			</div>
		</div>
	);
}
