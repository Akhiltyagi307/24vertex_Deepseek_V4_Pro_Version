/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

const { pathnameRef } = vi.hoisted(() => ({
	pathnameRef: { current: "/student/dashboard" },
}));

vi.mock("next/navigation", () => ({
	usePathname: () => pathnameRef.current,
}));

import { DashboardShell } from "@/components/layout/dashboard-shell";

const isDoubtChatPath = (p: string) => p === "/student/doubt-chat";
const isPracticeSessionPath = (p: string) =>
	p.startsWith("/student/practice/") && p.split("/").filter(Boolean).length === 3;
const isImmersive = (p: string) => isDoubtChatPath(p) || isPracticeSessionPath(p);

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mountShell(props: Partial<Parameters<typeof DashboardShell>[0]> = {}) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<DashboardShell
				topBar={<div data-testid="topbar">TOPBAR</div>}
				sidebar={<div data-testid="sidebar">SIDEBAR</div>}
				isDoubtChatPath={isDoubtChatPath}
				isSidebarHiddenPath={isPracticeSessionPath}
				isImmersiveShellPath={isImmersive}
				{...props}
			>
				<main data-testid="content">CHILDREN</main>
			</DashboardShell>,
		);
	});
}

beforeEach(() => {
	pathnameRef.current = "/student/dashboard";
	// jsdom doesn't ship matchMedia; the Sidebar's `useIsMobile` calls it.
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false,
		}),
	});
});

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	if (container?.parentNode) container.parentNode.removeChild(container);
	container = null;
});

describe("DashboardShell", () => {
	it("renders the topbar, sidebar, and children slots", () => {
		mountShell();
		expect(container!.querySelector('[data-testid="topbar"]')?.textContent).toBe("TOPBAR");
		expect(container!.querySelector('[data-testid="sidebar"]')?.textContent).toBe("SIDEBAR");
		expect(container!.querySelector('[data-testid="content"]')?.textContent).toBe("CHILDREN");
	});

	it("applies the doubt-chat layout (h-dvh, overflow-hidden) when on a doubt-chat path", () => {
		pathnameRef.current = "/student/doubt-chat";
		mountShell();
		// SidebarInset reflects the shell's doubt-chat layout via its className.
		const inset = container!.querySelector('[data-slot="sidebar-inset"]');
		expect(inset?.className).toMatch(/overflow-hidden/);
		expect(inset?.className).not.toMatch(/overflow-auto/);
	});

	it("makes #main-content a flex column that grows on immersive routes", () => {
		pathnameRef.current = "/student/doubt-chat";
		mountShell();
		const main = container!.querySelector("#main-content");
		expect(main?.className).toMatch(/\bflex-1\b/);
		expect(main?.className).toMatch(/\bflex-col\b/);
	});

	it("does not add flex growth classes to #main-content on non-immersive routes", () => {
		pathnameRef.current = "/student/dashboard";
		mountShell();
		const main = container!.querySelector("#main-content");
		expect(main?.className).not.toMatch(/\bflex-1\b/);
	});

	it("applies the regular shell layout outside doubt-chat", () => {
		pathnameRef.current = "/student/dashboard";
		mountShell();
		const inset = container!.querySelector('[data-slot="sidebar-inset"]');
		expect(inset?.className).toMatch(/overflow-auto/);
	});

	it("drops the inset horizontal padding on immersive routes (practice session)", () => {
		pathnameRef.current = "/student/practice/abc-123";
		mountShell();
		const inset = container!.querySelector('[data-slot="sidebar-inset"]');
		// `px-4 medium:px-6 xl:px-8` only applied when NOT immersive.
		expect(inset?.className).not.toMatch(/\bpx-4\b/);
	});

	it("keeps the inset horizontal padding on non-immersive routes", () => {
		pathnameRef.current = "/student/dashboard";
		mountShell();
		const inset = container!.querySelector('[data-slot="sidebar-inset"]');
		expect(inset?.className).toMatch(/\bpx-4\b/);
		expect(inset?.className).toMatch(/medium:px-6/);
	});
});
