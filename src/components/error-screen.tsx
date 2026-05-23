"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorScreenProps {
	title?: string;
	description?: string;
	error?: Error & { digest?: string };
	reset?: () => void;
	homeHref?: string;
	homeLabel?: string;
	tag?: string;
}

export function ErrorScreen({
	title = "Something went wrong.",
	description = "We hit an unexpected error. The team has been notified. Try again, or head back to where you were.",
	error,
	reset,
	homeHref,
	homeLabel = "Go home",
	tag = "app",
}: ErrorScreenProps) {
	const showReference = process.env.NODE_ENV === "development";

	useEffect(() => {
		if (error) {
			Sentry.captureException(error, {
				tags: { component: "error-boundary", scope: tag },
				extra: { digest: error.digest },
			});
		}
	}, [error, tag]);

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
			<div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
				<div className="space-y-2">
					<h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{showReference && error?.digest ? (
					<p className="rounded-md border border-border/60 bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
						Reference: {error.digest}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					{reset ? (
						<Button onClick={() => reset()} size="default">
							Try again
						</Button>
					) : null}
					{homeHref ? (
						<Link href={homeHref} className={cn(buttonVariants({ variant: "outline", size: "default" }))}>
							{homeLabel}
						</Link>
					) : null}
				</div>
			</div>
		</div>
	);
}
