"use client";

import { useEffect, useState } from "react";

type Args = {
	/** Wall-clock ms when the session started. `null` defers the timer until set. */
	sessionStartedAt: number | null;
	/** True when a client-driven pause is active (e.g. exit confirm dialog). */
	clientPaused: boolean;
	/** True when the server marks the session paused (admin freeze, integrity hold). */
	serverPaused: boolean;
	/** Authoritative time limit from the server row. */
	timeLimitSeconds: number;
	/** Total accumulated paused seconds reported by the server. */
	accumulatedPauseSeconds: number;
};

/**
 * Returns the remaining seconds for a practice session, recomputed every 1s
 * from a wall-clock anchor minus the server-reported accumulated pause. The
 * tick is suspended while either client or server pause is active.
 *
 * Effect re-registers when any of the inputs change — that's intentional, so
 * the displayed value reacts to admin pauses promptly without needing a
 * separate signaling channel.
 */
export function usePracticeSessionTimer({
	sessionStartedAt,
	clientPaused,
	serverPaused,
	timeLimitSeconds,
	accumulatedPauseSeconds,
}: Args): number {
	const [remainingSec, setRemainingSec] = useState(timeLimitSeconds);

	useEffect(() => {
		if (sessionStartedAt == null) return;
		if (clientPaused || serverPaused) return;
		const tick = () => {
			const wallElapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
			const effectiveElapsed = Math.max(0, wallElapsed - accumulatedPauseSeconds);
			setRemainingSec(Math.max(0, timeLimitSeconds - effectiveElapsed));
		};
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [sessionStartedAt, clientPaused, serverPaused, timeLimitSeconds, accumulatedPauseSeconds]);

	return remainingSec;
}
