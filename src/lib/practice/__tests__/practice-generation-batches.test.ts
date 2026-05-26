import { describe, expect, it } from "vitest";

import type { PracticeGenerationBlueprintSlot } from "../practice-generation-blueprint-schema";
import type { PracticeGenerationGroupedOutput } from "../generation-schema";
import {
	buildBatchUserPromptTail,
	mergePracticeBatchOutputs,
	splitPracticeQuestionPlanIntoBatches,
} from "../practice-generation-batches";

function makeSlot(
	type: PracticeGenerationBlueprintSlot["question_type"],
	id: string,
): PracticeGenerationBlueprintSlot {
	return {
		slot_id: id,
		topic_id: "11111111-1111-1111-1111-111111111111",
		question_type: type,
		difficulty_level: "medium",
		skill_target: "test slot",
		evidence_refs: [],
		visual_intent: null,
	} as PracticeGenerationBlueprintSlot;
}

function makeFlatSlots(counts: {
	multiple_choice: number;
	fill_in_blank: number;
	short_answer: number;
	long_answer: number;
}): PracticeGenerationBlueprintSlot[] {
	const out: PracticeGenerationBlueprintSlot[] = [];
	for (let i = 0; i < counts.multiple_choice; i++) out.push(makeSlot("multiple_choice", `mcq-${i}`));
	for (let i = 0; i < counts.fill_in_blank; i++) out.push(makeSlot("fill_in_blank", `fib-${i}`));
	for (let i = 0; i < counts.short_answer; i++) out.push(makeSlot("short_answer", `sa-${i}`));
	for (let i = 0; i < counts.long_answer; i++) out.push(makeSlot("long_answer", `la-${i}`));
	return out;
}

describe("splitPracticeQuestionPlanIntoBatches — 1-hour plan", () => {
	const plan = {
		multiple_choice: 5,
		fill_in_blank: 5,
		short_answer: 3,
		long_answer: 2,
	};
	const slots = makeFlatSlots(plan);

	it("returns four batches with mcq / fib / sa / la labels", () => {
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches).toHaveLength(4);
		expect(batches.map((b) => b.label)).toEqual(["mcq", "fib", "sa", "la"]);
		expect(batches.map((b) => b.index)).toEqual([0, 1, 2, 3]);
	});

	it("assigns slot indexes [0..4], [5..9], [10..12], [13..14]", () => {
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches[0]!.slotIndexes).toEqual([0, 1, 2, 3, 4]);
		expect(batches[1]!.slotIndexes).toEqual([5, 6, 7, 8, 9]);
		expect(batches[2]!.slotIndexes).toEqual([10, 11, 12]);
		expect(batches[3]!.slotIndexes).toEqual([13, 14]);
	});

	it("each batch's typeCounts isolates one question type", () => {
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches[0]!.typeCounts).toEqual({
			multiple_choice: 5,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		});
		expect(batches[1]!.typeCounts).toEqual({
			multiple_choice: 0,
			fill_in_blank: 5,
			short_answer: 0,
			long_answer: 0,
		});
		expect(batches[2]!.typeCounts).toEqual({
			multiple_choice: 0,
			fill_in_blank: 0,
			short_answer: 3,
			long_answer: 0,
		});
		expect(batches[3]!.typeCounts).toEqual({
			multiple_choice: 0,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 2,
		});
	});

	it("each batch's slots match the declared question type", () => {
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches[0]!.slots.every((s) => s.question_type === "multiple_choice")).toBe(true);
		expect(batches[0]!.slots).toHaveLength(5);
		expect(batches[1]!.slots.every((s) => s.question_type === "fill_in_blank")).toBe(true);
		expect(batches[1]!.slots).toHaveLength(5);
		expect(batches[2]!.slots.every((s) => s.question_type === "short_answer")).toBe(true);
		expect(batches[2]!.slots).toHaveLength(3);
		expect(batches[3]!.slots.every((s) => s.question_type === "long_answer")).toBe(true);
		expect(batches[3]!.slots).toHaveLength(2);
	});
});

describe("splitPracticeQuestionPlanIntoBatches — 3-hour plan", () => {
	const plan = {
		multiple_choice: 10,
		fill_in_blank: 10,
		short_answer: 6,
		long_answer: 4,
	};
	const slots = makeFlatSlots(plan);

	it("scales to 10/10/6/4 batch sizes", () => {
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches.map((b) => b.slots.length)).toEqual([10, 10, 6, 4]);
		expect(batches.map((b) => b.label)).toEqual(["mcq", "fib", "sa", "la"]);
		expect(batches[2]!.typeCounts.short_answer).toBe(6);
		expect(batches[3]!.typeCounts.long_answer).toBe(4);
	});
});

describe("splitPracticeQuestionPlanIntoBatches — math (all MCQ)", () => {
	it("splits a 16-MCQ math plan into four 4-MCQ batches", () => {
		const plan = {
			multiple_choice: 16,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		};
		const slots = makeFlatSlots(plan);
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches.map((b) => b.label)).toEqual([
			"mcq_math",
			"mcq_math",
			"mcq_math",
			"mcq_math",
		]);
		expect(batches.map((b) => b.slots.length)).toEqual([4, 4, 4, 4]);
		expect(batches.every((b) => b.typeCounts.multiple_choice === b.slots.length)).toBe(true);
	});

	it("distributes a 15-MCQ plan as 4/4/4/3 (remainder to earlier batches)", () => {
		const plan = {
			multiple_choice: 15,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		};
		const slots = makeFlatSlots(plan);
		const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });
		expect(batches.map((b) => b.slots.length)).toEqual([4, 4, 4, 3]);
	});
});

describe("splitPracticeQuestionPlanIntoBatches — error cases", () => {
	it("throws when slots.length does not match plan total", () => {
		expect(() =>
			splitPracticeQuestionPlanIntoBatches({
				plan: { multiple_choice: 5, fill_in_blank: 5, short_answer: 3, long_answer: 2 },
				slots: makeFlatSlots({
					multiple_choice: 5,
					fill_in_blank: 5,
					short_answer: 3,
					long_answer: 1,
				}),
			}),
		).toThrow(/slots\.length/);
	});
});

describe("mergePracticeBatchOutputs", () => {
	function makeBatchOutput(
		mcq: number,
		fib: number,
		sa: number,
		la: number,
		rationale = "",
	): PracticeGenerationGroupedOutput {
		const fake = (n: number, prefix: string) =>
			Array.from({ length: n }, (_, i) => ({
				topic_id: "11111111-1111-1111-1111-111111111111",
				question_text: `${prefix}-${i}`,
				question_type: prefix as never,
				difficulty_level: "medium" as const,
				answer_key: "x",
				options: prefix === "multiple_choice" ? { A: "a", B: "b", C: "c", D: "d" } : null,
				estimated_time_seconds: 60,
				cognitive_demand: null,
				marks: null,
				visual: null,
			}));
		return {
			questions_by_type: {
				multiple_choice: fake(mcq, "multiple_choice"),
				fill_in_blank: fake(fib, "fill_in_blank"),
				short_answer: fake(sa, "short_answer"),
				long_answer: fake(la, "long_answer"),
			},
			generation_metadata: { adaptation_rationale: rationale },
		} as unknown as PracticeGenerationGroupedOutput;
	}

	it("concatenates batches into a single grouped output", () => {
		const merged = mergePracticeBatchOutputs([
			makeBatchOutput(5, 0, 0, 0),
			makeBatchOutput(0, 5, 0, 0),
			makeBatchOutput(0, 0, 3, 2),
		]);
		expect(merged.questions_by_type.multiple_choice).toHaveLength(5);
		expect(merged.questions_by_type.fill_in_blank).toHaveLength(5);
		expect(merged.questions_by_type.short_answer).toHaveLength(3);
		expect(merged.questions_by_type.long_answer).toHaveLength(2);
	});

	it("joins non-empty rationales with ' — '", () => {
		const merged = mergePracticeBatchOutputs([
			makeBatchOutput(1, 0, 0, 0, "first"),
			makeBatchOutput(0, 1, 0, 0, ""),
			makeBatchOutput(0, 0, 0, 1, "third"),
		]);
		expect(merged.generation_metadata.adaptation_rationale).toBe("first — third");
	});
});

describe("buildBatchUserPromptTail", () => {
	const plan = {
		multiple_choice: 5,
		fill_in_blank: 5,
		short_answer: 3,
		long_answer: 2,
	};
	const slots = makeFlatSlots(plan);
	const batches = splitPracticeQuestionPlanIntoBatches({ plan, slots });

	it("places BLUEPRINT_SLOTS_JSON before the BATCH CONTRACT block", () => {
		const tail = buildBatchUserPromptTail({
			batch: batches[0]!,
			totalBatches: 4,
			totalQuestionsInTest: 15,
		});
		const blueprintIdx = tail.indexOf("BLUEPRINT_SLOTS_JSON:");
		const contractIdx = tail.indexOf("## BATCH CONTRACT");
		expect(blueprintIdx).toBeGreaterThanOrEqual(0);
		expect(contractIdx).toBeGreaterThan(blueprintIdx);
	});

	it("SA batch (batch 3) declares its slot count and position range", () => {
		const tail = buildBatchUserPromptTail({
			batch: batches[2]!,
			totalBatches: 4,
			totalQuestionsInTest: 15,
		});
		expect(tail).toContain("batch 3 of 4");
		expect(tail).toContain("3 slot(s)");
		expect(tail).toContain("positions 10..12");
		expect(tail).toContain("short_answer ×3");
	});

	it("LA batch (batch 4) declares its slot count and position range", () => {
		const tail = buildBatchUserPromptTail({
			batch: batches[3]!,
			totalBatches: 4,
			totalQuestionsInTest: 15,
		});
		expect(tail).toContain("batch 4 of 4");
		expect(tail).toContain("2 slot(s)");
		expect(tail).toContain("positions 13..14");
		expect(tail).toContain("long_answer ×2");
	});

	it("only serializes the batch's slots (not the full blueprint)", () => {
		const tail = buildBatchUserPromptTail({
			batch: batches[0]!,
			totalBatches: 4,
			totalQuestionsInTest: 15,
		});
		expect(tail).toContain("mcq-0");
		expect(tail).toContain("mcq-4");
		expect(tail).not.toContain("fib-0");
		expect(tail).not.toContain("la-0");
	});
});
