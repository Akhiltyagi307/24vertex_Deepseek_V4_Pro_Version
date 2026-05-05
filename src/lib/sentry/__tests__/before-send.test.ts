/**
 * Tests for the Sentry beforeSend scrubber. The scrubber is the only line of
 * defense against PII reaching Sentry storage — when it changes, every claim
 * the project makes about "we never log raw user emails or UUIDs" depends on
 * these tests still holding.
 */
import { describe, expect, it } from "vitest";

import { hashUserIdForSentry, scrubSentryEvent } from "@/lib/sentry/before-send";

describe("hashUserIdForSentry", () => {
	it("returns the same hash for the same input (groupable in Sentry)", () => {
		const a = hashUserIdForSentry("aaaaaaaa-1111-2222-3333-444444444444");
		const b = hashUserIdForSentry("aaaaaaaa-1111-2222-3333-444444444444");
		expect(a).toBe(b);
	});

	it("differs for different inputs", () => {
		const a = hashUserIdForSentry("aaaaaaaa-1111-2222-3333-444444444444");
		const b = hashUserIdForSentry("bbbbbbbb-1111-2222-3333-444444444444");
		expect(a).not.toBe(b);
	});

	it("uses the usr_ prefix so hashed values are recognizable in dashboards", () => {
		expect(hashUserIdForSentry("anything")).toMatch(/^usr_[0-9a-f]{8}$/);
	});

	it("passes empty string through unchanged (no spurious usr_ prefix)", () => {
		expect(hashUserIdForSentry("")).toBe("");
	});
});

describe("scrubSentryEvent — user identity", () => {
	it("hashes user.id (UUID); never sends the raw value", () => {
		const event = { user: { id: "aaaaaaaa-1111-2222-3333-444444444444" } };
		scrubSentryEvent(event);
		expect(event.user.id).not.toBe("aaaaaaaa-1111-2222-3333-444444444444");
		expect(event.user.id).toMatch(/^usr_[0-9a-f]{8}$/);
	});

	it("redacts user.email outright (not hashed — emails are the higher-risk PII)", () => {
		const event = { user: { email: "alice@example.com" } };
		scrubSentryEvent(event);
		expect(event.user.email).toBe("[redacted]");
	});

	it("redacts user.username (could be a school identifier)", () => {
		const event = { user: { username: "alice.smith.2027" } };
		scrubSentryEvent(event);
		expect(event.user.username).toBe("[redacted]");
	});

	it("hashes user.ip_address so groupings work without storing the raw IP", () => {
		const event = { user: { ip_address: "203.0.113.42" } };
		scrubSentryEvent(event);
		expect(event.user.ip_address).toMatch(/^usr_[0-9a-f]{8}$/);
	});

	it("leaves the user object alone if no recognized PII fields are present", () => {
		const event = { user: { segment: "students" } } as Record<string, unknown>;
		scrubSentryEvent(event);
		expect(event.user).toEqual({ segment: "students" });
	});
});

describe("scrubSentryEvent — request + breadcrumbs", () => {
	it("redacts request body, query string, cookies", () => {
		const event = {
			request: {
				data: { password: "p" },
				query_string: "?email=x@y",
				cookies: "session=...",
				headers: {},
			},
		};
		scrubSentryEvent(event);
		expect(event.request.data).toBe("[redacted]");
		expect(event.request.query_string).toBe("[redacted]");
		expect(event.request.cookies).toBe("[redacted]");
	});

	it("redacts sensitive request headers but keeps innocuous ones", () => {
		const event = {
			request: {
				headers: {
					Authorization: "Bearer secret",
					Cookie: "session=...",
					"x-razorpay-signature": "abc",
					"User-Agent": "test",
				},
			},
		};
		scrubSentryEvent(event);
		const h = event.request.headers as Record<string, string>;
		expect(h.Authorization).toBe("[redacted]");
		expect(h.Cookie).toBe("[redacted]");
		expect(h["x-razorpay-signature"]).toBe("[redacted]");
		expect(h["User-Agent"]).toBe("test");
	});

	it("redacts emails inside breadcrumb messages", () => {
		const event = {
			breadcrumbs: [
				{ message: "user signed in alice@example.com" },
				{ message: "no email here" },
			],
		};
		scrubSentryEvent(event);
		expect(event.breadcrumbs[0]!.message).toBe("user signed in [email]");
		expect(event.breadcrumbs[1]!.message).toBe("no email here");
	});

	it("redacts emails in event.message", () => {
		const event = { message: "Email failed to send to alice@example.com" };
		scrubSentryEvent(event);
		expect(event.message).toBe("Email failed to send to [email]");
	});

	it("redacts URL-encoded emails (%40) in breadcrumb messages", () => {
		const event = {
			breadcrumbs: [{ message: "GET /unsubscribe?email=alice%40example.com&t=abc" }],
		};
		scrubSentryEvent(event);
		// The query-param redactor and URL-encoded redactor both fire; either
		// sentinel means "the address is gone" — what matters is that no part
		// of the original local-part or domain leaks. We check both halves
		// rather than locking down one specific replacement order.
		expect(event.breadcrumbs[0]!.message).not.toContain("alice%40example.com");
		expect(event.breadcrumbs[0]!.message).not.toContain("alice");
		expect(event.breadcrumbs[0]!.message).not.toContain("example.com");
	});

	it("redacts bare `email=` query param values (catches non-URL-encoded path)", () => {
		const event = { message: "Trying email=alice@example.com&t=abc" };
		scrubSentryEvent(event);
		// The raw email gets caught by EMAIL_RE first; the query-param fallback
		// catches values that weren't email-shaped (e.g. a corrupted entry).
		expect(event.message).not.toContain("alice@example.com");
	});

	it("redacts user_email= and recipient= query params too", () => {
		const event = { message: "params: user_email=foo&recipient=bar&other=baz" };
		scrubSentryEvent(event);
		expect(event.message).toContain("user_email=[redacted]");
		expect(event.message).toContain("recipient=[redacted]");
		expect(event.message).toContain("other=baz");
	});
});
