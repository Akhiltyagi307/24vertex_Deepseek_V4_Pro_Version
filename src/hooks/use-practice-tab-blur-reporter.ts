"use client";

import { useEffect, useRef } from "react";

type Options = {
	testId: string;
	/** Min ms between sends. Defaults to 25_000. */
	throttleMs?: number;
	/** Endpoint to POST `{ testId }` to on tab blur. */
	endpoint?: string;
};

/**
 * Reports a tab-blur event (visibility = "hidden") to the practice API. The
 * report is rate-limited per-tab via a ref so a quick alt-tab spam doesn't
 * flood the endpoint. The fetch is fire-and-forget; failures are silently
 * dropped — this is a soft-signal channel for proctoring telemetry, not a
 * critical write.
 */
export function usePracticeTabBlurReporter({
	testId,
	throttleMs = 25_000,
	endpoint = "/api/student/practice/tab-blur",
}: Options): void {
	const lastSentRef = useRef(0);

	useEffect(() => {
		const onVis = () => {
			if (document.visibilityState !== "hidden") return;
			const now = Date.now();
			if (now - lastSentRef.current < throttleMs) return;
			lastSentRef.current = now;
			void fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ testId }),
			}).catch(() => {});
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, [testId, throttleMs, endpoint]);
}
