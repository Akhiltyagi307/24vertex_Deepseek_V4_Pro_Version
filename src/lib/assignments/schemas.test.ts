import { describe, expect, it, vi } from "vitest";

import {
	assignmentConfigSchema,
	computeAssignedGradingRunAfter,
	computeAssignmentJobRunAfter,
	createAssignmentInputSchema,
} from "@/lib/assignments/schemas";

describe("assignment schemas", () => {
	it("accepts a practice-test config with subject and selected topics only", () => {
		const parsed = assignmentConfigSchema.parse({
			v: 1,
			kind: "practice_test",
			subject_id: "11111111-1111-1111-1111-111111111111",
			topic_ids: ["22222222-2222-2222-2222-222222222222"],
			difficulty: "medium",
			question_count: 15,
			time_limit_seconds: 3600,
		});

		expect(parsed.topic_ids).toEqual(["22222222-2222-2222-2222-222222222222"]);
		expect(parsed.question_count).toBe(15);
	});

	it("rejects question payloads in educator assignments", () => {
		expect(() =>
			assignmentConfigSchema.parse({
				v: 1,
				kind: "practice_test",
				subject_id: "11111111-1111-1111-1111-111111111111",
				topic_ids: ["22222222-2222-2222-2222-222222222222"],
				questions: [{ question_text: "Nope" }],
			}),
		).toThrow();
	});

	it("rejects a due date in the past", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-03T10:00:00+05:30"));
		const result = createAssignmentInputSchema.safeParse({
			title: "Algebra checkpoint",
			instructions: null,
			config: {
				v: 1,
				kind: "practice_test",
				subject_id: "11111111-1111-1111-1111-111111111111",
				topic_ids: ["22222222-2222-2222-2222-222222222222"],
				difficulty: "medium",
				question_count: 15,
				time_limit_seconds: 3600,
			},
			student_ids: ["33333333-3333-3333-3333-333333333333"],
			due_at: "2026-06-01T12:00",
		});
		vi.useRealTimers();
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes("future"))).toBe(true);
		}
	});

	it("normalizes publish input and requires selected students", () => {
		const parsed = createAssignmentInputSchema.parse({
			title: "  Algebra checkpoint  ",
			instructions: "  Try this before Friday.  ",
			config: {
				v: 1,
				kind: "practice_test",
				subject_id: "11111111-1111-1111-1111-111111111111",
				topic_ids: ["22222222-2222-2222-2222-222222222222"],
				difficulty: "easy",
				question_count: 15,
				time_limit_seconds: 3600,
			},
			student_ids: ["33333333-3333-3333-3333-333333333333"],
			due_at: "",
		});

		expect(parsed.title).toBe("Algebra checkpoint");
		expect(parsed.instructions).toBe("Try this before Friday.");
		expect(parsed.due_at).toBeNull();
		expect(parsed.student_ids).toEqual(["33333333-3333-3333-3333-333333333333"]);
	});

	it("spreads generation jobs deterministically without changing student order", () => {
		const base = new Date("2026-05-15T12:00:00.000Z");

		expect(computeAssignmentJobRunAfter(base, 0).toISOString()).toBe("2026-05-15T12:00:00.000Z");
		expect(computeAssignmentJobRunAfter(base, 3).toISOString()).toBe("2026-05-15T12:01:30.000Z");
	});

	it("adds deterministic submit-time grading jitter for assigned tests", () => {
		const base = new Date("2026-05-15T12:00:00.000Z");
		const studentId = "11111111-1111-1111-1111-111111111111";

		expect(computeAssignedGradingRunAfter(base, studentId).toISOString()).toBe(
			computeAssignedGradingRunAfter(base, studentId).toISOString(),
		);
		expect(computeAssignedGradingRunAfter(base, studentId).getTime()).toBeGreaterThanOrEqual(base.getTime());
		expect(computeAssignedGradingRunAfter(base, studentId).getTime()).toBeLessThanOrEqual(
			base.getTime() + 5 * 60_000,
		);
	});
});
