/**
 * Unit tests for `readIdempotencyKey` — the only piece of `cron-idempotency`
 * that is fully testable without a Supabase service-role client. The
 * `beginCronRun` / `completeCronRun` paths are integration-tested separately
 * (gated by DATABASE_URL), since they exercise the `cron_run_log` table.
 */
import { describe, expect, it } from "vitest";

import { readIdempotencyKey } from "@/lib/internal/cron-idempotency";

function reqWith(headers: Record<string, string>): Request {
	return new Request("http://localhost/api/internal/example", { headers });
}

describe("readIdempotencyKey", () => {
	it("returns null when the header is missing", () => {
		expect(readIdempotencyKey(reqWith({}))).toBeNull();
	});

	it("returns null for keys shorter than 8 chars (DB CHECK would reject anyway)", () => {
		expect(readIdempotencyKey(reqWith({ "Idempotency-Key": "short" }))).toBeNull();
	});

	it("returns null for keys longer than 200 chars", () => {
		const long = "a".repeat(201);
		expect(readIdempotencyKey(reqWith({ "Idempotency-Key": long }))).toBeNull();
	});

	it("returns the trimmed key on the happy path", () => {
		expect(readIdempotencyKey(reqWith({ "Idempotency-Key": "  trial-emails-2026-05-05  " }))).toBe(
			"trial-emails-2026-05-05",
		);
	});

	it("matches the header name case-insensitively (Request normalizes)", () => {
		expect(readIdempotencyKey(reqWith({ "idempotency-key": "trial-emails-2026-05-05" }))).toBe(
			"trial-emails-2026-05-05",
		);
	});
});
