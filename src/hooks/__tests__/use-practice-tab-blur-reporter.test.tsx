/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";

import { usePracticeTabBlurReporter } from "@/hooks/use-practice-tab-blur-reporter";
import { renderHook } from "@/test/render-hook";

const TEST_ID = "test-1";
let fetchSpy: ReturnType<typeof vi.fn> | null = null;
const originalFetch = globalThis.fetch;

function setVisibility(state: "hidden" | "visible") {
	Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

beforeEach(() => {
	fetchSpy = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
	globalThis.fetch = ((...args: Parameters<typeof globalThis.fetch>) =>
		(fetchSpy as unknown as (...a: unknown[]) => Promise<Response>)(
			...args,
		)) as typeof globalThis.fetch;
	setVisibility("visible");
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("usePracticeTabBlurReporter", () => {
	it("does not fire when visibility is `visible`", () => {
		const h = renderHook(() => usePracticeTabBlurReporter({ testId: TEST_ID }));
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		h.cleanup();
	});

	it("fires once when visibility flips to `hidden`", () => {
		const h = renderHook(() => usePracticeTabBlurReporter({ testId: TEST_ID }));
		setVisibility("hidden");
		act(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy!.mock.calls[0]!;
		expect(url).toBe("/api/student/practice/tab-blur");
		expect(init).toMatchObject({
			method: "POST",
			body: JSON.stringify({ testId: TEST_ID }),
		});
		h.cleanup();
	});

	it("throttles repeat blur events within the configured window", async () => {
		const h = renderHook(() =>
			usePracticeTabBlurReporter({ testId: TEST_ID, throttleMs: 30_000 }),
		);
		setVisibility("hidden");
		await act(() => document.dispatchEvent(new Event("visibilitychange")));
		await act(() => document.dispatchEvent(new Event("visibilitychange")));
		await act(() => document.dispatchEvent(new Event("visibilitychange")));
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		h.cleanup();
	});

	it("supports a custom endpoint", async () => {
		const h = renderHook(() =>
			usePracticeTabBlurReporter({ testId: TEST_ID, endpoint: "/custom/blur" }),
		);
		setVisibility("hidden");
		await act(() => document.dispatchEvent(new Event("visibilitychange")));
		expect(fetchSpy!.mock.calls[0]![0]).toBe("/custom/blur");
		h.cleanup();
	});

	it("swallows fetch errors silently (proctoring telemetry is best-effort)", () => {
		fetchSpy = vi.fn(async () => {
			throw new Error("network down");
		});
		globalThis.fetch = ((...args: Parameters<typeof globalThis.fetch>) =>
			(fetchSpy as unknown as (...a: unknown[]) => Promise<Response>)(
				...args,
			)) as typeof globalThis.fetch;
		const h = renderHook(() => usePracticeTabBlurReporter({ testId: TEST_ID }));
		setVisibility("hidden");
		expect(() =>
			act(() => document.dispatchEvent(new Event("visibilitychange"))),
		).not.toThrow();
		h.cleanup();
	});

	it("removes the listener on unmount", () => {
		const h = renderHook(() => usePracticeTabBlurReporter({ testId: TEST_ID }));
		h.cleanup();
		setVisibility("hidden");
		document.dispatchEvent(new Event("visibilitychange"));
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
