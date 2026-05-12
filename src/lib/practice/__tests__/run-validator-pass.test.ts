import { afterEach, describe, expect, it } from "vitest";

import type { PracticeGenerationOutput } from "../generation-schema";
import { VISUAL_EXEMPLARS } from "../visuals/exemplars";
import { executeValidatorRun, runValidatorPass } from "../visuals/run-validator-pass";
import { questionVisualEnvelopeSchema, type QuestionVisualEnvelope } from "../visuals/schemas";

describe("runValidatorPass deterministic checks", () => {
	const ctx = { correlationId: "cid", userId: "user-1" };
	const originalGroundingMode = process.env.PRACTICE_VISUAL_STEM_GROUNDING;

	function withVisual(
		visual: QuestionVisualEnvelope | null,
		questionText = "Q",
	): PracticeGenerationOutput {
		return {
			generation_metadata: {
				topic_distribution: {},
				difficulty_distribution: {},
				type_distribution: {},
				adaptation_rationale: "t",
			},
			questions: [
				{
					question_number: 1,
					topic_id: "11111111-1111-4111-8111-111111111111",
					topic_name: "T",
					question_text: questionText,
					question_type: "multiple_choice",
					difficulty_level: "easy",
					options: { A: "a", B: "b", C: "c", D: "d" },
					answer_key: {
						correct_answer: "A",
						explanation: "e",
						common_mistakes: [],
						related_concept: "c",
					},
					estimated_time_seconds: 60,
					visual,
				},
			],
		};
	}

	afterEach(() => {
		delete process.env.PRACTICE_VISUAL_VALIDATOR;
		if (originalGroundingMode === undefined) delete process.env.PRACTICE_VISUAL_STEM_GROUNDING;
		else process.env.PRACTICE_VISUAL_STEM_GROUNDING = originalGroundingMode;
	});

	it("returns no-op when visual validator is disabled", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "false";
		const exemplar = VISUAL_EXEMPLARS.find((ex) => ex.visual != null)!;
		const output = withVisual(exemplar.visual);
		const r = await runValidatorPass(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([]);
	});

	it("nulls visuals that fail envelope schema", async () => {
		const invalidOutput: PracticeGenerationOutput = {
			generation_metadata: {
				topic_distribution: {},
				difficulty_distribution: {},
				type_distribution: {},
				adaptation_rationale: "t",
			},
			questions: [
				{
					question_number: 1,
					topic_id: "11111111-1111-4111-8111-111111111111",
					topic_name: "T",
					question_text: "Q",
					question_type: "multiple_choice",
					difficulty_level: "easy",
					options: { A: "a", B: "b", C: "c", D: "d" },
					answer_key: {
						correct_answer: "A",
						explanation: "e",
						common_mistakes: [],
						related_concept: "c",
					},
					estimated_time_seconds: 60,
					visual: {
						caption: "c",
						altText: "a",
						spec: {
							kind: "math_geometry",
							view: {
								xMin: 0,
								xMax: 1,
								yMin: 0,
								yMax: 1,
								showGrid: false,
								showAxes: true,
							},
							primitives: [],
						},
					},
				},
			],
		};
		const r = await executeValidatorRun(invalidOutput, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls data_table visuals when row widths do not match headers", async () => {
		const output = withVisual({
			caption: "Table",
			altText: "Two headers but one value in row.",
			spec: {
				kind: "data_table",
				caption: "c",
				headers: ["A", "B"],
				rows: [[{ value: "1", bold: false, align: "left" }]],
			},
		});
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("accepts valid new template-family visuals", async () => {
		const output = withVisual({
			caption: "Electrochemical cell for identifying electrode roles.",
			altText: "A galvanic cell with zinc anode, copper cathode, salt bridge, and electron flow.",
			spec: {
				kind: "chemistry_cell_diagram",
				cellType: "galvanic",
				anode: { label: "Anode", material: "Zn", electrolyte: "ZnSO4", polarity: "negative" },
				cathode: { label: "Cathode", material: "Cu", electrolyte: "CuSO4", polarity: "positive" },
				saltBridge: "KNO3",
				electronFlow: "anode_to_cathode",
				labels: ["Salt bridge"],
			},
		});
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([]);
	});

	it("nulls flowcharts whose edges reference missing nodes", async () => {
		const output = withVisual({
			caption: "Invalid flowchart.",
			altText: "A flowchart with an edge to a missing node.",
			spec: {
				kind: "flowchart",
				title: "Process",
				nodes: [
					{ id: "start", label: "Start", detail: null, kind: "start" },
					{ id: "finish", label: "Finish", detail: null, kind: "outcome" },
				],
				edges: [{ from: "start", to: "missing", label: null }],
			},
		});
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("accepts valid exemplar visuals across all supported kinds", async () => {
		const perKind = new Map<string, { stem: string; visual: QuestionVisualEnvelope }>();
		for (const exemplar of VISUAL_EXEMPLARS) {
			if (!exemplar.visual) continue;
			const kind = exemplar.visual.spec.kind;
			if (!perKind.has(kind)) perKind.set(kind, { stem: exemplar.stem, visual: exemplar.visual });
		}
		expect(perKind.size).toBe(12);

		for (const entry of perKind.values()) {
			const output = withVisual(entry.visual, entry.stem);
			const r = await executeValidatorRun(output, ctx);
			expect(r.ok).toBe(true);
			expect(r.patches, `Expected no patch for kind ${entry.visual.spec.kind}`).toEqual([]);
		}
	});

	it("does not null mismatched numeric visuals in shadow mode", async () => {
		process.env.PRACTICE_VISUAL_STEM_GROUNDING = "shadow";
		const output = withVisual({
			caption: "Circuit values",
			altText: "Battery circuit with labeled values.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "A", x: 0, y: 0 },
					{ id: "B", x: 1, y: 0 },
				],
				components: [
					{
						type: "battery",
						from: "A",
						to: "B",
						emfVolts: 24,
						label: "24 V",
						polarityMarks: true,
						currentArrow: false,
					},
				],
			},
		}, "A 12 V battery is connected to a resistor.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([]);
	});

	it("nulls mismatched numeric visuals in enforce mode", async () => {
		process.env.PRACTICE_VISUAL_STEM_GROUNDING = "enforce";
		const output = withVisual({
			caption: "Circuit values",
			altText: "Battery circuit with labeled values.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "A", x: 0, y: 0 },
					{ id: "B", x: 1, y: 0 },
				],
				components: [
					{
						type: "battery",
						from: "A",
						to: "B",
						emfVolts: 24,
						label: "24 V",
						polarityMarks: true,
						currentArrow: false,
					},
				],
			},
		}, "A 12 V battery is connected to a resistor.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});
});

describe("runValidatorPass — generic scaffold and topic-incoherence checks", () => {
	const ctx = { correlationId: "cid", userId: "user-1" };

	function withVisual(
		visual: QuestionVisualEnvelope | null,
		questionText = "Q",
	): PracticeGenerationOutput {
		return {
			generation_metadata: {
				topic_distribution: {},
				difficulty_distribution: {},
				type_distribution: {},
				adaptation_rationale: "t",
			},
			questions: [
				{
					question_number: 1,
					topic_id: "11111111-1111-4111-8111-111111111111",
					topic_name: "T",
					question_text: questionText,
					question_type: "multiple_choice",
					difficulty_level: "easy",
					options: { A: "a", B: "b", C: "c", D: "d" },
					answer_key: {
						correct_answer: "A",
						explanation: "e",
						common_mistakes: [],
						related_concept: "c",
					},
					estimated_time_seconds: 60,
					visual,
				},
			],
		};
	}

	afterEach(() => {
		delete process.env.PRACTICE_VISUAL_VALIDATOR;
		delete process.env.PRACTICE_VISUAL_STEM_GROUNDING;
	});

	it("nulls the exact generic free-body scaffold caption regardless of topic", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Reference free-body diagram scaffold.",
			altText: "A body with one force arrow shown for analysis.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Body",
				forces: [{ name: "F", magnitude: 10, angleDeg: 0, unit: "N", showMagnitude: true, componentArrows: false }],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: null,
				axisLegend: null,
			},
		}, "Kinetic theory of gases: explain why equal volumes contain equal molecules.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls free_body visuals on wave-topic questions (topic incoherence)", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Wave diagram scaffold",
			altText: "A free body diagram.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "T", magnitude: 49, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 49, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: null,
				axisLegend: null,
			},
		}, "A wave of frequency 8.0 Hz moves with speed 24 m/s. The wavelength is ______ m.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls free_body visuals on kinetic-theory questions (topic incoherence)", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Degrees of freedom",
			altText: "A rigid body with one force.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Body",
				forces: [{ name: "F", magnitude: 10, angleDeg: 0, unit: "N", showMagnitude: true, componentArrows: false }],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: null,
				axisLegend: null,
			},
		}, "A rigid diatomic molecule has how many degrees of freedom in the classical kinetic theory model?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls free_body visuals on gravitation geometry questions (topic incoherence)", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Cutaway Earth with a point at depth d below the surface.",
			altText: "A block on an inclined plane with weight and normal force.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 98, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "N", magnitude: 85, angleDeg: 70, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: 30,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "A point is at a depth d = R_E/2 below Earth's surface. What fraction of surface gravity acts there?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("replaces free_body visuals on projectile/component-motion questions", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Projectile path with horizontal and vertical velocity components.",
			altText: "A block on a horizontal surface with weight and normal force.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Body",
				forces: [
					{ name: "N", magnitude: 58.8, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 58.8, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "A projectile is launched with initial velocity components v0x and v0y. Which statement is correct?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toHaveLength(1);
		expect(r.patches[0]).toMatchObject({ action: "replace_visual", index: 0 });
		if (r.patches[0]?.action === "replace_visual") {
			const replacement = questionVisualEnvelopeSchema.parse(r.patches[0].value);
			expect(replacement.spec.kind).toBe("math_geometry");
		}
	});

	it("replaces free_body visuals on vector-resultant questions", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Two vectors drawn from the same origin with a marked included angle.",
			altText: "A block on a horizontal surface with weight and normal force.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Body",
				forces: [
					{ name: "N", magnitude: 58.8, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 58.8, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "Two vectors A = 8 units and B = 6 units act at 60° to each other. What is the magnitude of the resultant?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toHaveLength(1);
		expect(r.patches[0]).toMatchObject({ action: "replace_visual", index: 0 });
		if (r.patches[0]?.action === "replace_visual") {
			const replacement = questionVisualEnvelopeSchema.parse(r.patches[0].value);
			expect(replacement.spec.kind).toBe("math_geometry");
			expect(JSON.stringify(replacement.spec)).toMatch(/A|B|R/);
		}
	});

	it("nulls unrelated fluid and thermodynamics scaffolds", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "A pipe with two cross-sections at different heights, labeled P1, v1, A1 and P2, v2, A2.",
			altText: "A free-body diagram with weight and normal forces.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Body",
				forces: [
					{ name: "N", magnitude: 58.8, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 58.8, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "Which pair of systems is definitely in thermal equilibrium with each other?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls free-body diagrams for mechanics recall that does not need force vectors", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Two inclined planes facing each other with a ball rolling down the first and up the second.",
			altText: "A free-body diagram with weight and normal forces.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Ball",
				forces: [
					{ name: "N", magnitude: 58.8, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 58.8, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "Inertia means resistance to change of ______.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls cross-family plot captions on waves and kinetic-theory stems", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "A stress-strain graph showing an initial straight-line region through the origin.",
			altText: "Axes labelled x and y with a curve that bends away from a straight line.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 10,
				yMin: 0,
				yMax: 10,
				xLabel: "x",
				yLabel: "y",
				xTickStep: 2,
				yTickStep: 2,
				items: [{ expr: "x^2", color: "primary", label: null }],
			},
		}, "A sitar string gives 5 beats per second with a reference note. What changes after tightening?");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls chemistry reaction visuals for periodic-law recall stems", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Electron transfer in ionic bond formation.",
			altText: "A sodium atom transfers an electron to chlorine.",
			spec: {
				kind: "chemistry_reaction",
				ce: "Na -> Na+ + e-",
				label: null,
			},
		}, "Mendeleev's periodic law stated that properties of elements are periodic functions of their ______.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("nulls molecule visuals on Ksp/equilibrium-expression stems", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Lewis symbol of sulfur as an example of a valence-electron dot diagram.",
			altText: "A single atom symbol with surrounding dots.",
			spec: {
				kind: "chemistry_molecule",
				label: "Sulfur Lewis symbol",
				smiles: "S",
				display: "2d",
			},
		}, "For BaSO4(s) ⇌ Ba2+(aq) + SO4 2-(aq), the solubility product expression is ______.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
	});

	it("replaces mismatched gravitation geometry visuals with stem-aligned deterministic visuals", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Two-sphere line sketch with neutral point N marked between the bodies.",
			altText: "Two circular bodies on a horizontal line with a labelled point N between them.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 12, yMin: 0, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 2.5, y: 4 }, radius: 1.1, label: "Sphere A" },
					{ type: "circle", center: { x: 9.5, y: 4 }, radius: 1.5, label: "Sphere B" },
					{ type: "point", at: { x: 5.8, y: 4 }, label: "N", labelPosition: "n" },
				],
			},
		}, "For escape from Earth, the minimum speed is v_e = ______.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toHaveLength(1);
		expect(r.patches[0]).toMatchObject({ action: "replace_visual", index: 0 });
		if (r.patches[0]?.action === "replace_visual") {
			expect(r.patches[0].value).toMatchObject({
				caption: expect.stringMatching(/escape/i),
				spec: { kind: "math_geometry" },
			});
		}
	});

	it("does NOT null a legitimate free_body on a Newtonian-mechanics question", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR = "true";
		const output = withVisual({
			caption: "Block on inclined plane with friction",
			altText: "Free body diagram showing weight, normal force, and friction on an inclined plane.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 98, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "N", magnitude: 85, angleDeg: 120, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "f", magnitude: 10, angleDeg: 210, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: 30,
				inclineLabel: "30°",
				surfaceHatched: true,
				axisLegend: null,
			},
		}, "A 10 kg block rests on an inclined plane of angle 30°. Find the friction force acting on it.");
		const r = await executeValidatorRun(output, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([]);
	});
});
