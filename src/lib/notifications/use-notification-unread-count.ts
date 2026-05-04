"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

import { subscribeToMyNotifications } from "@/lib/notifications/realtime-client";
import type { NotificationsRealtimeScope } from "@/lib/notifications/realtime-client";

export type UseNotificationUnreadCountArgs = {
	userId: string;
	apiBasePath: string;
	initialCount?: number;
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
	realtimeScope,
}: UseNotificationUnreadCountArgs) {
	const [count, setCount] = React.useState(initialCount);

	const refresh = React.useCallback(async () => {
		try {
			const res = await fetch(`${apiBasePath}/unread-count`, {
				cache: "no-store",
			});
			if (!res.ok) return;
			const json = (await res.json()) as { count?: number };
			if (typeof json.count === "number") {
				setCount(Math.max(0, json.count));
			}
		} catch (err) {
			Sentry.captureException(err, {
				tags: { area: "notifications", op: "unread_count_refresh" },
			});
		}
	}, [apiBasePath]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

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

	return { count, setCount, refresh };
}
