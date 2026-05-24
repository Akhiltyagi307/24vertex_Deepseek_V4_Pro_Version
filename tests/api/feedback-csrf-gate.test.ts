/**
 * Tests for the feedback CSRF/Origin gate in proxy.ts. Mirrors the parent
 * variant in `tests/admin/parent-proxy-gate.test.ts`.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { feedbackProxyGate } from "@/lib/feedback/proxy-guard";

function makeReq(opts: { url: string; method?: string; origin?: string }): NextRequest {
	const headers = new Headers();
	if (opts.origin) headers.set("origin", opts.origin);
	return new NextRequest(new URL(opts.url), {
		method: opts.method ?? "GET",
		headers,
	});
}

describe("feedbackProxyGate", () => {
	it("passes through GET requests to /api/feedback", () => {
		const res = feedbackProxyGate(makeReq({ url: "http://localhost:3001/api/feedback" }));
		expect(res).toBeNull();
	});

	it("passes through non-feedback paths", () => {
		const res = feedbackProxyGate(
			makeReq({ url: "http://localhost:3001/api/student/notifications", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("passes through mutating /api/feedback when Origin is absent (server-to-server)", () => {
		const res = feedbackProxyGate(
			makeReq({ url: "http://localhost:3001/api/feedback", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("rejects mutating /api/feedback when Origin is a foreign domain", () => {
		const res = feedbackProxyGate(
			makeReq({
				url: "http://localhost:3001/api/feedback",
				method: "POST",
				origin: "https://evil.example",
			}),
		);
		expect(res?.status).toBe(403);
	});

	it("allows mutating /api/feedback when Origin matches the request origin", () => {
		const res = feedbackProxyGate(
			makeReq({
				url: "http://localhost:3001/api/feedback",
				method: "POST",
				origin: "http://localhost:3001",
			}),
		);
		expect(res).toBeNull();
	});
});
