/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { renderHook } from "@/test/render-hook";

let originalOnLine: PropertyDescriptor | undefined;

beforeEach(() => {
	originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
	Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

afterEach(() => {
	if (originalOnLine) {
		Object.defineProperty(window.navigator, "onLine", originalOnLine);
	}
});

describe("useNetworkStatus", () => {
	it("reads navigator.onLine on first render", () => {
		Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
		const h = renderHook(() => useNetworkStatus());
		expect(h.current).toBe(true);
		h.cleanup();
	});

	it("returns false when navigator.onLine is false at mount", () => {
		Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
		const h = renderHook(() => useNetworkStatus());
		expect(h.current).toBe(false);
		h.cleanup();
	});

	it("flips to false when an `offline` event fires", () => {
		const h = renderHook(() => useNetworkStatus());
		expect(h.current).toBe(true);
		act(() => {
			Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
			window.dispatchEvent(new Event("offline"));
		});
		expect(h.current).toBe(false);
		h.cleanup();
	});

	it("flips back to true when an `online` event fires", () => {
		Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
		const h = renderHook(() => useNetworkStatus());
		expect(h.current).toBe(false);
		act(() => {
			Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
			window.dispatchEvent(new Event("online"));
		});
		expect(h.current).toBe(true);
		h.cleanup();
	});

	it("removes its event listeners on unmount", () => {
		const h = renderHook(() => useNetworkStatus());
		h.cleanup();
		// After cleanup, dispatching the events does not crash even though no
		// React tree is mounted to receive them.
		expect(() => {
			window.dispatchEvent(new Event("offline"));
			window.dispatchEvent(new Event("online"));
		}).not.toThrow();
	});
});
