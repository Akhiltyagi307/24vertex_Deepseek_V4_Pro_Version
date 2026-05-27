import { describe, expect, it, vi } from "vitest";

import { withSupabaseRetry } from "../retry-helper";

describe("withSupabaseRetry", () => {
	it("returns the result when the first attempt succeeds (no retries)", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withSupabaseRetry(fn);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries with backoff and succeeds on the second attempt", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("fetch failed"))
			.mockResolvedValueOnce("ok");
		const result = await withSupabaseRetry(fn, { delaysMs: [1] });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("retries up to delaysMs.length + 1 times, then rethrows the last error", async () => {
		const finalError = new Error("persistent");
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("blip 1"))
			.mockRejectedValueOnce(new Error("blip 2"))
			.mockRejectedValueOnce(finalError);
		await expect(
			withSupabaseRetry(fn, { delaysMs: [1, 1] }),
		).rejects.toThrow("persistent");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("uses the default 3-retry schedule when delaysMs is omitted", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("always-fail"));
		// 4 calls = 1 initial + 3 retries.
		await expect(withSupabaseRetry(fn)).rejects.toThrow("always-fail");
		expect(fn).toHaveBeenCalledTimes(4);
	});

	it("respects custom delaysMs length", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("err"));
		await expect(
			withSupabaseRetry(fn, { delaysMs: [1, 1, 1, 1, 1] }),
		).rejects.toThrow("err");
		// 1 + 5 retries = 6 calls
		expect(fn).toHaveBeenCalledTimes(6);
	});

	it("passes context through without inspecting it (smoke)", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withSupabaseRetry(fn, { context: "test.context" });
		expect(result).toBe("ok");
	});
});
