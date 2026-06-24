"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { fetchJson, FetchJsonError, isAbortError } from "@/lib/http/fetch-json";
import { subscribeToMyNotifications } from "@/lib/notifications/realtime-client";
import type { NotificationsRealtimeScope } from "@/lib/notifications/realtime-client";

const unreadCountSchema = z.object({ count: z.number().optional() });

/**
 * Background reconciliation poll interval (ms). Realtime delivers live unread
 * increments, so this poll only reconciles out-of-band changes (e.g. read on
 * another device); a long interval keeps steady-state DB load low.
 */
export const NOTIFICATION_UNREAD_POLL_MS = 600_000;

/** Minimum gap between a tab-focus-triggered refresh and the previous refresh. */
const NOTIFICATION_UNREAD_FOCUS_COOLDOWN_MS = 60_000;

export type UseNotificationUnreadCountArgs = {
	userId: string;
	apiBasePath: string;
	initialCount?: number;
	/** When true, layout already fetched count; skip duplicate mount request. */
	skipMountRefresh?: boolean;
	/** Distinct Realtime channel suffix — each subscriber needs its own scope. */
	realtimeScope: NotificationsRealtimeScope;
};

/**
 * Unread count for notifications: initial fetch, periodic + visibility refresh,
 * and Realtime increments on new unread rows (matches top-bar bell behavior).
 */
export function useNotificationUnreadCount({
	userId,
	apiBasePath,
	initialCount = 0,
	skipMountRefresh = false,
	realtimeScope,
}: UseNotificationUnreadCountArgs) {
	const [count, setCount] = React.useState(initialCount);

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
			const result = await fetchJson(`${apiBasePath}/unread-count`, {
				schema: unreadCountSchema,
				signal: ac.signal,
			});
			if (id !== reqIdRef.current) return;
			if (typeof result.count === "number") {
				setCount(Math.max(0, result.count));
			}
		} catch (err) {
			if (isAbortError(err)) return;
			// Preserve prior behaviour: stay silent on HTTP/validation failures
			// (`!res.ok` used to `return`); only report genuine network errors.
			if (err instanceof FetchJsonError && err.status !== null) return;
			Sentry.captureException(err, {
				tags: { area: "notifications", op: "unread_count_refresh" },
			});
		}
	}, [apiBasePath]);

	React.useEffect(() => {
		if (skipMountRefresh) return;
		void refresh();
		return () => {
			acRef.current?.abort();
		};
	}, [refresh, skipMountRefresh]);

	React.useEffect(() => {
		const unsubscribe = subscribeToMyNotifications(
			userId,
			(row) => {
				if (!row.isRead) setCount((n) => n + 1);
			},
			realtimeScope,
		);
		return unsubscribe;
	}, [userId, realtimeScope]);

	React.useEffect(() => {
		if (typeof document === "undefined") return;
		const tick = () => {
			if (document.visibilityState !== "hidden") void refresh();
		};
		const interval = setInterval(tick, NOTIFICATION_UNREAD_POLL_MS);
		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			// Debounce focus bursts: skip if we refreshed very recently.
			if (Date.now() - lastRefreshAtRef.current < NOTIFICATION_UNREAD_FOCUS_COOLDOWN_MS) return;
			void refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [refresh]);

	return { count, setCount, refresh };
}
