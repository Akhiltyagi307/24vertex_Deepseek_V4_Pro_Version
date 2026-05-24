/**
 * Tests for the contact CSRF/Origin gate in proxy.ts. Mirrors the parent
 * variant in `tests/admin/parent-proxy-gate.test.ts`. `/api/contact` is
 * unauthenticated, so the gate is the only CSRF defense beyond the JSON
 * content-type preflight.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { contactProxyGate } from "@/lib/marketing/contact/proxy-guard";

function makeReq(opts: { url: string; method?: string; origin?: string }): NextRequest {
	const headers = new Headers();
	if (opts.origin) headers.set("origin", opts.origin);
	return new NextRequest(new URL(opts.url), {
		method: opts.method ?? "GET",
		headers,
	});
}

describe("contactProxyGate", () => {
	it("passes through GET requests to /api/contact", () => {
		const res = contactProxyGate(makeReq({ url: "http://localhost:3001/api/contact" }));
		expect(res).toBeNull();
	});

	it("passes through non-contact paths", () => {
		const res = contactProxyGate(
			makeReq({ url: "http://localhost:3001/api/feedback", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("passes through mutating /api/contact when Origin is absent (server-to-server)", () => {
		const res = contactProxyGate(
			makeReq({ url: "http://localhost:3001/api/contact", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("rejects mutating /api/contact when Origin is a foreign domain", () => {
		const res = contactProxyGate(
			makeReq({
				url: "http://localhost:3001/api/contact",
				method: "POST",
				origin: "https://evil.example",
			}),
		);
		expect(res?.status).toBe(403);
	});

	it("allows mutating /api/contact when Origin matches the request origin", () => {
		const res = contactProxyGate(
			makeReq({
				url: "http://localhost:3001/api/contact",
				method: "POST",
				origin: "http://localhost:3001",
			}),
		);
		expect(res).toBeNull();
	});
});
