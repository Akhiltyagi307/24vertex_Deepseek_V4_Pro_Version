"use client";

import { ErrorScreen } from "@/components/error-screen";

/**
 * Error boundary for the public marketing + legal surfaces. Keeps a crash in a
 * marketing page on-brand (and reports to Sentry via ErrorScreen) instead of
 * bubbling to the bare root boundary.
 */
export default function PublicError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return <ErrorScreen error={error} reset={reset} homeHref="/" tag="public" />;
}
