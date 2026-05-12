import "server-only";

import { logPracticeObs } from "@/lib/server/practice-observability";
import { logServerError } from "@/lib/server/log-supabase-error";
import type { PracticeGenerationOutput } from "../generation-schema";
import type { QuestionVisualEnvelope, QuestionVisualSpec } from "./schemas";
import { questionVisualEnvelopeSchema } from "./schemas";
import type { VisualPatch } from "./apply-visual-patches";
import { getPracticeVisualStemGroundingMode, isPracticeVisualValidatorEnabled } from "./env";
import { buildDeterministicFallbackVisual } from "./fallback-visual";

export type RunValidatorPassResult = { ok: boolean; patches: VisualPatch[] };

type ExecuteMeta = { correlationId: string; userId: string; generationRunId?: string | null };
type QuestionDraft = PracticeGenerationOutput["questions"][number];
type StemGroundingMode = "off" | "shadow" | "enforce";

const ANSWER_LEAK_PATTERNS = [
	/\bcorrect answer\b/i,
	/\boption\s*[A-D]\b/i,
	/\btherefore the answer\b/i,
	/\bthe answer is\b/i,
];

function containsAnswerLeak(text: string | null | undefined): boolean {
	if (!text) return false;
	return ANSWER_LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Exact captions produced by the generic `buildFallbackByKind` scaffolds.
 * These are meaningful only if the scaffold matches the question — but the
 * fallback always produces them regardless, so they are reliably wrong for
 * unrelated topics. Null these visuals rather than showing them.
 */
const GENERIC_SCAFFOLD_CAPTIONS = new Set([
	"Reference free-body diagram scaffold.",
	"Reference line graph to support interpretation.",
	"Number line support for the question setup.",
	"Simple bar chart scaffold for quick comparison.",
	"Reference demand-style curve for interpretation.",
	"Reference geometry sketch for the setup.",
	"Reference reaction equation scaffold.",
	"Reference molecular structure scaffold.",
	"Reference journal row scaffold.",
	"Outline map of India for location reference.",
	"Short passage scaffold for text-based questions.",
	"Numeric givens from the question in tabular form.",
	"Number line built from the question's given values.",
	"Grounded comparison chart using values from the question.",
	"Graph scaffold aligned to the question.",
]);

function isGenericScaffoldVisual(visual: QuestionVisualEnvelope): boolean {
	const caption = visual.caption.trim();
	if (GENERIC_SCAFFOLD_CAPTIONS.has(caption)) return true;
	// Catch slight variations: any caption starting with "Reference" and ending with "scaffold."
	if (/^Reference\s.+\sscaffold\.$/.test(caption)) return true;
	return false;
}

/**
 * Regex patterns for physics sub-topics where `physics_diagram/free_body`
 * is never an appropriate visual.
 */
const WAVE_OSCILLATION_STEM_RE =
	/\b(wavelength|wave\s+speed|wave\s+velocity|wave\s+equation|frequency\s+of\s+(the\s+)?wave|amplitude\s+of\s+(the\s+)?wave|transverse\s+wave|longitudinal\s+wave|superposition|interference\s+of\s+waves|beat\b|beats\b|resonan[ct]|standing\s+wave|stationary\s+wave|progressive\s+wave|simple\s+harmonic\s+motion|shm\b|y\s*=\s*a\s*sin|y\s*\(x[\s,]*t\)|wave\s+pulse\s+on|pulse\s+on\s+a\s+string|reflected\s+pulse|incident\s+pulse)\b/i;

const KTG_THERMODYNAMICS_STEM_RE =
	/\b(kinetic\s+theory|mean\s+free\s+path|rms\s+speed|root\s+mean\s+square|vrms|equipartition|degrees\s+of\s+freedom\s+of\s+(a\s+)?molecule|molar\s+heat\s+capacit|specific\s+heat\s+capacit\s+of\s+(a\s+)?gas|monatomic\s+(ideal\s+)?gas|diatomic\s+(ideal\s+)?gas|ideal\s+gas\s+law|avogadro.{0,20}hypothesis|law\s+of\s+equipartition|boltzmann\s+constant|maxwell\s+distribution)\b/i;

const GRAVITATION_STEM_RE =
	/\b(gravity|gravitation|gravitational|surface\s+gravity|escape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|neutral\s+point|two[-\s]?sphere|moon|earth'?s?\s+(surface|centre|center|radius)|r_e\b|height\s+h|depth\s+d|below\s+earth|above\s+earth|inside\s+earth|halfway\s+(down|to)|radius\s+cubed|mass\s+is\s+proportional)\b/i;
const GRAVITATION_HEIGHT_RE = /\bheight\s+h|above\s+earth|above\s+.*surface|small\s+height\b/i;
const GRAVITATION_DEPTH_RE =
	/\bdepth\s+d|below\s+earth|inside\s+earth|half[-\s]?way\s+(down|to)|weight\s+.*halfway|surface\s+gravity|g\s*\(d\)|radius\s+cubed|mass\s+is\s+proportional|smaller\s+sphere|r_e\s*-\s*d\b/i;
const GRAVITATION_ESCAPE_RE =
	/\bescape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|speed\s+at\s+infinity|at\s+infinity|escapes?\s+earth|reaches\s+infinity|far\s+away\s+from\s+earth\b/i;
const GRAVITATION_NEUTRAL_RE = /\bneutral\s+point|two[-\s]?sphere|gravitational\s+pulls\s+cancel\b/i;
const VISUAL_DEPTH_TEXT_RE = /\bdepth|interior\s+radius|r_e\s*-\s*d|below\s+surface|cutaway\b/i;
const VISUAL_ESCAPE_TEXT_RE = /\bescape|far\s+away|infinity|rocket|launched\s+radially\b/i;
const VISUAL_NEUTRAL_TEXT_RE = /\bneutral|sphere\s+a|sphere\s+b|two[-\s]?sphere\b/i;
const KINEMATICS_COMPONENT_STEM_RE =
	/\b(projectile|trajectory|initial\s+velocity\s+components?|velocity\s+components?|component\s+equations?|constant\s+acceleration\s+in\s+(?:the\s+)?[xy][-\s]?direction|motion\s+in\s+a\s+plane|v_?0?[xy]\b|v_\{0[xy]\}|a_[xy]\b|x[-\s]?motion|y[-\s]?motion|horizontal\s+acceleration|vertical\s+acceleration)\b/i;
const VECTOR_RESULTANT_STEM_RE =
	/\b(resultant\s+(?:velocity|vector|force)|two\s+vectors?|vector\s+[ab]\b|components?\s+of\s+(?:a\s+)?vector|north|east|south|west|quadrant|angle\s+between\s+(?:the\s+)?vectors?|acts?\s+at\s+\d+(?:\.\d+)?°)\b/i;
const WORK_FRICTION_STEM_RE =
	/\b(work\s+done|net\s+work|friction|coefficient\s+of\s+kinetic\s+friction|force\s+and\s+(?:the\s+)?displacement|displacement\s+and\s+(?:the\s+)?force|skids?\s+to\s+a\s+stop|applied\s+force)\b/i;
const FLUID_THERMAL_STEM_RE =
	/\b(bernoulli|steady\s+flow|fluid|pipe|streamline|efflux|open\s+tank|thermal\s+equilibrium|zeroth\s+law|diathermic|adiabatic|sublimation|solid\s+to\s+vapou?r|phase\s+change|melts?|boils?|heating\s+curve|temperature\s+remain|latent\s+heat)\b/i;
const VISUAL_UNRELATED_TO_THERMAL_TEXT_RE =
	/\b(free[-\s]?body|weight|normal\s+force|block|pipe|tank|bernoulli|streamline|hole|efflux|sine|sinusoidal|shm|displacement\s*,?\s+velocity\s*,?\s+and\s+acceleration)\b/i;
const CHEMISTRY_EQUILIBRIUM_STEM_RE =
	/\b(equilibrium|equilibrium\s+constant|k_?c\b|k_?p\b|k_?sp\b|q_?sp\b|solubility\s+product|sparingly\s+soluble|precipitat|common\s+ion|ionic\s+product|⇌|<=>)\b/i;
const CHEMISTRY_STRUCTURE_STEM_RE =
	/\b(structure|connectivity|molecular\s+geometry|shape|bond\s+angle|hybridization|skeletal\s+formula|displayed\s+formula|structural\s+formula|lewis\s+structure)\b/i;

const FREE_BODY_MECHANICS_STEM_RE =
	/\b(free[-\s]?body|fbd|force\s+diagram|block|inclined\s+plane|incline|pulley|string|tension|normal\s+force|friction|newton'?s?\s+law|equilibrium\s+of\s+forces)\b/i;
const FREE_BODY_STRONG_STEM_RE =
	/\b(free[-\s]?body|fbd|force\s+diagram|block|inclined\s+plane|incline|pulley|string|tension|normal\s+force|friction|weight\s+and\s+normal|applied\s+force)\b/i;

function isPhysicsTopicIncoherent(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (visual.spec.kind !== "physics_diagram" || visual.spec.subKind !== "free_body") return false;
	const text = question.question_text;
	// A free_body diagram is only appropriate for Newton's-law (force) questions,
	// not for waves, oscillations, kinetic theory, thermodynamics, or gravitation
	// geometry questions about radii, depth, escape paths, or neutral points.
	return (
		WAVE_OSCILLATION_STEM_RE.test(text) ||
		KTG_THERMODYNAMICS_STEM_RE.test(text) ||
		(GRAVITATION_STEM_RE.test(text) && !FREE_BODY_MECHANICS_STEM_RE.test(text))
	);
}

function visualTextForSemanticMatch(visual: QuestionVisualEnvelope): string {
	return `${visual.caption} ${visual.altText} ${JSON.stringify(visual.spec)}`;
}

function buildGravitationSemanticReplacement(
	question: QuestionDraft,
	visual: QuestionVisualEnvelope,
): QuestionVisualEnvelope | null {
	if (!GRAVITATION_STEM_RE.test(question.question_text)) return null;
	const stem = question.question_text;
	const visualText = visualTextForSemanticMatch(visual);

	const wantsEscape = GRAVITATION_ESCAPE_RE.test(stem);
	const wantsDepth = GRAVITATION_DEPTH_RE.test(stem) && !wantsEscape;
	const wantsNeutral = GRAVITATION_NEUTRAL_RE.test(stem);
	const wantsHeightOnly = GRAVITATION_HEIGHT_RE.test(stem) && !wantsDepth && !wantsEscape;

	const mismatched =
		(wantsDepth && (VISUAL_ESCAPE_TEXT_RE.test(visualText) || VISUAL_NEUTRAL_TEXT_RE.test(visualText))) ||
		(wantsEscape && (VISUAL_DEPTH_TEXT_RE.test(visualText) || VISUAL_NEUTRAL_TEXT_RE.test(visualText))) ||
		(wantsNeutral && !VISUAL_NEUTRAL_TEXT_RE.test(visualText)) ||
		(wantsHeightOnly &&
			(VISUAL_DEPTH_TEXT_RE.test(visualText) ||
				VISUAL_ESCAPE_TEXT_RE.test(visualText) ||
				VISUAL_NEUTRAL_TEXT_RE.test(visualText)));

	if (!mismatched) return null;
	return buildDeterministicFallbackVisual({
		questionText: question.question_text,
		preferredKind: "math_geometry",
		allowedKinds: ["math_geometry", "physics_diagram", "math_function_plot", "data_table"],
		strictGrounding: true,
		visualIdea: null,
	});
}

function buildKinematicsSemanticReplacement(
	question: QuestionDraft,
	visual: QuestionVisualEnvelope,
): QuestionVisualEnvelope | null {
	if (!KINEMATICS_COMPONENT_STEM_RE.test(question.question_text) && !VECTOR_RESULTANT_STEM_RE.test(question.question_text)) return null;
	if (visual.spec.kind !== "physics_diagram" || visual.spec.subKind !== "free_body") return null;
	return buildDeterministicFallbackVisual({
		questionText: question.question_text,
		preferredKind: "math_geometry",
		allowedKinds: ["math_geometry", "math_function_plot", "physics_diagram", "data_table"],
		strictGrounding: true,
		visualIdea: null,
	});
}

function hasFluidThermalMismatch(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (!FLUID_THERMAL_STEM_RE.test(question.question_text)) return false;
	const visualText = visualTextForSemanticMatch(visual);
	if (visual.spec.kind === "physics_diagram" && visual.spec.subKind === "free_body") return true;
	if (/thermal\s+equilibrium|zeroth\s+law|sublimation|solid\s+to\s+vapou?r/i.test(question.question_text)) {
		return VISUAL_UNRELATED_TO_THERMAL_TEXT_RE.test(visualText);
	}
	if (/bernoulli|steady\s+flow|fluid|pipe|efflux|open\s+tank/i.test(question.question_text)) {
		return /\bsine|sinusoidal|shm|thermal\s+equilibrium|adiabatic|diathermic|containers?\b/i.test(visualText);
	}
	return false;
}

function hasUnsupportedFreeBody(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (visual.spec.kind !== "physics_diagram" || visual.spec.subKind !== "free_body") return false;
	return !FREE_BODY_STRONG_STEM_RE.test(question.question_text);
}

function hasCrossFamilyPlotMismatch(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (visual.spec.kind !== "math_function_plot") return false;
	const visualText = visualTextForSemanticMatch(visual);
	if (WAVE_OSCILLATION_STEM_RE.test(question.question_text)) {
		return /\bstress[-\s]?strain|elastic|young'?s?\s+modulus|thermal|heating\s+curve\b/i.test(visualText);
	}
	if (KTG_THERMODYNAMICS_STEM_RE.test(question.question_text)) {
		return /\bdisplacement[-\s]?time|periodic|oscillation|shm|stress[-\s]?strain\b/i.test(visualText);
	}
	return false;
}

function hasWorkFrictionForceMismatch(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (!WORK_FRICTION_STEM_RE.test(question.question_text)) return false;
	if (visual.spec.kind !== "physics_diagram" || visual.spec.subKind !== "free_body") return false;
	const names = visual.spec.forces.map((force) => force.name.trim().toLowerCase()).join(" ");
	const needsFriction = /\bfriction|coefficient\s+of\s+kinetic\s+friction|skids?\b/i.test(question.question_text);
	const needsApplied = /\bapplied\s+force|horizontal\s+force|force\s+and\s+(?:the\s+)?displacement|work\s+done\b/i.test(
		question.question_text,
	);
	if (needsFriction && !/\bf(?:riction)?\b|f_k|fk|friction/.test(names)) return true;
	if (needsApplied && !/\bf\b|applied|push|pull/.test(names)) return true;
	return false;
}

function isChemistryEquilibriumMoleculeMismatch(
	question: QuestionDraft,
	visual: QuestionVisualEnvelope,
): boolean {
	if (!CHEMISTRY_EQUILIBRIUM_STEM_RE.test(question.question_text)) return false;
	if (visual.spec.kind !== "chemistry_molecule") return false;
	return !CHEMISTRY_STRUCTURE_STEM_RE.test(question.question_text);
}

function isUnsupportedChemistryReaction(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	if (visual.spec.kind !== "chemistry_reaction") return false;
	if (CHEMISTRY_EQUILIBRIUM_STEM_RE.test(question.question_text)) return false;
	if (/\b(reaction|equation|ionic\s+bond|electron\s+transfer|oxidation|reduction|redox|formation|decomposition|combustion|dissociation)\b/i.test(question.question_text)) {
		return false;
	}
	return true;
}

const NUMERIC_LITERAL_RE = /-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?/g;

function parseNumericLiteral(token: string): number | null {
	const trimmed = token.trim();
	if (!trimmed) return null;
	if (trimmed.includes("/")) {
		const [left, right] = trimmed.split("/");
		if (!left || !right) return null;
		const numerator = Number(left);
		const denominator = Number(right);
		if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
		return numerator / denominator;
	}
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}

function extractNumericLiterals(text: string): number[] {
	const out: number[] = [];
	for (const match of text.matchAll(NUMERIC_LITERAL_RE)) {
		const value = parseNumericLiteral(match[0]);
		if (value != null) out.push(value);
	}
	return out;
}

function dedupeNumbers(values: number[]): number[] {
	const deduped: number[] = [];
	for (const value of values) {
		if (!deduped.some((existing) => Math.abs(existing - value) <= 1e-9)) {
			deduped.push(value);
		}
	}
	return deduped;
}

function numberInUniverse(target: number, universe: number[]): boolean {
	return universe.some((value) => Math.abs(value - target) <= 1e-6);
}

function collectQuestionNumberUniverse(question: QuestionDraft): number[] {
	const parts = [question.question_text];
	if (question.question_type === "multiple_choice" && question.options) {
		parts.push(question.options.A, question.options.B, question.options.C, question.options.D);
	}
	return dedupeNumbers(extractNumericLiterals(parts.join(" ")));
}

function collectSpecGroundingNumbers(spec: QuestionVisualSpec): number[] {
	const numbers: number[] = [];
	const pushNumber = (value: number | null | undefined) => {
		if (typeof value === "number" && Number.isFinite(value)) numbers.push(value);
	};
	const pushFromText = (value: string | null | undefined) => {
		if (typeof value === "string" && value.trim().length > 0) {
			numbers.push(...extractNumericLiterals(value));
		}
	};

	switch (spec.kind) {
		case "math_geometry":
			for (const primitive of spec.primitives) {
				if ("label" in primitive) pushFromText(primitive.label);
				if (primitive.type === "polygon") {
					for (const label of primitive.vertexLabels ?? []) pushFromText(label);
				}
			}
			break;
		case "math_function_plot":
			for (const item of spec.items) pushFromText(item.expr);
			break;
		case "number_line":
			for (const point of spec.points) pushNumber(point.value);
			for (const interval of spec.intervals) {
				pushNumber(interval.from);
				pushNumber(interval.to);
			}
			break;
		case "physics_diagram":
			if (spec.subKind === "free_body") {
				for (const force of spec.forces) pushNumber(force.magnitude);
				pushNumber(spec.inclineDeg);
			} else if (spec.subKind === "ray_optics") {
				for (const lens of spec.lenses) pushNumber(lens.focalLength);
				for (const obj of spec.objects) pushNumber(obj.height);
			} else if (spec.subKind === "circuit") {
				for (const component of spec.components) {
					if (component.type === "battery") pushNumber(component.emfVolts);
					if (component.type === "resistor") pushNumber(component.resistanceOhms);
					if ("label" in component) pushFromText(component.label);
				}
			}
			break;
		case "chemistry_reaction":
			pushFromText(spec.ce);
			break;
		case "accountancy_table":
			switch (spec.subKind) {
				case "journal_entry":
				case "cash_book":
				case "rectification":
					for (const row of spec.rows) {
						pushNumber(row.debit);
						pushNumber(row.credit);
					}
					break;
				case "ledger":
					for (const row of spec.ledger.debitSide) pushNumber(row.amount);
					for (const row of spec.ledger.creditSide) pushNumber(row.amount);
					break;
				case "trial_balance":
					for (const row of spec.rows) {
						pushNumber(row.debit);
						pushNumber(row.credit);
					}
					break;
				case "balance_sheet":
					for (const row of spec.assetsSide) pushNumber(row.amount);
					for (const row of spec.equityAndLiabilitiesSide) pushNumber(row.amount);
					break;
				case "p_and_l":
					for (const row of spec.rows) pushNumber(row.amount);
					break;
			}
			break;
		case "economics_curve":
			for (const curve of spec.curves) pushFromText(curve.expr);
			for (const mark of spec.marks) {
				pushNumber(mark.x);
				pushNumber(mark.y);
			}
			break;
		case "statistics_chart":
			switch (spec.subKind) {
				case "histogram":
				case "frequency_polygon":
				case "ogive":
					for (const bin of spec.bins) {
						pushNumber(bin.frequency);
						pushFromText(bin.label);
					}
					break;
				case "bar":
					for (const datum of spec.data) {
						pushNumber(datum.value);
						pushFromText(datum.label);
					}
					break;
				case "line":
					for (const series of spec.series) {
						for (const point of series.points) {
							pushNumber(point.x);
							pushNumber(point.y);
						}
					}
					break;
				case "scatter":
					for (const point of spec.points) {
						pushNumber(point.x);
						pushNumber(point.y);
						pushFromText(point.label);
					}
					break;
				case "pie":
					for (const slice of spec.slices) {
						pushNumber(slice.value);
						pushFromText(slice.label);
					}
					break;
				case "box":
					for (const group of spec.groups) {
						pushNumber(group.min);
						pushNumber(group.q1);
						pushNumber(group.median);
						pushNumber(group.q3);
						pushNumber(group.max);
					}
					break;
			}
			break;
		case "data_table":
			for (const header of spec.headers) pushFromText(header);
			for (const row of spec.rows) {
				for (const cell of row) pushFromText(cell.value);
			}
			break;
		default:
			break;
	}
	return dedupeNumbers(numbers);
}

function hasStemGroundingMismatch(question: QuestionDraft, visual: QuestionVisualEnvelope): boolean {
	const specNumbers = collectSpecGroundingNumbers(visual.spec);
	if (specNumbers.length === 0) return false;
	const questionNumbers = collectQuestionNumberUniverse(question);
	if (questionNumbers.length === 0) return true;
	return specNumbers.some((value) => !numberInUniverse(value, questionNumbers));
}

function hasInvertedBounds(spec: QuestionVisualSpec): boolean {
	switch (spec.kind) {
		case "math_geometry":
			return spec.view.xMax <= spec.view.xMin || spec.view.yMax <= spec.view.yMin;
		case "math_function_plot":
			return spec.xMax <= spec.xMin || (spec.yMin != null && spec.yMax != null && spec.yMax <= spec.yMin);
		case "number_line":
			return spec.max <= spec.min;
		case "economics_curve":
			return spec.xMax <= spec.xMin || (spec.yMin != null && spec.yMax != null && spec.yMax <= spec.yMin);
		case "physics_diagram":
			if (spec.subKind === "ray_optics") return spec.axisMax <= spec.axisMin;
			return false;
		default:
			return false;
	}
}

function validateDataTable(spec: Extract<QuestionVisualSpec, { kind: "data_table" }>): boolean {
	const width = spec.headers.length;
	if (width === 0) return false;
	const headerSet = new Set(spec.headers.map((h) => h.trim().toLowerCase()));
	if (headerSet.size !== spec.headers.length) return false;
	return spec.rows.every((row) => row.length === width);
}

function validateMathGeometry(spec: Extract<QuestionVisualSpec, { kind: "math_geometry" }>): boolean {
	const labels = new Set<string>();
	for (const primitive of spec.primitives) {
		const label = "label" in primitive ? primitive.label : null;
		if (!label) continue;
		const norm = label.trim().toLowerCase();
		if (!norm) continue;
		if (labels.has(norm)) return false;
		labels.add(norm);
	}
	return true;
}

function validateMathFunctionPlot(
	spec: Extract<QuestionVisualSpec, { kind: "math_function_plot" }>,
): boolean {
	const exprs = new Set(spec.items.map((item) => item.expr.trim()));
	return exprs.size === spec.items.length;
}

function validateNumberLine(spec: Extract<QuestionVisualSpec, { kind: "number_line" }>): boolean {
	for (const point of spec.points) {
		if (point.value < spec.min || point.value > spec.max) return false;
	}
	for (const interval of spec.intervals) {
		if (interval.from < spec.min || interval.to > spec.max) return false;
		if (interval.to < interval.from) return false;
	}
	return true;
}

function validateStatistics(spec: Extract<QuestionVisualSpec, { kind: "statistics_chart" }>): boolean {
	switch (spec.subKind) {
		case "histogram":
		case "frequency_polygon":
		case "ogive":
			return spec.bins.some((b) => b.frequency > 0);
		case "bar":
			return spec.data.some((d) => d.value > 0);
		case "pie":
			return spec.slices.reduce((sum, slice) => sum + slice.value, 0) > 0;
		case "line":
			return spec.series.every((series) => {
				for (let i = 1; i < series.points.length; i++) {
					if (series.points[i]!.x < series.points[i - 1]!.x) return false;
				}
				return true;
			});
		case "box":
			return spec.groups.every(
				(group) =>
					group.min <= group.q1 &&
					group.q1 <= group.median &&
					group.median <= group.q3 &&
					group.q3 <= group.max,
			);
		default:
			return true;
	}
}

function validatePhysics(spec: Extract<QuestionVisualSpec, { kind: "physics_diagram" }>): boolean {
	switch (spec.subKind) {
		case "free_body": {
			const forceNames = new Set(spec.forces.map((f) => f.name.trim().toLowerCase()));
			return forceNames.size === spec.forces.length;
		}
		case "ray_optics":
			return (
				spec.objects.every((obj) => obj.x >= spec.axisMin && obj.x <= spec.axisMax) &&
				spec.lenses.every((lens) => lens.x >= spec.axisMin && lens.x <= spec.axisMax)
			);
		case "circuit": {
			const nodeIds = new Set(spec.nodes.map((node) => node.id));
			if (nodeIds.size !== spec.nodes.length) return false;
			return spec.components.every(
				(component) => nodeIds.has(component.from) && nodeIds.has(component.to),
			);
		}
		default:
			return true;
	}
}

function validateAccountancy(spec: Extract<QuestionVisualSpec, { kind: "accountancy_table" }>): boolean {
	switch (spec.subKind) {
		case "journal_entry":
		case "cash_book":
		case "rectification": {
			if (spec.rows.length === 0) return false;
			let debitSum = 0;
			let creditSum = 0;
			for (const row of spec.rows) {
				debitSum += row.debit ?? 0;
				creditSum += row.credit ?? 0;
			}
			const hasDebit = spec.rows.some((r) => r.debit != null && r.debit > 0);
			const hasCredit = spec.rows.some((r) => r.credit != null && r.credit > 0);
			if (!hasDebit || !hasCredit) return true;
			return Math.abs(debitSum - creditSum) <= 1e-3;
		}
		case "trial_balance":
			return spec.rows.length > 0;
		case "ledger":
			return true;
		case "balance_sheet":
			return spec.assetsSide.length > 0 && spec.equityAndLiabilitiesSide.length > 0;
		case "p_and_l":
			return spec.rows.length > 0;
		default:
			return true;
	}
}

function validateEconomics(spec: Extract<QuestionVisualSpec, { kind: "economics_curve" }>): boolean {
	return spec.marks.every(
		(mark) =>
			mark.x >= spec.xMin &&
			mark.x <= spec.xMax &&
			(spec.yMin == null || mark.y >= spec.yMin) &&
			(spec.yMax == null || mark.y <= spec.yMax),
	);
}

function validateEnglishPassage(spec: Extract<QuestionVisualSpec, { kind: "english_passage" }>): boolean {
	for (let i = 1; i < spec.lines.length; i++) {
		if (spec.lines[i]!.number <= spec.lines[i - 1]!.number) return false;
	}
	return true;
}

function validateChemistryMolecule(
	spec: Extract<QuestionVisualSpec, { kind: "chemistry_molecule" }>,
): boolean {
	return spec.smiles.trim().length > 0;
}

function validateIndiaMap(spec: Extract<QuestionVisualSpec, { kind: "india_map" }>): boolean {
	if (!spec.highlightedStates) return true;
	const uniq = new Set(spec.highlightedStates);
	return uniq.size === spec.highlightedStates.length;
}

function validateSpecSemantics(spec: QuestionVisualSpec): boolean {
	if (hasInvertedBounds(spec)) return false;
	switch (spec.kind) {
		case "math_geometry":
			return validateMathGeometry(spec);
		case "math_function_plot":
			return validateMathFunctionPlot(spec);
		case "number_line":
			return validateNumberLine(spec);
		case "physics_diagram":
			return validatePhysics(spec);
		case "chemistry_molecule":
			return validateChemistryMolecule(spec);
		case "chemistry_reaction":
			return /(?:->|<=>|→|⇌)/.test(spec.ce);
		case "accountancy_table":
			return validateAccountancy(spec);
		case "economics_curve":
			return validateEconomics(spec);
		case "statistics_chart":
			return validateStatistics(spec);
		case "data_table":
			return validateDataTable(spec);
		case "india_map":
			return validateIndiaMap(spec);
		case "english_passage":
			return validateEnglishPassage(spec);
		default:
			return true;
	}
}

function buildDeterministicPatches(output: PracticeGenerationOutput, groundingMode: StemGroundingMode): {
	patches: VisualPatch[];
	checkedVisuals: number;
	nullifiedVisuals: number;
	schemaInvalidVisuals: number;
	groundingMismatchedVisuals: number;
	genericScaffoldVisuals: number;
	topicIncoherentVisuals: number;
} {
	const patches: VisualPatch[] = [];
	let checkedVisuals = 0;
	let nullifiedVisuals = 0;
	let schemaInvalidVisuals = 0;
	let groundingMismatchedVisuals = 0;
	let genericScaffoldVisuals = 0;
	let topicIncoherentVisuals = 0;

	for (const [index, question] of output.questions.entries()) {
		if (question.visual == null) continue;
		checkedVisuals++;
		const parsed = questionVisualEnvelopeSchema.safeParse(question.visual);
		if (!parsed.success) {
			patches.push({ action: "null_visual", index });
			nullifiedVisuals++;
			schemaInvalidVisuals++;
			continue;
		}
		const groundingMismatch =
			groundingMode !== "off" ? hasStemGroundingMismatch(question, parsed.data) : false;
		if (groundingMismatch) {
			groundingMismatchedVisuals++;
			if (groundingMode === "enforce") {
				patches.push({ action: "null_visual", index });
				nullifiedVisuals++;
				continue;
			}
		}
		if (isGenericScaffoldVisual(parsed.data)) {
			patches.push({ action: "null_visual", index });
			nullifiedVisuals++;
			genericScaffoldVisuals++;
			continue;
		}
		if (isPhysicsTopicIncoherent(question, parsed.data)) {
			patches.push({ action: "null_visual", index });
			nullifiedVisuals++;
			topicIncoherentVisuals++;
			continue;
		}
		const semanticReplacement =
			buildKinematicsSemanticReplacement(question, parsed.data) ??
			buildGravitationSemanticReplacement(question, parsed.data);
		if (semanticReplacement) {
			patches.push({ action: "replace_visual", index, value: semanticReplacement });
			continue;
		}
		if (
			hasUnsupportedFreeBody(question, parsed.data) ||
			hasCrossFamilyPlotMismatch(question, parsed.data) ||
			hasWorkFrictionForceMismatch(question, parsed.data) ||
			hasFluidThermalMismatch(question, parsed.data) ||
			isChemistryEquilibriumMoleculeMismatch(question, parsed.data) ||
			isUnsupportedChemistryReaction(question, parsed.data)
		) {
			patches.push({ action: "null_visual", index });
			nullifiedVisuals++;
			topicIncoherentVisuals++;
			continue;
		}
		if (!validateSpecSemantics(parsed.data.spec) || containsAnswerLeak(parsed.data.caption) || containsAnswerLeak(parsed.data.altText)) {
			patches.push({ action: "null_visual", index });
			nullifiedVisuals++;
		}
	}

	return {
		patches,
		checkedVisuals,
		nullifiedVisuals,
		schemaInvalidVisuals,
		groundingMismatchedVisuals,
		genericScaffoldVisuals,
		topicIncoherentVisuals,
	};
}

export async function runValidatorPass(
	output: PracticeGenerationOutput,
	context: { correlationId: string; userId: string; generationRunId?: string | null },
): Promise<RunValidatorPassResult> {
	if (!isPracticeVisualValidatorEnabled()) {
		return { ok: true, patches: [] };
	}
	const hasVisual = output.questions.some((q) => q.visual != null);
	if (!hasVisual) {
		return { ok: true, patches: [] };
	}
	try {
		return await executeValidatorRun(output, context);
	} catch (e) {
		logServerError("runValidatorPass.invoke", e, {
			correlationId: context.correlationId,
			userId: context.userId,
			model: "deterministic-validator",
		});
		return { ok: false, patches: [] };
	}
}

export async function executeValidatorRun(
	output: PracticeGenerationOutput,
	context: ExecuteMeta,
): Promise<RunValidatorPassResult> {
	try {
		const groundingMode = getPracticeVisualStemGroundingMode();
		const result = buildDeterministicPatches(output, groundingMode);

		logPracticeObs({
			phase: "practice_generation_validator_pass",
			correlation_id: context.correlationId,
			mode: "deterministic",
			grounding_mode: groundingMode,
			patch_candidates: result.patches.length,
			checked_visuals: result.checkedVisuals,
			nullified_visuals: result.nullifiedVisuals,
			schema_invalid_visuals: result.schemaInvalidVisuals,
			grounding_mismatched_visuals: result.groundingMismatchedVisuals,
			generic_scaffold_visuals: result.genericScaffoldVisuals,
			topic_incoherent_visuals: result.topicIncoherentVisuals,
		});

		return { ok: true, patches: result.patches };
	} catch (e) {
		throw e;
	}
}
