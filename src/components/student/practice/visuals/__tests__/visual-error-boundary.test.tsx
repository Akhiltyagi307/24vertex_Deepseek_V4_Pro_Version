/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisualErrorBoundary } from "../visual-error-boundary";

// Sentry must be mocked: the real module pokes the Next.js runtime hooks
// which aren't initialized in jsdom. We just need to confirm captureException
// is invoked with the right tags + extras when the boundary catches.
vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

// Re-import the mock so we can assert on it.
const SentryMock = await import("@sentry/nextjs");

function ThrowingChild({ message }: { message: string }): React.ReactElement {
	throw new Error(message);
}

function HappyChild(): React.ReactElement {
	return <div data-testid="happy-child">all good</div>;
}

describe("<VisualErrorBoundary />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		vi.clearAllMocks();
	});

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders children when no error is thrown", () => {
		act(() => {
			root!.render(
				<VisualErrorBoundary kind="math_geometry" altText="A triangle.">
					<HappyChild />
				</VisualErrorBoundary>,
			);
		});
		expect(container.querySelector('[data-testid="happy-child"]')).not.toBeNull();
		expect(container.querySelector('[data-visual-error-boundary-fallback="true"]')).toBeNull();
	});

	it("renders fallback UI with the spec's altText when a child throws", () => {
		// React logs caught errors to console.error during boundary handling;
		// silence the noise so the test output stays clean.
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			act(() => {
				root!.render(
					<VisualErrorBoundary kind="chemistry_molecule" altText="Benzene structure.">
						<ThrowingChild message="kaboom" />
					</VisualErrorBoundary>,
				);
			});

			const fallback = container.querySelector(
				'[data-visual-error-boundary-fallback="true"]',
			);
			expect(fallback).not.toBeNull();
			expect(fallback?.getAttribute("role")).toBe("img");
			expect(fallback?.getAttribute("aria-label")).toBe("Benzene structure.");
			expect(fallback?.textContent ?? "").toContain("Could not render this visual.");
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("reports the error to Sentry with kind + altText context", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			act(() => {
				root!.render(
					<VisualErrorBoundary kind="statistics_chart" altText="Histogram of marks.">
						<ThrowingChild message="recharts panicked" />
					</VisualErrorBoundary>,
				);
			});

			expect(SentryMock.captureException).toHaveBeenCalledTimes(1);
			const [errArg, ctxArg] = (SentryMock.captureException as ReturnType<typeof vi.fn>).mock
				.calls[0] as [Error, { tags?: Record<string, unknown>; extra?: Record<string, unknown> }];
			expect(errArg).toBeInstanceOf(Error);
			expect(errArg.message).toBe("recharts panicked");
			expect(ctxArg.tags).toMatchObject({
				component: "QuestionVisual",
				visualKind: "statistics_chart",
			});
			expect(ctxArg.extra).toMatchObject({ altText: "Histogram of marks." });
		} finally {
			consoleSpy.mockRestore();
		}
	});

	it("falls back to a default aria-label when altText is empty", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			act(() => {
				root!.render(
					<VisualErrorBoundary kind="math_geometry" altText="">
						<ThrowingChild message="x" />
					</VisualErrorBoundary>,
				);
			});
			const fallback = container.querySelector(
				'[data-visual-error-boundary-fallback="true"]',
			);
			expect(fallback?.getAttribute("aria-label")).toBe("Visual could not be displayed.");
		} finally {
			consoleSpy.mockRestore();
		}
	});
});
