import { describe, expect, it } from "vitest";

import { fail, ok } from "../api-response";
import { REQUEST_ID_HEADER } from "../request-id";

function withId(id: string): Request {
	return new Request("https://example.test/api", { headers: { [REQUEST_ID_HEADER]: id } });
}

describe("ok()", () => {
	it("returns success envelope with data and 200", async () => {
		const res = ok({ foo: "bar" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ success: true, data: { foo: "bar" } });
	});

	it("includes the request id in body and response header when given", async () => {
		const res = ok({ x: 1 }, { request: withId("req_abc123") });
		expect(res.headers.get(REQUEST_ID_HEADER)).toBe("req_abc123");
		const body = await res.json();
		expect(body).toEqual({ success: true, data: { x: 1 }, requestId: "req_abc123" });
	});

	it("merges custom headers", () => {
		const res = ok({}, { headers: { "x-custom": "1" } });
		expect(res.headers.get("x-custom")).toBe("1");
	});
});

describe("fail()", () => {
	it("returns failure envelope at 400 by default", async () => {
		const res = fail("validation_error", "Bad input.");
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ success: false, code: "validation_error", message: "Bad input." });
	});

	it("supports custom status and extra fields", async () => {
		const res = fail("quota_tokens", "Out of tokens.", {
			status: 402,
			extra: { paywall: true },
		});
		expect(res.status).toBe(402);
		const body = await res.json();
		expect(body).toEqual({
			success: false,
			code: "quota_tokens",
			message: "Out of tokens.",
			paywall: true,
		});
	});

	it("includes request id when given", async () => {
		const res = fail("rate_limited", "Slow down.", {
			status: 429,
			request: withId("req_xyz"),
		});
		const body = await res.json();
		expect(body.requestId).toBe("req_xyz");
		expect(res.headers.get(REQUEST_ID_HEADER)).toBe("req_xyz");
	});
});
