"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

/** Error boundary for /login, /signup, /forgot-password — keeps the auth shell visible. */
export default function AuthError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className="flex w-full flex-col items-center gap-3 py-6 text-center">
			<h2 className="text-lg font-semibold tracking-tight">Sign-in unavailable</h2>
			<p className="text-sm text-muted-foreground">
				Something went wrong loading this form. Try again, or head home.
			</p>
			{error.digest ? (
				<p className="font-mono text-xs text-muted-foreground/70">Reference: {error.digest}</p>
			) : null}
			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button type="button" onClick={reset}>
					Try again
				</Button>
				<Button type="button" variant="outline" render={<Link href="/" />}>
					Go home
				</Button>
			</div>
		</div>
	);
}
