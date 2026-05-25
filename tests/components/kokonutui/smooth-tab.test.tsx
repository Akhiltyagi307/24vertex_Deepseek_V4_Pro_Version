/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

vi.mock("motion/react", async () => {
	const ReactModule = await import("react");
	type MotionStubProps = React.HTMLAttributes<Element> & {
		children?: React.ReactNode;
		animate?: unknown;
		custom?: unknown;
		exit?: unknown;
		initial?: unknown;
		transition?: unknown;
		variants?: unknown;
	};

	const makeMotionComponent = (tag: keyof React.JSX.IntrinsicElements) =>
		ReactModule.forwardRef<Element, MotionStubProps>(
			({ animate, custom, exit, initial, transition, variants, ...props }, ref) =>
				ReactModule.createElement(tag, { ...props, ref }, props.children),
		);

	return {
		AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		motion: {
			div: makeMotionComponent("div"),
			button: makeMotionComponent("button"),
			g: makeMotionComponent("g"),
			path: makeMotionComponent("path"),
		},
		useReducedMotion: () => false,
	};
});

import SmoothTab from "@/components/kokonutui/smooth-tab";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	window.requestAnimationFrame = (callback: FrameRequestCallback) => {
		callback(0);
		return 0;
	};
});

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	if (container?.parentNode) container.parentNode.removeChild(container);
	container = null;
});

describe("SmoothTab", () => {
	it("defers selected heavy panels until the tab is activated", () => {
		act(() => {
			root!.render(
				<SmoothTab
					defaultTabId="create"
					persistContentPanels
					deferUntilActivatedTabIds={["submissions"]}
					items={[
						{
							id: "create",
							title: "Create",
							color: "bg-primary",
							content: <div data-testid="create-panel">Create panel</div>,
						},
						{
							id: "submissions",
							title: "Submissions",
							color: "bg-primary",
							content: <div data-testid="submissions-panel">Submissions panel</div>,
						},
					]}
				/>,
			);
		});

		expect(container!.querySelector('[data-testid="create-panel"]')).not.toBeNull();
		expect(container!.querySelector('[data-testid="submissions-panel"]')).toBeNull();

		act(() => {
			container!.querySelector<HTMLButtonElement>("#tab-submissions")!.click();
		});

		expect(container!.querySelector('[data-testid="submissions-panel"]')).not.toBeNull();
	});
});
