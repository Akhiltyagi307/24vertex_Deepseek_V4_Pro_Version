"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function LegalErrorBoundary({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error, {
			tags: { route: "public/legal" },
			extra: { digest: error.digest },
		});
	}, [error]);

	return (
		<main className="w-full min-w-0 max-w-none px-4 py-12 text-foreground medium:px-8">
			<div className="mx-auto max-w-2xl">
				<h1 className="text-2xl font-semibold tracking-tight">This page is having trouble loading</h1>
				<p className="mt-3 text-sm text-muted-foreground">
					Something went wrong rendering this legal page. The issue has been logged. You can try again, or
					head back to the home page.
				</p>
				<div className="mt-6 flex flex-wrap gap-3 text-sm">
					<button
						type="button"
						onClick={reset}
						className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-muted"
					>
						Try again
					</button>
					<Link
						href="/"
						className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-link underline-offset-4 hover:underline"
					>
						Go home
					</Link>
				</div>
				{error.digest ? (
					<p className="mt-6 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
				) : null}
			</div>
		</main>
	);
}
