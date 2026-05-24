"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

export type UseOpenAssignmentsIndicatorArgs = {
	apiBasePath: string;
	initialHasOpen?: boolean;
	/** Refetch when the active route changes (pass `usePathname()` from the shell). */
	routeKey?: string;
};

/**
 * Sidebar dot for open assignments: lightweight poll + visibility refresh.
 */
export function useOpenAssignmentsIndicator({
	apiBasePath,
	initialHasOpen = false,
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
		void refresh();
	}, [refresh, routeKey]);

	React.useEffect(() => {
		if (typeof document === "undefined") return;
		const tick = () => {
			if (document.visibilityState !== "hidden") void refresh();
		};
		const interval = setInterval(tick, 60_000);
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
