/**
 * Lightweight `renderHook` for tests, built on raw `createRoot + act` so we
 * don't need to add `@testing-library/react` as a dep. Mirrors the convention
 * used by the existing `tests/admin/admin-data-table-*.test.tsx` files.
 *
 * Pattern:
 *   const h = renderHook(() => useNetworkStatus());
 *   expect(h.current).toBe(true);
 *   act(() => window.dispatchEvent(new Event("offline")));
 *   expect(h.current).toBe(false);
 *   h.cleanup();
 */
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

export type RenderHookHandle<T> = {
	/** Latest value returned by the hook. Reads through the wrapper component. */
	readonly current: T;
	/** Re-render with new args (helpful for prop-driven hooks). */
	rerender: (nextRender: () => T) => void;
	/** Unmount the wrapper and remove its container from the DOM. */
	cleanup: () => void;
};

export function renderHook<T>(useHook: () => T): RenderHookHandle<T> {
	const box: { value: T | undefined } = { value: undefined };

	function Probe({ render }: { render: () => T }) {
		box.value = render();
		return null;
	}

	const container = document.createElement("div");
	document.body.appendChild(container);
	const root: Root = createRoot(container);

	let currentRender = useHook;
	act(() => {
		root.render(<Probe render={currentRender} />);
	});

	return {
		get current() {
			return box.value as T;
		},
		rerender(nextRender: () => T) {
			currentRender = nextRender;
			act(() => {
				root.render(<Probe render={currentRender} />);
			});
		},
		cleanup() {
			act(() => root.unmount());
			if (container.parentNode) container.parentNode.removeChild(container);
		},
	};
}
