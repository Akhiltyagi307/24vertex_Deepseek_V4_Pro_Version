"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

/** Background poll interval for sidebar open-assignment dot (ms). */
export const OPEN_ASSIGNMENTS_POLL_MS = 180_000;

export type UseOpenAssignmentsIndicatorArgs = {
	apiBasePath: string;
	initialHasOpen?: boolean;
	/** When true, layout already computed indicator; skip duplicate mount request. */
	skipMountRefresh?: boolean;
	/** Refetch when the active route changes (pass `usePathname()` from the shell). */
	routeKey?: string;
};

/**
 * Sidebar dot for open assignments: lightweight poll + visibility refresh.
 */
export function useOpenAssignmentsIndicator({
	apiBasePath,
	initialHasOpen = false,
	skipMountRefresh = false,
	routeKey = "",
}: UseOpenAssignmentsIndicatorArgs) {
	const [hasOpen, setHasOpen] = React.useState(initialHasOpen);

	const refresh = React.useCallback(async () => {
		try {
			const res = await fetch(`${apiBasePath}/open-indicator`, { cache: "no-store" });
			if (!res.ok) return;
			const json = (await res.json()) as { hasOpen?: boolean };
			if (typeof json.hasOpen === "boolean") {
				setHasOpen(json.hasOpen);
			}
		} catch (err) {
			Sentry.captureException(err, {
				tags: { area: "assignments", op: "open_indicator_refresh" },
			});
		}
	}, [apiBasePath]);

	React.useEffect(() => {
		if (skipMountRefresh) return;
		void refresh();
	}, [refresh, routeKey, skipMountRefresh]);

	React.useEffect(() => {
		if (typeof document === "undefined") return;
		const tick = () => {
			if (document.visibilityState !== "hidden") void refresh();
		};
		const interval = setInterval(tick, OPEN_ASSIGNMENTS_POLL_MS);
		const onVisible = () => {
			if (document.visibilityState === "visible") void refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [refresh]);

	return { hasOpen, refresh };
}
