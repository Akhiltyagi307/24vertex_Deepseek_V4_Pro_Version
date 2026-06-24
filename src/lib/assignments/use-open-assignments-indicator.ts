"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { fetchJson, FetchJsonError, isAbortError } from "@/lib/http/fetch-json";

/** Background poll interval for sidebar open-assignment dot (ms). */
export const OPEN_ASSIGNMENTS_POLL_MS = 600_000;

/**
 * Minimum gap between a tab-focus-triggered refresh and the previous refresh.
 * Rapid tab switching used to fire a DB-backed indicator fetch every time the
 * tab regained focus; this debounces those bursts.
 */
const OPEN_ASSIGNMENTS_FOCUS_COOLDOWN_MS = 60_000;

const openIndicatorSchema = z.object({ hasOpen: z.boolean().optional() });

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

	const reqIdRef = React.useRef(0);
	const acRef = React.useRef<AbortController | null>(null);
	const lastRefreshAtRef = React.useRef(0);

	const refresh = React.useCallback(async () => {
		const id = ++reqIdRef.current;
		lastRefreshAtRef.current = Date.now();
		acRef.current?.abort();
		const ac = new AbortController();
		acRef.current = ac;
		try {
			const result = await fetchJson(`${apiBasePath}/open-indicator`, {
				schema: openIndicatorSchema,
				signal: ac.signal,
			});
			if (id !== reqIdRef.current) return;
			if (typeof result.hasOpen === "boolean") {
				setHasOpen(result.hasOpen);
			}
		} catch (err) {
			if (isAbortError(err)) return;
			// Preserve prior behaviour: stay silent on HTTP/validation failures
			// (`!res.ok` used to `return`); only report genuine network errors.
			if (err instanceof FetchJsonError && err.status !== null) return;
			Sentry.captureException(err, {
				tags: { area: "assignments", op: "open_indicator_refresh" },
			});
		}
	}, [apiBasePath]);

	React.useEffect(() => {
		if (skipMountRefresh) return;
		void refresh();
		return () => {
			acRef.current?.abort();
		};
	}, [refresh, routeKey, skipMountRefresh]);

	React.useEffect(() => {
		if (typeof document === "undefined") return;
		const tick = () => {
			if (document.visibilityState !== "hidden") void refresh();
		};
		const interval = setInterval(tick, OPEN_ASSIGNMENTS_POLL_MS);
		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			// Debounce focus bursts: skip if we refreshed very recently.
			if (Date.now() - lastRefreshAtRef.current < OPEN_ASSIGNMENTS_FOCUS_COOLDOWN_MS) return;
			void refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [refresh]);

	return { hasOpen, refresh };
}
