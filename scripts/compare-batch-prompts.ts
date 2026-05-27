#!/usr/bin/env npx tsx
/**
 * Compare the v1 (current) and v2 parallel-batch prompts side-by-side WITHOUT
 * making any LLM calls. Builds a realistic mock job context, runs both prompt
 * builders for all 4 batches of a 15-question Physics test and a 12-MCQ
 * Mathematics test, and writes a markdown report with prompt sizes, estimated
 * tokens, and full-content dumps for inspection.
 *
 * Run: pnpm tsx scripts/compare-batch-prompts.ts
 * Output: ./tmp/compare-batch-prompts.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBatchSystemPromptV2 } from "../src/lib/practice/practice-generation-batch-system-prompt";
import {
	buildBatchUserPromptTail,
	splitPracticeQuestionPlanIntoBatches,
	type PracticeGenerationBatch,
} from "../src/lib/practice/practice-generation-batches";
import { buildBatchUserPromptTailV2 } from "../src/lib/practice/practice-generation-batch-contract";
import { computePracticeBatchBudget } from "../src/lib/practice/practice-generation-batch-budget";
import { buildSisterBriefForBatch } from "../src/lib/practice/practice-generation-batch-sister-brief";
import {
	buildPracticeSystemPrompt,
	type UserMessageSummary,
	type PracticeGenerationSubjectContext,
} from "../src/lib/practice/system-prompt";
import type { PracticeGenerationBlueprintSlot } from "../src/lib/practice/practice-generation-blueprint-schema";
import type { QuestionVisualKind } from "../src/lib/practice/visuals/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "tmp");
const OUT_PATH = path.join(OUT_DIR, "compare-batch-prompts.md");

const PHYSICS_TOPIC_IDS = [
	"11111111-1111-1111-1111-111111111111",
	"22222222-2222-2222-2222-222222222222",
	"33333333-3333-3333-3333-333333333333",
];
const MATH_TOPIC_IDS = [
	"44444444-4444-4444-4444-444444444444",
	"55555555-5555-5555-5555-555555555555",
];

const PHYSICS_VISUAL_KINDS: QuestionVisualKind[] = [
	"physics_diagram",
	"math_geometry",
	"math_function_plot",
	"data_table",
];

function makeSlot(args: {
	index: number;
	type: "multiple_choice" | "fill_in_blank" | "short_answer" | "long_answer";
	topicId: string;
	difficulty: "easy" | "medium" | "hard";
	bloomVerb: string;
	skillTail: string;
	misconception?: string;
	subSkillChain?: string;
	wantsVisual?: boolean;
}): PracticeGenerationBlueprintSlot {
	const skill_target = `${args.bloomVerb} ${args.skillTail}.`;
	const visual_intent = args.wantsVisual
		? {
				needs_visual: true,
				priority: "high" as const,
				preferred_kind: "physics_diagram",
				reason: args.misconception ?? null,
				visual_idea: "Free-body diagram with relevant force vectors and labelled angles.",
				required: true,
				purpose: args.subSkillChain ?? null,
			}
		: args.misconception || args.subSkillChain
			? {
					needs_visual: false,
					priority: "none" as const,
					preferred_kind: null,
					reason: args.misconception ?? null,
					visual_idea: null,
					required: false,
					purpose: args.subSkillChain ?? null,
				}
			: null;
	return {
		slot_id: `${args.type}_${args.index + 1}`,
		topic_id: args.topicId,
		question_type: args.type,
		difficulty_level: args.difficulty,
		skill_target,
		evidence_refs: [`${args.topicId}:exercise:0`, `${args.topicId}:content:1`],
		visual_intent: visual_intent as PracticeGenerationBlueprintSlot["visual_intent"],
	} as PracticeGenerationBlueprintSlot;
}

function physicsSlots(): PracticeGenerationBlueprintSlot[] {
	const slots: PracticeGenerationBlueprintSlot[] = [];
	// 5 MCQ
	slots.push(
		makeSlot({
			index: 0,
			type: "multiple_choice",
			topicId: PHYSICS_TOPIC_IDS[0]!,
			difficulty: "easy",
			bloomVerb: "Identify",
			skillTail: "the SI unit of work from a list",
			misconception: "confused N·m with W (watt)",
		}),
		makeSlot({
			index: 1,
			type: "multiple_choice",
			topicId: PHYSICS_TOPIC_IDS[1]!,
			difficulty: "medium",
			bloomVerb: "Apply",
			skillTail: "Newton's 2nd law on a 30° frictionless incline given mass and g",
			misconception: "trap: confusing mg·sin θ with mg·cos θ",
			wantsVisual: true,
		}),
		makeSlot({
			index: 2,
			type: "multiple_choice",
			topicId: PHYSICS_TOPIC_IDS[2]!,
			difficulty: "medium",
			bloomVerb: "Calculate",
			skillTail: "maximum static-friction speed for a cyclist on a 4 m radius turn",
			misconception: "dropped the square root in v = √(μgr)",
			wantsVisual: true,
		}),
		makeSlot({
			index: 3,
			type: "multiple_choice",
			topicId: PHYSICS_TOPIC_IDS[0]!,
			difficulty: "medium",
			bloomVerb: "Compare",
			skillTail: "kinetic and static friction coefficients in a sliding-block scenario",
			misconception: "swapped μ_s and μ_k values",
		}),
		makeSlot({
			index: 4,
			type: "multiple_choice",
			topicId: PHYSICS_TOPIC_IDS[1]!,
			difficulty: "hard",
			bloomVerb: "Analyze",
			skillTail: "the effect of doubling mass on stopping distance under constant friction",
			misconception: "assumed distance scales linearly with mass",
		}),
	);
	// 3 FIB
	slots.push(
		makeSlot({
			index: 5,
			type: "fill_in_blank",
			topicId: PHYSICS_TOPIC_IDS[0]!,
			difficulty: "easy",
			bloomVerb: "Compute",
			skillTail: "the work done by a 10 N force pushing a box 5 m horizontally (in joules)",
			misconception: "added F and d instead of multiplying",
		}),
		makeSlot({
			index: 6,
			type: "fill_in_blank",
			topicId: PHYSICS_TOPIC_IDS[2]!,
			difficulty: "medium",
			bloomVerb: "Compute",
			skillTail: "the coefficient of friction when a 5 kg block slides at constant velocity under a 15 N applied force",
			misconception: "used m·g instead of normal force",
		}),
		makeSlot({
			index: 7,
			type: "fill_in_blank",
			topicId: PHYSICS_TOPIC_IDS[1]!,
			difficulty: "medium",
			bloomVerb: "Compute",
			skillTail: "the acceleration of a system from a Newton 2 setup (in m/s²)",
			misconception: "forgot to convert grams to kilograms",
		}),
	);
	// 4 SA
	slots.push(
		makeSlot({
			index: 8,
			type: "short_answer",
			topicId: PHYSICS_TOPIC_IDS[2]!,
			difficulty: "medium",
			bloomVerb: "Derive",
			skillTail: "the maximum-speed expression for a banked curve from the centripetal-force equation",
			subSkillChain: "set up centripetal force -> apply Newton 2 along normal -> solve for v",
		}),
		makeSlot({
			index: 9,
			type: "short_answer",
			topicId: PHYSICS_TOPIC_IDS[0]!,
			difficulty: "medium",
			bloomVerb: "Explain",
			skillTail: "why a heavier object does not necessarily slide farther on the same surface",
			subSkillChain: "list forces -> compare friction vs weight -> conclude",
		}),
		makeSlot({
			index: 10,
			type: "short_answer",
			topicId: PHYSICS_TOPIC_IDS[1]!,
			difficulty: "hard",
			bloomVerb: "Compare",
			skillTail: "kinetic vs static friction with two worked numerical setups",
			subSkillChain: "define each -> compute both -> contrast results",
		}),
		makeSlot({
			index: 11,
			type: "short_answer",
			topicId: PHYSICS_TOPIC_IDS[2]!,
			difficulty: "hard",
			bloomVerb: "Derive",
			skillTail: "the relationship between coefficient of friction and angle of repose",
			subSkillChain: "free-body at threshold -> equate tan(θ) with μ -> interpret",
		}),
	);
	// 3 LA
	slots.push(
		makeSlot({
			index: 12,
			type: "long_answer",
			topicId: PHYSICS_TOPIC_IDS[0]!,
			difficulty: "hard",
			bloomVerb: "Analyze",
			skillTail: "the motion of a 2 kg block on a 30° incline with kinetic friction 0.2 over the first 3 m of slide",
			subSkillChain: "free-body diagram -> resolve forces -> Newton 2 along incline -> kinematics for distance/velocity",
		}),
		makeSlot({
			index: 13,
			type: "long_answer",
			topicId: PHYSICS_TOPIC_IDS[1]!,
			difficulty: "hard",
			bloomVerb: "Justify",
			skillTail: "why anti-lock braking improves stopping distance using friction-coefficient reasoning",
			subSkillChain: "define μ_s vs μ_k -> compare braking regimes -> connect to ABS modulation",
		}),
		makeSlot({
			index: 14,
			type: "long_answer",
			topicId: PHYSICS_TOPIC_IDS[2]!,
			difficulty: "hard",
			bloomVerb: "Construct",
			skillTail: "the full free-body and Newton-2 derivation for a block in equilibrium on a rough incline",
			subSkillChain: "draw diagram -> write equilibrium eqs -> solve for the unknown -> sanity-check signs",
		}),
	);
	return slots;
}

function mathSlots(): PracticeGenerationBlueprintSlot[] {
	// 12 MCQs for a math test
	const out: PracticeGenerationBlueprintSlot[] = [];
	const sampleTails = [
		{ verb: "Identify", tail: "the slope of y = 2x + 3 from its equation", trap: "confused slope with intercept" },
		{ verb: "Calculate", tail: "the area of a triangle given base 6 and height 4", trap: "forgot the ½ factor" },
		{ verb: "Apply", tail: "the Pythagoras theorem for legs 3 and 4", trap: "summed legs instead of squaring" },
		{ verb: "Compute", tail: "the value of n in 3p + 2n = 105 and p + 4n = 95", trap: "added equations directly" },
		{ verb: "Compare", tail: "two linear functions and pick the steeper one", trap: "compared y-intercepts only" },
		{ verb: "Apply", tail: "the quadratic formula to x² − 5x + 6 = 0", trap: "sign error inside the radical" },
		{ verb: "Calculate", tail: "the probability of two independent events both occurring", trap: "added probabilities" },
		{ verb: "Derive", tail: "the next term of an AP with a₁=3, d=4", trap: "off-by-one in n" },
		{ verb: "Compute", tail: "sin(30°) + cos(60°) without a calculator", trap: "swapped sin and cos values" },
		{ verb: "Apply", tail: "remainder theorem to find P(2) for P(x) = x³ − 4x + 1", trap: "subbed in wrong sign" },
		{ verb: "Analyze", tail: "the discriminant of a quadratic to decide root nature", trap: "computed Δ but mis-stated sign rule" },
		{ verb: "Calculate", tail: "the LCM of 12 and 18", trap: "used GCD instead of LCM" },
	];
	for (let i = 0; i < 12; i++) {
		const s = sampleTails[i]!;
		const difficulty: "easy" | "medium" | "hard" = i < 4 ? "easy" : i < 9 ? "medium" : "hard";
		out.push(
			makeSlot({
				index: i,
				type: "multiple_choice",
				topicId: MATH_TOPIC_IDS[i % MATH_TOPIC_IDS.length]!,
				difficulty,
				bloomVerb: s.verb,
				skillTail: s.tail,
				misconception: s.trap,
			}),
		);
	}
	return out;
}

function physicsUserSummary(): UserMessageSummary {
	return {
		schema_version: 3,
		intent: "generate_practice_test",
		test_parameters: {
			difficulty: "medium",
			time_limit_seconds: 3600,
			estimated_question_count: 15,
			topic_count: 3,
			coverage_mode: "balanced",
			coverage_instruction:
				"Topic count aligns with question count: distribute questions across topics fairly while weighting weaker performance when data exists.",
			question_type_counts: {
				multiple_choice: 5,
				fill_in_blank: 3,
				short_answer: 4,
				long_answer: 3,
			},
			context_quality_instruction: "Curriculum/question-bank context is available for the selected topics.",
			allowed_topic_ids: PHYSICS_TOPIC_IDS,
			visuals_policy: {
				enabled: true,
				preferred_kinds: PHYSICS_VISUAL_KINDS,
				max_non_null_visuals: 15,
			},
			grounding_policy: {
				mode: "chunk_aligned",
				prefer_chunk_aligned_items: true,
			},
		},
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			pedagogy: "Test on the given topics at the requested difficulty.",
		},
		topic_exemplar_hint: null,
		subjectName: "Physics Part 1",
		student_grade: 11,
		subject_grade: 11,
	};
}

function physicsSubjectContext(): PracticeGenerationSubjectContext {
	return {
		subjectName: "Physics Part 1",
		subjectGrade: 11,
		subjectGroup: "science_pcm",
		studentGrade: 11,
	};
}

function mathUserSummary(): UserMessageSummary {
	return {
		schema_version: 3,
		intent: "generate_practice_test",
		test_parameters: {
			difficulty: "medium",
			time_limit_seconds: 3600,
			estimated_question_count: 12,
			topic_count: 2,
			coverage_mode: "few_topics",
			coverage_instruction:
				"Fewer topics than questions: reuse topic_ids; within each topic, ramp cognitive demand and difficulty across items.",
			question_type_counts: {
				multiple_choice: 12,
				fill_in_blank: 0,
				short_answer: 0,
				long_answer: 0,
			},
			context_quality_instruction: "Curriculum/question-bank context is available for the selected topics.",
			allowed_topic_ids: MATH_TOPIC_IDS,
			visuals_policy: {
				enabled: true,
				preferred_kinds: ["math_geometry", "math_function_plot", "number_line", "data_table"],
				max_non_null_visuals: 12,
			},
			grounding_policy: {
				mode: "chunk_aligned",
				prefer_chunk_aligned_items: true,
			},
		},
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			pedagogy: "Test on the given topics at the requested difficulty.",
		},
		topic_exemplar_hint: null,
		subjectName: "Mathematics",
		student_grade: 10,
		subject_grade: 10,
	};
}

function mathSubjectContext(): PracticeGenerationSubjectContext {
	return {
		subjectName: "Mathematics",
		subjectGrade: 10,
		subjectGroup: "stem",
		studentGrade: 10,
	};
}

function estimateTokens(text: string): number {
	// Rough heuristic: ~4 chars per token. Close enough for relative comparison.
	return Math.round(text.length / 4);
}

function renderBatchSummary(
	label: string,
	batch: PracticeGenerationBatch,
	v1Sys: string,
	v1User: string,
	v2Sys: string,
	v2User: string,
): string {
	const v1SysT = estimateTokens(v1Sys);
	const v1UserT = estimateTokens(v1User);
	const v2SysT = estimateTokens(v2Sys);
	const v2UserT = estimateTokens(v2User);
	const sysDelta = v2SysT - v1SysT;
	const userDelta = v2UserT - v1UserT;
	const totalDelta = sysDelta + userDelta;
	return [
		`### ${label} (slots=${batch.slots.length})`,
		``,
		`| metric | v1 (chars / ~tokens) | v2 (chars / ~tokens) | delta |`,
		`|---|---|---|---|`,
		`| system prompt | ${v1Sys.length} / ${v1SysT} | ${v2Sys.length} / ${v2SysT} | ${sysDelta >= 0 ? "+" : ""}${sysDelta} tok |`,
		`| user tail (after the shared user payload) | ${v1User.length} / ${v1UserT} | ${v2User.length} / ${v2UserT} | ${userDelta >= 0 ? "+" : ""}${userDelta} tok |`,
		`| total (system + tail) | ${v1Sys.length + v1User.length} / ${v1SysT + v1UserT} | ${v2Sys.length + v2User.length} / ${v2SysT + v2UserT} | **${totalDelta >= 0 ? "+" : ""}${totalDelta} tok** |`,
		``,
	].join("\n");
}

function renderFullDump(title: string, body: string): string {
	return ["#### " + title, "", "```text", body, "```", ""].join("\n");
}

function compareTestCase(args: {
	caseName: string;
	slots: PracticeGenerationBlueprintSlot[];
	summary: UserMessageSummary;
	subject: PracticeGenerationSubjectContext;
	plan: { multiple_choice: number; fill_in_blank: number; short_answer: number; long_answer: number };
}): string {
	const totalQ = args.slots.length;
	const batches = splitPracticeQuestionPlanIntoBatches({ plan: args.plan, slots: args.slots });

	// v1 system prompt = the shared one (same across all batches)
	const v1System = buildPracticeSystemPrompt({
		userMessageSummary: args.summary,
		generationSubject: args.subject,
	});

	const sections: string[] = [
		`## Case: ${args.caseName}`,
		``,
		`- batches: ${batches.length}`,
		`- total questions: ${totalQ}`,
		`- v1 shared system prompt: **${v1System.length} chars / ~${estimateTokens(v1System)} tokens** (sent ${batches.length}× per generation)`,
		``,
	];

	for (const batch of batches) {
		const v1Tail = buildBatchUserPromptTail({
			batch,
			totalBatches: batches.length,
			totalQuestionsInTest: totalQ,
		});
		const v2System = buildBatchSystemPromptV2({
			batch,
			userMessageSummary: args.summary,
			generationSubject: args.subject,
		});
		const budget = computePracticeBatchBudget({
			batch,
			timeLimitSeconds: args.summary.test_parameters.time_limit_seconds,
			testTypeCounts: args.summary.test_parameters.question_type_counts,
			difficulty: args.summary.test_parameters.difficulty,
		});
		const sister = buildSisterBriefForBatch({ self: batch, allBatches: batches });
		const v2Tail = buildBatchUserPromptTailV2({
			batch,
			totalBatches: batches.length,
			totalQuestionsInTest: totalQ,
			budget,
			sisterBrief: sister,
		});
		sections.push(
			renderBatchSummary(
				`Batch ${batch.index + 1} (${batch.label.toUpperCase()})`,
				batch,
				v1System,
				v1Tail,
				v2System,
				v2Tail,
			),
		);
		sections.push(
			renderFullDump(`v2 system prompt — batch ${batch.label}`, v2System),
			renderFullDump(`v2 user tail — batch ${batch.label}`, v2Tail),
		);
	}

	const v1Total = (v1System.length + batches.map((b) => buildBatchUserPromptTail({ batch: b, totalBatches: batches.length, totalQuestionsInTest: totalQ }).length).reduce((a, c) => a + c, 0)) * 1; // v1 sends shared system once-per-batch
	const v1TotalAcrossBatches =
		v1System.length * batches.length +
		batches.map((b) => buildBatchUserPromptTail({ batch: b, totalBatches: batches.length, totalQuestionsInTest: totalQ }).length).reduce((a, c) => a + c, 0);
	void v1Total; // silence unused
	const v2TotalAcrossBatches = batches
		.map((b) => {
			const sys = buildBatchSystemPromptV2({ batch: b, userMessageSummary: args.summary, generationSubject: args.subject });
			const budget = computePracticeBatchBudget({
				batch: b,
				timeLimitSeconds: args.summary.test_parameters.time_limit_seconds,
				testTypeCounts: args.summary.test_parameters.question_type_counts,
				difficulty: args.summary.test_parameters.difficulty,
			});
			const sister = buildSisterBriefForBatch({ self: b, allBatches: batches });
			const tail = buildBatchUserPromptTailV2({
				batch: b,
				totalBatches: batches.length,
				totalQuestionsInTest: totalQ,
				budget,
				sisterBrief: sister,
			});
			return sys.length + tail.length;
		})
		.reduce((a, c) => a + c, 0);

	const v1TotalTok = estimateTokens(String("x").repeat(v1TotalAcrossBatches));
	const v2TotalTok = estimateTokens(String("x").repeat(v2TotalAcrossBatches));
	const delta = v2TotalTok - v1TotalTok;
	sections.push(
		`### Aggregate across all ${batches.length} batches (system + tail, excluding shared user payload body)`,
		``,
		`- v1: ${v1TotalAcrossBatches.toLocaleString()} chars / ~${v1TotalTok.toLocaleString()} tokens`,
		`- v2: ${v2TotalAcrossBatches.toLocaleString()} chars / ~${v2TotalTok.toLocaleString()} tokens`,
		`- delta: **${delta >= 0 ? "+" : ""}${delta.toLocaleString()} tokens (${((delta / Math.max(v1TotalTok, 1)) * 100).toFixed(1)}%)**`,
		``,
	);

	return sections.join("\n");
}

function main(): void {
	mkdirSync(OUT_DIR, { recursive: true });
	const reports: string[] = [
		"# Practice-test batch-prompt comparison (v1 vs v2)",
		"",
		"v2 = `PRACTICE_BATCH_CONTRACT_V2=true` path.",
		"",
		"All token figures are estimates (~4 chars/token).",
		"",
	];
	reports.push(
		compareTestCase({
			caseName: "Physics Part 1 — 15Q (5 MCQ / 3 FIB / 4 SA / 3 LA), medium difficulty",
			slots: physicsSlots(),
			summary: physicsUserSummary(),
			subject: physicsSubjectContext(),
			plan: {
				multiple_choice: 5,
				fill_in_blank: 3,
				short_answer: 4,
				long_answer: 3,
			},
		}),
	);
	reports.push(
		compareTestCase({
			caseName: "Mathematics — 12 MCQs, medium difficulty (math 4-equal-MCQ split)",
			slots: mathSlots(),
			summary: mathUserSummary(),
			subject: mathSubjectContext(),
			plan: {
				multiple_choice: 12,
				fill_in_blank: 0,
				short_answer: 0,
				long_answer: 0,
			},
		}),
	);
	writeFileSync(OUT_PATH, reports.join("\n"));
	console.log(`Wrote ${OUT_PATH}`);
}

main();
