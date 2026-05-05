/**
 * Locks down the Razorpay redirect-origin allowlist. The hosted-checkout
 * fallback navigates the browser to `data.shortUrl` from our server — these
 * tests are the gate that catches a future regression returning anything
 * other than the three Razorpay-controlled origins.
 */
import { describe, expect, it } from "vitest";

import { __test_safeRazorpayRedirect as safe } from "@/components/student/subscription/razorpay-checkout";

describe("safeRazorpayRedirect", () => {
	it("accepts api.razorpay.com URLs", () => {
		expect(safe("https://api.razorpay.com/v1/invoices/inv_xyz")).toBe(
			"https://api.razorpay.com/v1/invoices/inv_xyz",
		);
	});

	it("accepts rzp.io short URLs", () => {
		expect(safe("https://rzp.io/i/abc123")).toBe("https://rzp.io/i/abc123");
	});

	it("accepts checkout.razorpay.com URLs", () => {
		expect(safe("https://checkout.razorpay.com/v1/checkout.js")).toBe(
			"https://checkout.razorpay.com/v1/checkout.js",
		);
	});

	it("rejects malformed URLs", () => {
		expect(() => safe("not-a-url")).toThrow(/malformed/i);
	});

	it("rejects same-host but different scheme", () => {
		expect(() => safe("http://api.razorpay.com/x")).toThrow(/untrusted/i);
	});

	it("rejects look-alike domains", () => {
		expect(() => safe("https://razorpay.com.evil.example/path")).toThrow(/untrusted/i);
		expect(() => safe("https://api-razorpay.com/x")).toThrow(/untrusted/i);
	});

	it("rejects javascript: and data: schemes", () => {
		expect(() => safe("javascript:alert(1)")).toThrow();
		expect(() => safe("data:text/html,<script>alert(1)</script>")).toThrow();
	});

	it("rejects URLs with embedded credentials pointing elsewhere", () => {
		// The URL parser's `origin` is "null" for opaque schemes and the host for
		// http(s); credentials don't affect origin, but make sure we don't trust
		// a URL whose visible host is razorpay-ish but real host is evil.
		expect(() => safe("https://api.razorpay.com@evil.example/x")).toThrow(/untrusted/i);
	});
});
