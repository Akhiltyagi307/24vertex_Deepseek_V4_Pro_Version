"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks `navigator.onLine` plus the `online`/`offline` window events.
 * Uses `useSyncExternalStore` so the **server snapshot is always online** (`true`).
 * Without that, SSR assumed online while the client's first paint read
 * `navigator.onLine === false`, which HydrationErrors the offline badge in the
 * practice session chrome.
 *
 * After hydration, the store snaps to real `navigator.onLine` via `getSnapshot`.
 */
function subscribe(onStoreChange: () => void): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}
	window.addEventListener("online", onStoreChange);
	window.addEventListener("offline", onStoreChange);
	return () => {
		window.removeEventListener("online", onStoreChange);
		window.removeEventListener("offline", onStoreChange);
	};
}

function getSnapshot(): boolean {
	return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getServerSnapshot(): boolean {
	return true;
}

export function useNetworkStatus(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
