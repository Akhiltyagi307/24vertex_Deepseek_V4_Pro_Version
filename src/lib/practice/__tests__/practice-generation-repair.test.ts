import { describe, expect, it } from "vitest";

import { buildPracticeGenerationRepairUserPrompt } from "../practice-generation-repair";

describe("buildPracticeGenerationRepairUserPrompt", () => {
	const baseArgs = {
		timeLimitSeconds: 3600,
		timeSumMin: 2160,
		timeSumMax: 4320,
		allowedTopicIds: ["11111111-1111-1111-1111-111111111111"],
		questionTypeCounts: {
			multiple_choice: 1,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		},
		failedGroupedJson: JSON.stringify({
			questions_by_type: {
				multiple_choice: [
					{
						topic_id: "11111111-1111-1111-1111-111111111111",
						topic_name: "Topic",
						question_text: "Question text",
						difficulty_level: "easy",
						options: { A: "1", B: "2", C: "3", D: "4" },
						answer_key: {
							correct_answer: "A",
							explanation: "Because",
							common_mistakes: [],
							related_concept: "concept",
						},
						estimated_time_seconds: 60,
						visual: null,
					},
				],
				fill_in_blank: [],
				short_answer: [],
				long_answer: [],
			},
			generation_metadata: {
				adaptation_rationale: "x",
			},
		}),
		flatIndexMap: [{ flattenedIndex: 0, bucket: "multiple_choice" as const, slotInBucket: 0 }],
	};

	it("includes targeted context when provided", () => {
		const prompt = buildPracticeGenerationRepairUserPrompt({
			...baseArgs,
			reason: {
				kind: "quality",
				code: "visual_label_mismatch",
				message: "Stem label missing",
				failedIndexes: [0],
			},
			targetedContextJson: JSON.stringify({ failed_indexes: [0] }),
		});
		expect(prompt).toContain("TARGETED_CONTEXT_JSON:");
		expect(prompt).toContain(`{"failed_indexes":[0]}`);
	});

	it("does not include full generation context unless explicitly enabled", () => {
		const prompt = buildPracticeGenerationRepairUserPrompt({
			...baseArgs,
			reason: {
				kind: "quality",
				code: "chunk_alignment_weak",
				message: "Weak chunk alignment",
				failedIndexes: [0],
			},
			baseUserPrompt: '{"large":"payload"}',
			includeBaseUserPrompt: false,
		});
		expect(prompt).not.toContain("\nGENERATION_CONTEXT_USER_MESSAGE:\n");
	});

	it("includes full generation context when explicitly enabled", () => {
		const prompt = buildPracticeGenerationRepairUserPrompt({
			...baseArgs,
			reason: {
				kind: "quality",
				code: "chunk_alignment_weak",
				message: "Weak chunk alignment",
				failedIndexes: [0],
			},
			baseUserPrompt: '{"large":"payload"}',
			includeBaseUserPrompt: true,
		});
		expect(prompt).toContain("GENERATION_CONTEXT_USER_MESSAGE");
	});
});
