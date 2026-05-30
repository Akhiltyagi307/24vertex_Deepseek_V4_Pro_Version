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

describe("scrubSentryEvent — JWT and token redaction (Phase 4.6)", () => {
	const FAKE_JWT =
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

	it("redacts JWT-shaped tokens in event.message", () => {
		const event = { message: `Auth failed: token=${FAKE_JWT} expired` };
		scrubSentryEvent(event);
		expect(event.message).not.toContain(FAKE_JWT);
		// Either the JWT regex caught it OR the `token=` query-param regex did;
		// both produce a redaction.
		expect(event.message).toMatch(/\[(jwt|redacted)\]/);
	});

	it("redacts JWT-shaped tokens in breadcrumb messages", () => {
		const event = {
			breadcrumbs: [{ message: `Bearer ${FAKE_JWT}` }],
		};
		scrubSentryEvent(event);
		expect(event.breadcrumbs[0]!.message).not.toContain(FAKE_JWT);
		expect(event.breadcrumbs[0]!.message).toContain("[jwt]");
	});

	it("does not redact ordinary `foo.bar.baz` package names (segments too short)", () => {
		const event = { message: "loaded module @acme/foo.bar.baz from registry" };
		scrubSentryEvent(event);
		expect(event.message).toContain("foo.bar.baz");
	});

	it("redacts long hex tokens (Razorpay payment ids, signatures)", () => {
		const fakeSig = "0123456789abcdef0123456789abcdef0123456789abcdef";
		const event = { message: `webhook signature ${fakeSig} mismatch` };
		scrubSentryEvent(event);
		expect(event.message).not.toContain(fakeSig);
		expect(event.message).toContain("[token]");
	});

	it("preserves UUIDs and short commit hashes (debuggability)", () => {
		const event = {
			message: "test 00000000-0000-0000-0000-000000000001 at sha 7f3a9e0",
		};
		scrubSentryEvent(event);
		// 36-char UUID stays (not 40+ hex)
		expect(event.message).toContain("00000000-0000-0000-0000-000000000001");
		// 7-char commit hash stays
		expect(event.message).toContain("7f3a9e0");
	});

	it("redacts token / secret / password query params", () => {
		const event = {
			message:
				"GET /x?access_token=eyJabcdefghijklmnop&password=hunter2&signature=deadbeef0123456789ab&keep=ok",
		};
		scrubSentryEvent(event);
		expect(event.message).toContain("access_token=[redacted]");
		expect(event.message).toContain("password=[redacted]");
		expect(event.message).toContain("signature=[redacted]");
		expect(event.message).toContain("keep=ok");
	});
});

describe("scrubSentryEvent — extra / contexts / tags / breadcrumb.data (M-3)", () => {
	it("redacts emails and tokens nested inside event.extra", () => {
		const event = {
			extra: {
				note: "contacting alice@example.com",
				nested: { sig: "0123456789abcdef0123456789abcdef0123456789abcdef" },
			},
		} as Record<string, unknown>;
		scrubSentryEvent(event);
		const extra = event.extra as { note: string; nested: { sig: string } };
		expect(extra.note).toBe("contacting [email]");
		expect(extra.nested.sig).toBe("[token]");
	});

	it("redacts values under sensitive keys wholesale, regardless of type", () => {
		const event = {
			extra: {
				answer_key: ["B", "C", "A"],
				razorpay_signature: "abcd",
				password: "hunter2",
				keep: "ok",
			},
		} as Record<string, unknown>;
		scrubSentryEvent(event);
		const extra = event.extra as Record<string, unknown>;
		expect(extra.answer_key).toBe("[redacted]");
		expect(extra.razorpay_signature).toBe("[redacted]");
		expect(extra.password).toBe("[redacted]");
		expect(extra.keep).toBe("ok");
	});

	it("redacts PII inside breadcrumb.data (console-integration structured args)", () => {
		const event = {
			breadcrumbs: [{ category: "console", message: "log", data: { studentEmail: "x", value: "ping alice@example.com" } }],
		} as Record<string, unknown>;
		scrubSentryEvent(event);
		const data = (event.breadcrumbs as Array<{ data: Record<string, unknown> }>)[0]!.data;
		expect(data.value).toBe("ping [email]");
	});

	it("does not hang on a circular structure (cycle guard)", () => {
		const cyclic: Record<string, unknown> = { a: 1 };
		cyclic.self = cyclic;
		const event = { extra: cyclic } as Record<string, unknown>;
		expect(() => scrubSentryEvent(event)).not.toThrow();
	});
});
