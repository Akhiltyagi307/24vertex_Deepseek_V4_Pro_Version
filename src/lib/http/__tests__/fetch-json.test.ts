import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { fetchJson, FetchJsonError } from "@/lib/http/fetch-json";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const captureException = vi.mocked(Sentry.captureException);
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function stubFetch(impl: () => Promise<Response>): void {
	globalThis.fetch = vi.fn(impl) as typeof globalThis.fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	captureException.mockClear();
});

describe("fetchJson", () => {
	it("returns the raw body when no schema is given", async () => {
		stubFetch(async () => jsonResponse({ a: 1 }));
		await expect(fetchJson("/x")).resolves.toEqual({ a: 1 });
	});

	it("validates and returns typed data when a schema is given", async () => {
		const schema = z.object({ a: z.number() });
		stubFetch(async () => jsonResponse({ a: 1 }));
		await expect(fetchJson("/x", { schema })).resolves.toEqual({ a: 1 });
	});

	it("throws FetchJsonError carrying the body message + status on non-ok", async () => {
		stubFetch(async () => jsonResponse({ error: "Too many requests." }, 429));
		await expect(fetchJson("/x")).rejects.toMatchObject({
			name: "FetchJsonError",
			status: 429,
			message: "Too many requests.",
		});
	});

	it("throws a validation_error and reports to Sentry on schema mismatch", async () => {
		const schema = z.object({ a: z.number() });
		stubFetch(async () => jsonResponse({ a: "not-a-number" }));
		await expect(
			fetchJson("/x", { schema, report: { area: "test", op: "load" } }),
		).rejects.toMatchObject({ code: "validation_error" });
		expect(captureException).toHaveBeenCalledTimes(1);
	});

	it("rethrows AbortError untouched and never reports it", async () => {
		const abort = new DOMException("aborted", "AbortError");
		stubFetch(async () => {
			throw abort;
		});
		await expect(fetchJson("/x", { report: { area: "test", op: "load" } })).rejects.toBe(abort);
		expect(captureException).not.toHaveBeenCalled();
	});

	it("does not report when no `report` tags are supplied", async () => {
		stubFetch(async () => jsonResponse({}, 500));
		await expect(fetchJson("/x")).rejects.toBeInstanceOf(FetchJsonError);
		expect(captureException).not.toHaveBeenCalled();
	});
});
