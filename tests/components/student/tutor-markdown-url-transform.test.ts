/**
 * Locks down the tutor-markdown URL allowlist. ReactMarkdown's `urlTransform`
 * is what stops a future "pipe user-authored notes through tutor renderer"
 * feature from inheriting an XSS surface via `javascript:` / `data:` href.
 */
import { describe, expect, it } from "vitest";

import { __test_safeMarkdownUrl as safe } from "@/components/student/doubt/tutor-markdown";

describe("safeMarkdownUrl", () => {
	it("accepts https URLs", () => {
		expect(safe("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
	});

	it("accepts http URLs", () => {
		expect(safe("http://example.com/")).toBe("http://example.com/");
	});

	it("accepts mailto URLs", () => {
		expect(safe("mailto:hello@example.com")).toBe("mailto:hello@example.com");
	});

	it("rejects javascript: URLs", () => {
		expect(safe("javascript:alert(1)")).toBe("");
	});

	it("rejects data: URLs", () => {
		expect(safe("data:text/html,<script>alert(1)</script>")).toBe("");
	});

	it("rejects file: URLs", () => {
		expect(safe("file:///etc/passwd")).toBe("");
	});

	it("rejects vbscript: URLs", () => {
		expect(safe("vbscript:msgbox()")).toBe("");
	});

	it("preserves relative URLs (resolved against fallback origin → http(s) protocol)", () => {
		// Relative path: parser resolves it against the fallback base, which yields
		// https:; the allowlist accepts it.
		expect(safe("/some/path")).toBe("/some/path");
		expect(safe("#anchor")).toBe("#anchor");
	});

	it("rejects unknown schemes that successfully parse", () => {
		// `ht!tp://...` actually parses to scheme `ht!tp:` in some implementations,
		// or fails to parse in others — either way the result must NOT be the
		// allowlist's https/http/mailto, so the function returns "".
		const out = safe("ftp://example.com/x");
		expect(out).toBe("");
	});
});
