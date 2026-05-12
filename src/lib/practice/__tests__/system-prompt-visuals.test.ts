import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPracticeGenerationSharedSystemInstructions } from "../system-prompt";
import type { QuestionVisualKind } from "../visuals/types";

const userMessageBaseline = {
	schema_version: 3 as const,
	intent: "generate_practice_test" as const,
	subjectName: "Mathematics",
	test_parameters: {
		difficulty: "medium" as const,
		time_limit_seconds: 3600,
		estimated_question_count: 20,
		topic_count: 5,
		coverage_mode: "balanced" as const,
		coverage_instruction: "Distribute evenly.",
		question_type_counts: {
			multiple_choice: 10,
			fill_in_blank: 5,
			short_answer: 3,
			long_answer: 2,
		},
		context_quality_instruction: "ok",
		allowed_topic_ids: [],
		visuals_policy: {
			enabled: false,
			preferred_kinds: ["math_geometry", "math_function_plot", "number_line", "data_table"] as QuestionVisualKind[],
			max_non_null_visuals: 0,
		},
		grounding_policy: {
			mode: "curriculum_hint_only" as const,
			prefer_chunk_aligned_items: false,
		},
	},
	constraints: {
		question_types: [
			"multiple_choice",
			"fill_in_blank",
			"short_answer",
			"long_answer",
		] as const,
		pedagogy: "Follow the system prompt.",
	},
};

describe("system prompt — visuals flag", () => {
	const originalEnv = process.env.PRACTICE_VISUALS;
	const originalSubjects = process.env.PRACTICE_VISUALS_SUBJECTS;
	beforeEach(() => {
		delete process.env.PRACTICE_VISUALS;
		delete process.env.PRACTICE_VISUALS_SUBJECTS;
	});
	afterEach(() => {
		if (originalEnv === undefined) delete process.env.PRACTICE_VISUALS;
		else process.env.PRACTICE_VISUALS = originalEnv;
		if (originalSubjects === undefined) delete process.env.PRACTICE_VISUALS_SUBJECTS;
		else process.env.PRACTICE_VISUALS_SUBJECTS = originalSubjects;
	});

	it("forces visual: null when PRACTICE_VISUALS is unset (default off)", () => {
		const prompt = buildPracticeGenerationSharedSystemInstructions(userMessageBaseline);
		expect(prompt).toContain("ALWAYS emit `null`");
		expect(prompt).not.toContain("Visuals (`visual` field — required");
		expect(prompt).not.toContain("## Examples");
	});

	it("forces visual: null when PRACTICE_VISUALS=false", () => {
		process.env.PRACTICE_VISUALS = "false";
		const prompt = buildPracticeGenerationSharedSystemInstructions(userMessageBaseline);
		expect(prompt).toContain("ALWAYS emit `null`");
	});

	it("emits the discipline block + examples when PRACTICE_VISUALS=true", () => {
		process.env.PRACTICE_VISUALS = "true";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: ["math_geometry", "math_function_plot", "number_line", "data_table"] as QuestionVisualKind[],
					max_non_null_visuals: 10,
				},
			},
		});
		expect(prompt).toContain("Visuals (`visual` field — required");
		expect(prompt).toContain("Maximize non-null visuals");
		expect(prompt).toContain("one non-null visual per question");
		expect(prompt).toContain("Renderer-specific syntax (HARD)");
		expect(prompt).toContain("### Caption and altText");
		expect(prompt).toContain("For minimal supporting visuals");
		expect(prompt).toContain("Chunk fidelity:");
		expect(prompt).toContain("prefer_chunk_aligned_items");
		expect(prompt).toContain("## Examples");
		expect(prompt).toContain("question_text:");
		expect(prompt).toContain("horizontal axis");
		expect(prompt).toContain("no artificial per-test quota");
		expect(prompt).toContain("**Maximize non-null visuals** per the Visuals section");
	});

	it("includes grade band when student_grade is set", () => {
		process.env.PRACTICE_VISUALS = "false";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			student_grade: 7,
		});
		expect(prompt).toContain("### Grade band (about class 7)");
		expect(prompt).toContain("middle school");
	});

	it("forces visual: null when PRACTICE_VISUALS_SUBJECTS excludes current subject", () => {
		process.env.PRACTICE_VISUALS = "true";
		process.env.PRACTICE_VISUALS_SUBJECTS = "Accountancy,Physics";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			subjectName: "Mathematics",
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: ["math_geometry"] as QuestionVisualKind[],
					max_non_null_visuals: 10,
				},
			},
		});
		expect(prompt).toContain("ALWAYS emit `null`");
		expect(prompt).not.toContain("## Examples");
	});

	it("allows discipline when subject is in PRACTICE_VISUALS_SUBJECTS allowlist", () => {
		process.env.PRACTICE_VISUALS = "true";
		process.env.PRACTICE_VISUALS_SUBJECTS = "mathematics";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			subjectName: "Mathematics",
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: ["math_geometry"] as QuestionVisualKind[],
					max_non_null_visuals: 10,
				},
			},
		});
		expect(prompt).toContain("Visuals (`visual` field — required");
	});

	it("picks the right exemplar key for accountancy", () => {
		process.env.PRACTICE_VISUALS = "true";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			subjectName: "Accountancy",
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: ["accountancy_table"] as QuestionVisualKind[],
					max_non_null_visuals: 8,
				},
			},
		});
		// Accountancy exemplar features the journal entry skeleton.
		expect(prompt).toContain("journal_entry");
	});

	it("includes the template policy brief when provided", () => {
		process.env.PRACTICE_VISUALS = "true";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			subjectName: "Chemistry",
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: ["chemistry_cell_diagram"] as QuestionVisualKind[],
					max_non_null_visuals: 10,
					template_policy: {
						enabled: true,
						templates: [
							{
								id: "chemistry-galvanic-cell",
								kind: "chemistry_cell_diagram" as QuestionVisualKind,
								required_slots: ["anode", "cathode", "electronFlow"],
								optional_slots: ["saltBridge"],
								constraints: ["Anode/cathode polarity must match the cell type."],
							},
						],
						prompt_brief:
							"Visual template engine: choose only from chemistry-galvanic-cell and fill only declared slots.",
					},
				},
			},
		});

		expect(prompt).toContain("Visual template engine");
		expect(prompt).toContain("chemistry-galvanic-cell");
		expect(prompt).toContain("fill only declared slots");
	});

	it("omits few-shot ## Examples when preferred_kinds is empty (e.g. Biology)", () => {
		process.env.PRACTICE_VISUALS = "true";
		const prompt = buildPracticeGenerationSharedSystemInstructions({
			...userMessageBaseline,
			subjectName: "Biology",
			test_parameters: {
				...userMessageBaseline.test_parameters,
				visuals_policy: {
					enabled: true,
					preferred_kinds: [] as QuestionVisualKind[],
					max_non_null_visuals: 0,
				},
			},
		});
		expect(prompt).toContain("Visuals (`visual` field — required");
		expect(prompt).not.toContain("## Examples (worked stems with matching visuals)");
	});
});
