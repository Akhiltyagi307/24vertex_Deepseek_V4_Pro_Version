"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage-backed boolean onboarding flags. Mirrors the SSR-safe pattern in
 * `onboarding-checklist.tsx`: `useSyncExternalStore` reads localStorage on the
 * client and a stable `false` on the server, so SSR renders the not-done state
 * and the client reconciles after hydration — no `setState`-in-effect, no
 * hydration mismatch warning. A module-level listener set fans changes out to
 * every hook instance on the page, and a `storage` listener keeps tabs in sync.
 */
const FLAG_STORAGE_PREFIX = "24vertex:onboarding:";

function storageKeyFor(flag: string): string {
	return `${FLAG_STORAGE_PREFIX}${flag}`;
}

/**
 * Subscribers keyed by storage key. Each `useOnboardingFlag` instance registers
 * its own re-render callback so an imperative `markOnboardingFlag` (or a cross-
 * tab write) notifies only the hooks watching that flag.
 */
const flagListeners = new Map<string, Set<() => void>>();

function notifyFlagChange(key: string): void {
	const listeners = flagListeners.get(key);
	if (!listeners) return;
	for (const listener of listeners) {
		listener();
	}
}

function subscribeFlag(key: string, onStoreChange: () => void): () => void {
	let listeners = flagListeners.get(key);
	if (!listeners) {
		listeners = new Set();
		flagListeners.set(key, listeners);
	}
	listeners.add(onStoreChange);
	if (typeof window !== "undefined") {
		// Keep multiple tabs (and other instances on the page) in sync.
		window.addEventListener("storage", onStoreChange);
	}
	return () => {
		listeners?.delete(onStoreChange);
		if (listeners && listeners.size === 0) {
			flagListeners.delete(key);
		}
		if (typeof window !== "undefined") {
			window.removeEventListener("storage", onStoreChange);
		}
	};
}

function getFlagSnapshot(key: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(key) === "1";
	} catch {
		// Private mode / storage disabled: treat as not done.
		return false;
	}
}

function getFlagServerSnapshot(): boolean {
	return false;
}

/**
 * Imperatively persist an onboarding flag as done and notify subscribers. Safe to
 * call outside React (e.g. from an event handler in a component that does not use
 * the hook). No-ops gracefully when storage is unavailable.
 */
export function markOnboardingFlag(flag: string): void {
	const key = storageKeyFor(flag);
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(key, "1");
		} catch {
			// Ignore write failures (private mode); the in-memory notify still updates UI.
		}
	}
	notifyFlagChange(key);
}

export type OnboardingFlag = {
	/** True once the flag has been marked done (or persisted in a prior session). */
	done: boolean;
	/** Persist the flag as done and re-render every subscriber. */
	markDone: () => void;
};

/**
 * Reads/writes a namespaced localStorage onboarding flag in an SSR-safe way.
 * `flag` is a short stable slug (e.g. "welcome", "tour", "doubt-modes-tip"); the
 * stored key is `24vertex:onboarding:<flag>`.
 */
export function useOnboardingFlag(flag: string): OnboardingFlag {
	const key = storageKeyFor(flag);
	const subscribe = useCallback(
		(onStoreChange: () => void) => subscribeFlag(key, onStoreChange),
		[key],
	);
	const getSnapshot = useCallback(() => getFlagSnapshot(key), [key]);
	const done = useSyncExternalStore(subscribe, getSnapshot, getFlagServerSnapshot);
	const markDone = useCallback(() => markOnboardingFlag(flag), [flag]);
	return { done, markDone };
}
