/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { z } from "zod";

import { useJsonResource } from "@/hooks/use-json-resource";
import { renderHook } from "@/test/render-hook";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function flush(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("useJsonResource", () => {
	const schema = z.object({ a: z.number() });

	it("loads, validates, and clears the loading flag", async () => {
		globalThis.fetch = vi.fn(async () => jsonResponse({ a: 1 })) as typeof globalThis.fetch;
		const h = renderHook(() => useJsonResource("/x", { schema }));
		expect(h.current.loading).toBe(true);
		expect(h.current.data).toBeNull();
		await flush();
		expect(h.current.data).toEqual({ a: 1 });
		expect(h.current.loading).toBe(false);
		expect(h.current.error).toBeNull();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		h.cleanup();
	});

	it("does not fetch when disabled", async () => {
		globalThis.fetch = vi.fn(async () => jsonResponse({ a: 1 })) as typeof globalThis.fetch;
		const h = renderHook(() => useJsonResource("/x", { schema, enabled: false }));
		await flush();
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(h.current.loading).toBe(false);
		expect(h.current.data).toBeNull();
		h.cleanup();
	});

	it("refetches on reload()", async () => {
		globalThis.fetch = vi.fn(async () => jsonResponse({ a: 2 })) as typeof globalThis.fetch;
		const h = renderHook(() => useJsonResource("/x", { schema }));
		await flush();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		await act(async () => {
			h.current.reload();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		h.cleanup();
	});

	it("surfaces a validation error instead of throwing", async () => {
		globalThis.fetch = vi.fn(async () => jsonResponse({ a: "no" })) as typeof globalThis.fetch;
		const h = renderHook(() => useJsonResource("/x", { schema }));
		await flush();
		expect(h.current.error).toBeTruthy();
		expect(h.current.data).toBeNull();
		expect(h.current.loading).toBe(false);
		h.cleanup();
	});
});
