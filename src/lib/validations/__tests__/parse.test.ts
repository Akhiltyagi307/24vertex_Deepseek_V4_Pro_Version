import { describe, expect, it } from "vitest";
import { z } from "zod";

import { safeParseOrError } from "@/lib/validations/parse";

const schema = z.object({ a: z.number(), b: z.string() });

describe("safeParseOrError", () => {
	it("returns ok + parsed data on valid input", () => {
		const result = safeParseOrError(schema, { a: 1, b: "x" });
		expect(result).toEqual({ ok: true, data: { a: 1, b: "x" } });
	});

	it("returns ok:false with a default message and issue summary on invalid input", () => {
		const result = safeParseOrError(schema, { a: "nope" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("Unexpected data shape.");
			// Both the wrong-typed `a` and the missing `b` should be summarised.
			expect(result.issues.some((i) => i.startsWith("a:"))).toBe(true);
			expect(result.issues.some((i) => i.startsWith("b:"))).toBe(true);
		}
	});

	it("supports a custom user-facing message", () => {
		const result = safeParseOrError(schema, null, "Bad streak snapshot.");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBe("Bad streak snapshot.");
	});

	it("caps the issue summary at 5 entries", () => {
		const wide = z.object({
			a: z.number(),
			b: z.number(),
			c: z.number(),
			d: z.number(),
			e: z.number(),
			f: z.number(),
			g: z.number(),
		});
		const result = safeParseOrError(wide, {});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.issues.length).toBeLessThanOrEqual(5);
	});
});
