/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";

import { usePracticeSessionTimer } from "@/hooks/use-practice-session-timer";
import { renderHook } from "@/test/render-hook";

const ANCHOR = 1_700_000_000_000;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(ANCHOR);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("usePracticeSessionTimer", () => {
	it("returns timeLimitSeconds when sessionStartedAt is null (timer paused at 'not started')", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: null,
				clientPaused: false,
				serverPaused: false,
				timeLimitSeconds: 3600,
				accumulatedPauseSeconds: 0,
			}),
		);
		expect(h.current).toBe(3600);
		h.cleanup();
	});

	it("counts down once per second from the anchor", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: ANCHOR,
				clientPaused: false,
				serverPaused: false,
				timeLimitSeconds: 100,
				accumulatedPauseSeconds: 0,
			}),
		);
		expect(h.current).toBe(100);
		// `advanceTimersByTime` advances both fake time AND fires timers — no
		// separate `setSystemTime` (would double-count).
		act(() => vi.advanceTimersByTime(5_000));
		expect(h.current).toBe(95);
		h.cleanup();
	});

	it("subtracts accumulated server-reported pause time", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: ANCHOR,
				clientPaused: false,
				serverPaused: false,
				timeLimitSeconds: 100,
				accumulatedPauseSeconds: 30,
			}),
		);
		act(() => vi.advanceTimersByTime(50_000));
		// 50s elapsed - 30s accumulated pause = 20s effective; 100 - 20 = 80
		expect(h.current).toBe(80);
		h.cleanup();
	});

	it("clamps remaining at 0 when the limit is exceeded", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: ANCHOR,
				clientPaused: false,
				serverPaused: false,
				timeLimitSeconds: 10,
				accumulatedPauseSeconds: 0,
			}),
		);
		act(() => vi.advanceTimersByTime(60_000));
		expect(h.current).toBe(0);
		h.cleanup();
	});

	it("freezes when clientPaused is true (no interval, no recompute)", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: ANCHOR,
				clientPaused: true,
				serverPaused: false,
				timeLimitSeconds: 100,
				accumulatedPauseSeconds: 0,
			}),
		);
		const before = h.current;
		act(() => vi.advanceTimersByTime(5_000));
		expect(h.current).toBe(before);
		h.cleanup();
	});

	it("freezes when serverPaused is true", () => {
		const h = renderHook(() =>
			usePracticeSessionTimer({
				sessionStartedAt: ANCHOR,
				clientPaused: false,
				serverPaused: true,
				timeLimitSeconds: 100,
				accumulatedPauseSeconds: 0,
			}),
		);
		const before = h.current;
		act(() => vi.advanceTimersByTime(5_000));
		expect(h.current).toBe(before);
		h.cleanup();
	});
});
