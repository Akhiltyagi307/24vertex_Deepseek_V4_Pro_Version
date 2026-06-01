"use client";

/**
 * Tiny pub/sub bridging a top-bar "Take the tour" control to the per-role
 * onboarding orchestrator that actually owns the tour. They live in different
 * parts of the tree (top bar vs. shell body), so a module-level event keyed by
 * portal scope lets the control re-trigger the tour without prop-drilling or a
 * context provider. This is the only re-entry point once the first-run welcome
 * has been dismissed.
 */
export type TourScope = "teacher" | "student" | "parent";

const replayListeners = new Map<TourScope, Set<() => void>>();

/** Ask every orchestrator subscribed to `scope` to (re)start its tour. */
export function requestTourReplay(scope: TourScope): void {
	const listeners = replayListeners.get(scope);
	if (!listeners) return;
	for (const listener of listeners) {
		listener();
	}
}

/** Subscribe to replay requests for `scope`; returns an unsubscribe function. */
export function subscribeTourReplay(scope: TourScope, onReplay: () => void): () => void {
	let listeners = replayListeners.get(scope);
	if (!listeners) {
		listeners = new Set();
		replayListeners.set(scope, listeners);
	}
	listeners.add(onReplay);
	return () => {
		listeners?.delete(onReplay);
		if (listeners && listeners.size === 0) {
			replayListeners.delete(scope);
		}
	};
}
