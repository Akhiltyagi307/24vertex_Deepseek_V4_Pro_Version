"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `navigator.onLine` plus the `online`/`offline` window events.
 * Returns `true` while offline detection is unavailable (SSR / very old UAs)
 * because optimistic-online matches existing app behavior — we don't want to
 * scare the student with a false "offline" banner during hydration.
 *
 * Initial value is read in the `useState` initializer so we never
 * synchronously call `setState` inside the effect.
 */
export function useNetworkStatus(): boolean {
	const [isOnline, setIsOnline] = useState<boolean>(() =>
		typeof navigator === "undefined" ? true : navigator.onLine,
	);

	useEffect(() => {
		const setOnline = () => setIsOnline(true);
		const setOffline = () => setIsOnline(false);
		window.addEventListener("online", setOnline);
		window.addEventListener("offline", setOffline);
		return () => {
			window.removeEventListener("online", setOnline);
			window.removeEventListener("offline", setOffline);
		};
	}, []);

	return isOnline;
}
