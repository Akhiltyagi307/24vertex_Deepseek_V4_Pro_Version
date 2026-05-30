/**
 * Unit tests for the canonical admin response envelope helpers.
 *
 * The envelope is what every admin API client (and every admin test) parses,
 * so the shape and headers need to be locked down.
 */
import { describe, expect, it } from "vitest";

import {
	ADMIN_RESPONSE_HEADERS,
	adminAckResponse,
	adminDetailResponse,
	adminErrorResponse,
	adminListResponse,
} from "@/lib/admin/response";

describe("admin response envelope", () => {
	describe("ADMIN_RESPONSE_HEADERS", () => {
		it("always sets X-Robots-Tag", () => {
			expect(ADMIN_RESPONSE_HEADERS["X-Robots-Tag"]).toBe("noindex, nofollow");
		});

		it("is frozen so callers cannot mutate the shared object", () => {
			expect(() => {
				(ADMIN_RESPONSE_HEADERS as Record<string, string>).foo = "bar";
			}).toThrow();
		});
	});

	describe("adminListResponse", () => {
		it("emits the canonical list shape with snake_case page_size", async () => {
			const res = adminListResponse({ data: [{ id: 1 }, { id: 2 }], total: 2, page: 1, pageSize: 10 });
			expect(res.status).toBe(200);
			expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
			const body = await res.json();
			expect(body).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2, page: 1, page_size: 10 });
		});

		it("merges caller headers on top of admin defaults", () => {
			const res = adminListResponse(
				{ data: [], total: 0, page: 1, pageSize: 10 },
				{ headers: { "X-Custom": "1" } },
			);
			expect(res.headers.get("x-custom")).toBe("1");
			expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		});
	});

	describe("adminDetailResponse", () => {
		it("wraps the data field", async () => {
			const res = adminDetailResponse({ id: "abc", name: "x" });
			const body = await res.json();
			expect(body).toEqual({ data: { id: "abc", name: "x" } });
		});
	});

	describe("adminAckResponse", () => {
		it("includes ok:true and merges extras", async () => {
			const res = adminAckResponse({ deduped: true, refund_id: "rfnd_1" });
			const body = await res.json();
			expect(body).toEqual({ ok: true, deduped: true, refund_id: "rfnd_1" });
		});

		it("default extras = empty object → bare {ok:true}", async () => {
			const res = adminAckResponse();
			const body = await res.json();
			expect(body).toEqual({ ok: true });
		});
	});

	describe("adminErrorResponse", () => {
		it("default status is 400", () => {
			expect(adminErrorResponse("nope").status).toBe(400);
		});

		it("includes optional code and details only when provided", async () => {
			const res = adminErrorResponse("Rate limited", { status: 429, code: "rate_limited" });
			expect(res.status).toBe(429);
			const body = await res.json();
			// B3: canonical { success, code, message } + legacy `error` alias.
			expect(body).toEqual({
				success: false,
				code: "rate_limited",
				message: "Rate limited",
				error: "Rate limited",
			});
		});

		it("can carry a Zod-flatten payload via details", async () => {
			const res = adminErrorResponse("Invalid body", { details: { fieldErrors: { email: ["bad"] } } });
			const body = await res.json();
			expect(body).toEqual({
				success: false,
				message: "Invalid body",
				error: "Invalid body",
				details: { fieldErrors: { email: ["bad"] } },
			});
		});

		it("forwards Retry-After header so clients can back off", () => {
			const res = adminErrorResponse("slow down", { status: 429, headers: { "Retry-After": "30" } });
			expect(res.headers.get("retry-after")).toBe("30");
			expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		});
	});
});
