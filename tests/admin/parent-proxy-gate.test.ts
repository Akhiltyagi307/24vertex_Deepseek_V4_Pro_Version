/**
 * Tests for the parent CSRF/Origin gate in proxy.ts. Mirrors the admin and
 * billing variants in `tests/admin/proxy-gate.test.ts`.
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { parentProxyGate } from "@/lib/parent/proxy-guard";

function makeReq(opts: { url: string; method?: string; origin?: string }): NextRequest {
	const headers = new Headers();
	if (opts.origin) headers.set("origin", opts.origin);
	return new NextRequest(new URL(opts.url), {
		method: opts.method ?? "GET",
		headers,
	});
}

describe("parentProxyGate", () => {
	it("passes through GET requests to /api/parent/*", () => {
		const res = parentProxyGate(makeReq({ url: "http://localhost:3001/api/parent/notifications" }));
		expect(res).toBeNull();
	});

	it("passes through non-parent paths", () => {
		const res = parentProxyGate(
			makeReq({ url: "http://localhost:3001/api/student/foo", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("passes through mutating /api/parent/* when Origin is absent (server-to-server)", () => {
		const res = parentProxyGate(
			makeReq({ url: "http://localhost:3001/api/parent/notifications/read-all", method: "POST" }),
		);
		expect(res).toBeNull();
	});

	it("rejects mutating /api/parent/* when Origin is a foreign domain", () => {
		const res = parentProxyGate(
			makeReq({
				url: "http://localhost:3001/api/parent/notifications/read-all",
				method: "POST",
				origin: "https://evil.example",
			}),
		);
		expect(res?.status).toBe(403);
	});

	it("allows mutating /api/parent/* when Origin matches the request origin", () => {
		const res = parentProxyGate(
			makeReq({
				url: "http://localhost:3001/api/parent/notifications/abcde123-0000-4000-8000-000000000000",
				method: "PATCH",
				origin: "http://localhost:3001",
			}),
		);
		expect(res).toBeNull();
	});
});
