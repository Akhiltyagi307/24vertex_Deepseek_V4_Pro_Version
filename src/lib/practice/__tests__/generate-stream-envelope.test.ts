/**
 * Regression coverage for the Sprint 1 streaming-envelope fix.
 *
 * Before that fix, a failed generation produced `{ type: "done", result: {ok:false, ...} }`
 * which the client treated as success and rendered an empty test. The
 * helpers under test here lock down the contract that:
 *
 *   - successful `GeneratePracticeResult` → `{ type: "done", result }`
 *   - failed `GeneratePracticeResult`     → `{ type: "error", code, message }`
 *   - thrown exception                    → `{ type: "error", message }` (no code)
 *
 * If any future refactor regresses these shapes, this test fires.
 */
import { describe, expect, it } from "vitest";

import {
	envelopeForPartial,
	envelopeForResult,
	envelopeForThrown,
} from "@/lib/practice/generate-stream-envelope";
import type { GeneratePracticeResult } from "../../../../app/student/practice/actions/types";

describe("envelopeForResult", () => {
	it("emits `done` for a successful pipeline result", () => {
		const success: GeneratePracticeResult = {
			ok: true,
			testId: "00000000-0000-0000-0000-000000000001",
			subjectName: "Maths",
			questions: [],
			generation_metadata: {
				topic_distribution: {},
				difficulty_distribution: {},
				type_distribution: {},
				adaptation_rationale: "",
			},
		};
		const env = envelopeForResult(success);
		expect(env.type).toBe("done");
		if (env.type === "done") {
			expect(env.result).toBe(success);
		}
	});

	it("emits `error` (NOT `done`) for a failed pipeline result — Sprint 1 regression cover", () => {
		const failure: GeneratePracticeResult = {
			ok: false,
			code: "generation_failed",
			message: "model returned junk",
		};
		const env = envelopeForResult(failure);
		// Critical: the envelope MUST NOT be `done` when result.ok is false.
		expect(env.type).toBe("error");
		if (env.type === "error") {
			expect(env.code).toBe("generation_failed");
			expect(env.message).toBe("model returned junk");
		}
	});

	it("preserves the pipeline `code` so clients can branch on it", () => {
		const failure: GeneratePracticeResult = {
			ok: false,
			code: "generation_invalid",
			message: "schema mismatch",
		};
		const env = envelopeForResult(failure);
		expect(env).toMatchObject({ type: "error", code: "generation_invalid" });
	});

	it("forwards correlationId from pipeline failures", () => {
		const failure: GeneratePracticeResult = {
			ok: false,
			code: "generation_failed",
			message: "timeout",
			correlationId: "corr_123",
		};
		const env = envelopeForResult(failure);
		expect(env).toMatchObject({ type: "error", correlationId: "corr_123" });
	});

	it("truncates failure messages over 400 chars with an ellipsis", () => {
		const huge = "x".repeat(900);
		const failure: GeneratePracticeResult = {
			ok: false,
			code: "generation_failed",
			message: huge,
		};
		const env = envelopeForResult(failure);
		if (env.type !== "error") throw new Error("expected error envelope");
		expect(env.message.length).toBe(401); // 400 chars + ellipsis
		expect(env.message.endsWith("…")).toBe(true);
	});

	it("does NOT truncate short messages (no ellipsis added)", () => {
		const failure: GeneratePracticeResult = {
			ok: false,
			code: "generation_failed",
			message: "short error",
		};
		const env = envelopeForResult(failure);
		if (env.type !== "error") throw new Error("expected error envelope");
		expect(env.message).toBe("short error");
		expect(env.message.endsWith("…")).toBe(false);
	});
});

describe("envelopeForThrown", () => {
	it("uses the Error message and omits a code (thrown != stable taxonomy)", () => {
		const env = envelopeForThrown(new Error("OpenAI 502"));
		expect(env).toEqual({ type: "error", message: "OpenAI 502" });
		// Importantly NOT carrying a `code` — thrown exceptions get no stable code.
		expect((env as { code?: string }).code).toBeUndefined();
	});

	it("falls back to a generic message for non-Error thrown values", () => {
		const env = envelopeForThrown("string-throw");
		expect(env.message).toBe("Generation failed.");
	});

	it("truncates verbose stack/error text the same way as failure results", () => {
		const env = envelopeForThrown(new Error("z".repeat(1200)));
		expect(env.message.length).toBe(401);
		expect(env.message.endsWith("…")).toBe(true);
	});
});

describe("envelopeForPartial", () => {
	it("wraps the partial under the `partial` discriminator", () => {
		expect(envelopeForPartial({ x: 1 })).toEqual({ type: "partial", partial: { x: 1 } });
	});
});
