import { describe, expect, it } from "vitest";

import { nIncorrectFromStatus } from "@/lib/admin/performance-status-map";

describe("nIncorrectFromStatus idempotence-style mapping", () => {
	it("is stable for repeated calls (pure)", () => {
		for (let i = 0; i < 200; i++) {
			const s = i % 3 === 0 ? "good" : i % 3 === 1 ? "satisfactory" : "bad";
			const a = nIncorrectFromStatus(s);
			const b = nIncorrectFromStatus(s);
			expect(a).toBe(b);
		}
	});

	it("maps expected buckets", () => {
		expect(nIncorrectFromStatus("good")).toBe(0);
		expect(nIncorrectFromStatus("satisfactory")).toBe(1);
		expect(nIncorrectFromStatus("bad")).toBe(2);
	});
});
