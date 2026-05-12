import type { QuestionVisualEnvelope } from "./schemas";

function hashString(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Non-spoiling caption from blueprint visual brief. */
export function shortCaptionFromIdea(idea: string, maxLen: number): string {
	const t = idea.replace(/\s+/g, " ").trim();
	if (t.length <= maxLen) return t;
	return `${t.slice(0, maxLen - 1).trim()}…`;
}

function routingContext(visualIdea: string | null | undefined, questionText: string): string {
	return `${visualIdea ?? ""} ${questionText}`.toLowerCase();
}

/**
 * Topics where physics_diagram/free_body would be misleading.
 * For these, return null from buildPhysicsIdeaAwareEnvelope so the fallback
 * loop tries math_function_plot (sinusoidal) or data_table instead.
 */
const WAVE_OSCILLATION_CTX_RE =
	/\b(wavelength|wave\s+speed|wave\s+velocity|frequency|amplitude|transverse\s+wave|longitudinal\s+wave|superposition|interference|beat\b|beats\b|resonan|standing\s+wave|stationary\s+wave|harmonic|oscillat|vibrat|sinusoidal|wave\s+equation|wave\s+function|shm\b|simple\s+harmonic|progressive\s+wave|pulse\s+(on|along|through)|y\s*=\s*a\s*sin|y\s*=\s*a\s*cos)\b/i;

const KTG_THERMODYNAMICS_CTX_RE =
	/\b(kinetic\s+theory|ideal\s+gas|avogadro|equipartition|rms\s+speed|mean\s+free\s+path|degrees\s+of\s+freedom|heat\s+capacity|molar\s+heat|specific\s+heat\s+capacity|boltzmann|molecular\s+velocit|pv\s*=|p\s*v\s*diagram|p[-\s]v\s+graph|isotherm|adiabat|isobar|gas\s+law|van\s+der\s+waals|kinetic\s+energy\s+of\s+molecules|vrms|vmp|v\s*avg)\b/i;

const GRAVITATION_CTX_RE =
	/\b(gravity|gravitation|gravitational|surface\s+gravity|escape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|neutral\s+point|two[-\s]?sphere|moon|earth'?s?\s+(surface|centre|center|radius)|r_e\b|height\s+h|depth\s+d|below\s+earth|above\s+earth|inside\s+earth|halfway\s+(down|to)|radius\s+cubed|mass\s+is\s+proportional)\b/i;

const KINEMATICS_COMPONENT_CTX_RE =
	/\b(projectile|trajectory|initial\s+velocity\s+components?|velocity\s+components?|component\s+equations?|constant\s+acceleration\s+in\s+(?:the\s+)?[xy][-\s]?direction|motion\s+in\s+a\s+plane|v_?0?[xy]\b|v_\{0[xy]\}|a_[xy]\b|x[-\s]?motion|y[-\s]?motion|horizontal\s+acceleration|vertical\s+acceleration)\b/i;

const WORK_FRICTION_CTX_RE =
	/\b(work\s+done|net\s+work|kinetic\s+energy|friction|coefficient\s+of\s+kinetic\s+friction|force\s+and\s+(?:the\s+)?displacement|displacement\s+and\s+(?:the\s+)?force|opposite\s+in\s+direction|same\s+direction|skids?\s+to\s+a\s+stop|applied\s+force)\b/i;

const VECTOR_RESULTANT_CTX_RE =
	/\b(resultant\s+(?:velocity|vector|force)|two\s+vectors?|vector\s+[ab]\b|components?\s+of\s+(?:a\s+)?vector|north|east|south|west|quadrant|angle\s+between\s+(?:the\s+)?vectors?|acts?\s+at\s+\d+(?:\.\d+)?°)\b/i;

/**
 * 2D coordinate geometry / conic sections — questions where a number_line
 * fallback is meaningless. Should trigger a math_geometry scaffold instead.
 */
export const COORD_GEOMETRY_2D_RE =
	/\b(circle|ellipse|hyperbola|parabola|conic\s+section|perpendicular\s+(distance|from|to)|foot\s+of\s+(the\s+)?perpendicular|centre\s+of\s+(the\s+)?circle|radius\s+of\s+(the\s+)?circle|equation\s+of\s+(the\s+)?(circle|ellipse|hyperbola|parabola)|coordinate\s+geometry|vertices\s+of\s+(the\s+)?(ellipse|hyperbola)|foci\s+of\s+(the\s+)?(ellipse|hyperbola)|slope\s+of\s+(the\s+)?line\s+joining|distance\s+from\s+.*\s+to\s+the\s+line|point\s+on\s+the\s+(circle|ellipse|parabola|curve))\b/i;

function routePhysicsSubkind(ctx: string): "circuit" | "ray_optics" | "free_body" {
	// Prefer mechanics when the brief is clearly forces / Newton / strings / ramps,
	// unless the text is explicitly about electric circuits.
	if (
		/\bfree[\s-]body|\bfbd\b|tension|connected bodies|string over pulley|pulley|incline|inclined plane|friction|normal force|equilibrium of forces\b/.test(
			ctx,
		) &&
		!/\b(circuit diagram|series circuit|parallel circuit|battery|resistor\b|\bohms?\b|ammeter|voltmeter|emf\b)\b/.test(ctx)
	) {
		return "free_body";
	}
	if (
		/\b(circuit|resistor|resistance|battery|cell|ohm|ammeter|voltmeter|emf|series|parallel|switch|bulb|filament|kirchhoff)\b/.test(
			ctx,
		)
	) {
		return "circuit";
	}
	if (
		/\b(lens|mirror|focal|ray|optic|image|object distance|refraction|snell|principal axis|magnif)\b/.test(ctx)
	) {
		return "ray_optics";
	}
	return "free_body";
}

function buildKinematicsComponentEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope {
	const caption =
		visualIdea && visualIdea.trim().length >= 8 ?
			shortCaptionFromIdea(visualIdea, 120)
		:	"Projectile motion sketch showing horizontal and vertical velocity components.";
	const hasProjectile = /\bprojectile|trajectory|launched|launch\b/i.test(`${questionText} ${visualIdea ?? ""}`);

	return {
		caption,
		altText:
			"Coordinate sketch with an initial velocity vector resolved into horizontal v0x and vertical v0y components.",
		spec: {
			kind: "math_geometry",
			view: { xMin: 0, xMax: 12, yMin: 0, yMax: 8, showGrid: true, showAxes: true },
			primitives: [
				{ type: "point", at: { x: 2, y: 1.5 }, label: "launch", labelPosition: "s" },
				{
					type: "vector",
					from: { x: 2, y: 1.5 },
					to: { x: 5.8, y: 4.2 },
					label: hasProjectile ? "v0" : "v",
				},
				{
					type: "vector",
					from: { x: 2, y: 1.5 },
					to: { x: 5.8, y: 1.5 },
					label: "v0x",
				},
				{
					type: "vector",
					from: { x: 5.8, y: 1.5 },
					to: { x: 5.8, y: 4.2 },
					label: "v0y",
				},
				{
					type: "arc",
					center: { x: 2, y: 1.5 },
					radius: 1.2,
					startAngleDeg: 0,
					endAngleDeg: 35,
					minorArc: true,
					dashed: null,
					label: "θ",
				},
				{
					type: "segment",
					from: { x: 2, y: 1.5 },
					to: { x: 10.5, y: 1.5 },
					label: "x motion",
					dashed: true,
					tickMarks: null,
					arrowEnd: true,
				},
				{
					type: "arc",
					center: { x: 2.2, y: 0.8 },
					radius: 4.8,
					startAngleDeg: 15,
					endAngleDeg: 72,
					minorArc: true,
					dashed: true,
					label: "path",
				},
			],
		},
	};
}

function buildVectorResultantEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope {
	const caption =
		visualIdea && visualIdea.trim().length >= 8 ?
			shortCaptionFromIdea(visualIdea, 120)
		:	"Vector addition sketch showing A, B, included angle, and resultant R.";
	const text = `${questionText} ${visualIdea ?? ""}`;
	const angleMatch = text.match(/(\d+(?:\.\d+)?)\s*°/);
	const angleLabel = angleMatch ? `${angleMatch[1]}°` : "θ";
	const hasCompass = /\bnorth|east|south|west|quadrant\b/i.test(text);
	const primitives: Extract<QuestionVisualEnvelope["spec"], { kind: "math_geometry" }>["primitives"] =
		hasCompass ?
			[
				{ type: "point", at: { x: 4, y: 4 }, label: "O", labelPosition: "sw" },
				{ type: "vector", from: { x: 4, y: 4 }, to: { x: 4, y: 7 }, label: "north" },
				{ type: "vector", from: { x: 4, y: 4 }, to: { x: 7.2, y: 2.2 }, label: "current" },
				{ type: "vector", from: { x: 4, y: 4 }, to: { x: 7.2, y: 5.2 }, label: "R" },
				{ type: "segment", from: { x: 4, y: 4 }, to: { x: 8.5, y: 4 }, label: "east", dashed: true, tickMarks: null, arrowEnd: true },
				{ type: "segment", from: { x: 4, y: 4 }, to: { x: 4, y: 1 }, label: "south", dashed: true, tickMarks: null, arrowEnd: true },
			]
		:	[
				{ type: "point", at: { x: 2, y: 2 }, label: "O", labelPosition: "sw" },
				{ type: "vector", from: { x: 2, y: 2 }, to: { x: 7, y: 2 }, label: "A" },
				{ type: "vector", from: { x: 2, y: 2 }, to: { x: 5.2, y: 5.6 }, label: "B" },
				{ type: "vector", from: { x: 2, y: 2 }, to: { x: 10.2, y: 5.6 }, label: "R" },
				{ type: "segment", from: { x: 7, y: 2 }, to: { x: 10.2, y: 5.6 }, label: "B", dashed: true, tickMarks: null, arrowEnd: true },
				{ type: "segment", from: { x: 5.2, y: 5.6 }, to: { x: 10.2, y: 5.6 }, label: "A", dashed: true, tickMarks: null, arrowEnd: true },
				{
					type: "arc",
					center: { x: 2, y: 2 },
					radius: 1.1,
					startAngleDeg: 0,
					endAngleDeg: 48,
					minorArc: true,
					dashed: null,
					label: angleLabel,
				},
			];

	return {
		caption,
		altText: "Vector addition diagram with original vectors and resultant drawn from the common origin.",
		spec: {
			kind: "math_geometry",
			view: { xMin: 0, xMax: 12, yMin: 0, yMax: 8, showGrid: true, showAxes: true },
			primitives,
		},
	};
}

function buildWorkFrictionEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope {
	const text = `${questionText} ${visualIdea ?? ""}`;
	const appliedMatch = text.match(/(\d+(?:\.\d+)?)\s*N\b/i);
	const appliedMagnitude = appliedMatch ? Number(appliedMatch[1]) : 7;
	const massMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
	const mass = massMatch ? Number(massMatch[1]) : 2;
	const weight = Number((mass * 9.8).toFixed(1));
	const frictionMatch =
		text.match(/(?:friction|f_k|frictional\s+force)[^\d-]*(\d+(?:\.\d+)?)\s*N\b/i) ??
		text.match(/coefficient\s+of\s+kinetic\s+friction\s+is\s+(\d+(?:\.\d+)?)/i);
	const frictionMagnitude =
		frictionMatch ?
			Number(frictionMatch[1]) <= 1 ?
				Number((Number(frictionMatch[1]) * weight).toFixed(1))
			:	Number(frictionMatch[1])
		:	Number((0.1 * weight).toFixed(1));
	const caption =
		visualIdea && visualIdea.trim().length >= 8 ?
			shortCaptionFromIdea(visualIdea, 120)
		:	"Force diagram for work/friction with displacement and opposing friction.";

	return {
		caption,
		altText:
			"Free-body diagram of a block moving right with applied force right, kinetic friction left, normal up, and weight down.",
		spec: {
			kind: "physics_diagram",
			subKind: "free_body",
			bodyLabel: "Block",
			forces: [
				{
					name: "F_applied",
					magnitude: appliedMagnitude,
					angleDeg: 0,
					unit: "N",
					showMagnitude: true,
					componentArrows: false,
				},
				{
					name: "f_k",
					magnitude: frictionMagnitude,
					angleDeg: 180,
					unit: "N",
					showMagnitude: true,
					componentArrows: false,
				},
				{
					name: "N",
					magnitude: weight,
					angleDeg: 90,
					unit: "N",
					showMagnitude: true,
					componentArrows: false,
				},
				{
					name: "W",
					magnitude: weight,
					angleDeg: 270,
					unit: "N",
					showMagnitude: true,
					componentArrows: false,
				},
			],
			inclineDeg: null,
			inclineLabel: null,
			surfaceHatched: true,
			axisLegend: true,
		},
	};
}

function extractReactionEquation(text: string): string | null {
	const normalized = text
		.replace(/\s+/g, " ")
		.replace(/→/g, "->")
		.replace(/⇌/g, "<=>")
		.trim();
	const match = normalized.match(
		/([A-Z][A-Za-z0-9()^+\-\s]*?(?:\+|<=>|->)[A-Z0-9A-Za-z()^+\-\s]+(?:<=>|->)[A-Z0-9A-Za-z()^+\-\s]+)/,
	);
	if (!match?.[1]) return null;
	return match[1]
		.replace(/\s*,?\s*(?:the|complete|find|write|what|which)\b.*$/i, "")
		.replace(/\s+/g, " ")
		.trim();
}

function buildGravitationGeometryEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope {
	const ctx = routingContext(visualIdea, questionText);
	const stemCtx = questionText.toLowerCase();
	const ideaCtx = (visualIdea ?? "").toLowerCase();
	const hasStemCategory =
		/\bneutral\s+point|two[-\s]?sphere|between\s+them|sphere\s+example\b/.test(stemCtx) ||
		/\bdepth\s+d|below\s+earth|inside\s+earth|halfway\s+(down|to)|weight\s+.*halfway|surface\s+gravity|g\s*\(d\)|radius\s+cubed|mass\s+is\s+proportional|smaller\s+sphere|r_e\s*-\s*d\b/.test(stemCtx) ||
		/\bheight\s+h|above\s+earth|above\s+.*surface|small\s+height\b/.test(stemCtx) ||
		/\bescape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|speed\s+at\s+infinity|at\s+infinity|moon|escapes?\s+earth|reaches\s+infinity|far\s+away\s+from\s+earth\b/.test(stemCtx);
	const captionBase =
		visualIdea && visualIdea.trim().length >= 8 ?
			shortCaptionFromIdea(visualIdea, 120)
		:	"Gravitation geometry sketch for comparing positions and radii.";

	if (
		/\bneutral\s+point|two[-\s]?sphere|between\s+them|sphere\s+example\b/.test(stemCtx) ||
		(!hasStemCategory && /\bneutral\s+point|two[-\s]?sphere|between\s+them|sphere\s+example\b/.test(ideaCtx))
	) {
		return {
			caption: "Two-sphere line sketch with neutral point N marked between the bodies.",
			altText: "Two circular bodies on a horizontal line with a labelled point N between them.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 12, yMin: 0, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 2.5, y: 4 }, radius: 1.1, label: "Sphere A" },
					{ type: "circle", center: { x: 9.5, y: 4 }, radius: 1.5, label: "Sphere B" },
					{ type: "segment", from: { x: 3.6, y: 4 }, to: { x: 8, y: 4 }, label: null, dashed: true, tickMarks: null, arrowEnd: null },
					{ type: "point", at: { x: 5.8, y: 4 }, label: "N", labelPosition: "n" },
				],
			},
		};
	}

	const stemHasEscapeCue =
		/\bescape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|speed\s+at\s+infinity|at\s+infinity|moon|escapes?\s+earth|reaches\s+infinity|far\s+away\s+from\s+earth\b/.test(
			stemCtx,
		);

	if (
		!stemHasEscapeCue &&
		(/\bdepth\s+d|below\s+earth|inside\s+earth|halfway\s+(down|to)|weight\s+.*halfway|surface\s+gravity|g\s*\(d\)|radius\s+cubed|mass\s+is\s+proportional|smaller\s+sphere|r_e\s*-\s*d\b/.test(
			stemCtx,
		) ||
		(!hasStemCategory &&
			/\bdepth\s+d|below\s+earth|inside\s+earth|halfway\s+(down|to)|weight\s+.*halfway|surface\s+gravity|g\s*\(d\)|radius\s+cubed|mass\s+is\s+proportional|smaller\s+sphere|r_e\s*-\s*d\b/.test(
				ideaCtx,
			)))
	) {
		return {
			caption: "Earth cutaway showing surface, centre, and an interior point at depth d.",
			altText: "A circular Earth cross-section with centre C, a surface point, and point P below the surface.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 5, y: 5 }, radius: 3.5, label: "Earth" },
					{ type: "circle", center: { x: 5, y: 5 }, radius: 1.75, label: "interior radius" },
					{ type: "point", at: { x: 5, y: 5 }, label: "C", labelPosition: "sw" },
					{ type: "point", at: { x: 5, y: 8.5 }, label: "surface", labelPosition: "n" },
					{ type: "point", at: { x: 5, y: 6.75 }, label: "P", labelPosition: "e" },
					{ type: "segment", from: { x: 5, y: 5 }, to: { x: 5, y: 8.5 }, label: "R_E", dashed: null, tickMarks: null, arrowEnd: null },
					{ type: "segment", from: { x: 5, y: 8.5 }, to: { x: 5, y: 6.75 }, label: "d", dashed: true, tickMarks: null, arrowEnd: null },
					{ type: "segment", from: { x: 5, y: 5 }, to: { x: 5, y: 6.75 }, label: "R_E - d", dashed: true, tickMarks: null, arrowEnd: null },
				],
			},
		};
	}

	if (
		/\bescape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|speed\s+at\s+infinity|at\s+infinity|moon|escapes?\s+earth|reaches\s+infinity|far\s+away\s+from\s+earth\b/.test(
			stemCtx,
		) ||
		(!hasStemCategory &&
			/\bescape[-\s]?(speed|velocity)|escape\s+from\s+earth|v_esc|v_e|speed\s+at\s+infinity|at\s+infinity|moon|escapes?\s+earth|reaches\s+infinity|far\s+away\s+from\s+earth\b/.test(
				ideaCtx,
			))
	) {
		const compareMoon = /\bmoon\b/.test(stemCtx) || (!hasStemCategory && /\bmoon\b/.test(ideaCtx));
		return {
			caption:
				compareMoon ?
					"Earth-Moon size comparison sketch for reasoning about escape speed."
				:	"Escape-path sketch from a planet surface toward a far point.",
			altText:
				compareMoon ?
					"Two circles of different sizes labelled Earth and Moon, with upward escape arrows."
				:	"A planet circle with a point on the surface and an outward arrow toward a far point.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 12, yMin: 0, yMax: 8, showGrid: false, showAxes: false },
				primitives:
					compareMoon ?
						[
							{ type: "circle", center: { x: 3.5, y: 3.5 }, radius: 2, label: "Earth" },
							{ type: "circle", center: { x: 8.5, y: 3.5 }, radius: 0.9, label: "Moon" },
							{ type: "vector", from: { x: 3.5, y: 5.5 }, to: { x: 3.5, y: 7 }, label: "escape" },
							{ type: "vector", from: { x: 8.5, y: 4.4 }, to: { x: 8.5, y: 5.6 }, label: "escape" },
						]
					:	[
							{ type: "circle", center: { x: 5, y: 2.8 }, radius: 2, label: "Earth" },
							{ type: "point", at: { x: 5, y: 4.8 }, label: "surface", labelPosition: "w" },
							{ type: "vector", from: { x: 5, y: 4.8 }, to: { x: 8.5, y: 7 }, label: "escape path" },
							{ type: "point", at: { x: 9.2, y: 7.2 }, label: "far away", labelPosition: "e" },
						],
			},
		};
	}

	if (
		!hasStemCategory &&
		/\bradius\s+cubed|mass\s+is\s+proportional|smaller\s+sphere|r_e\s*-\s*d|inside\s+earth\b/.test(ctx)
	) {
		return {
			caption: "Nested Earth cross-section showing the enclosed region at depth d.",
			altText: "A full Earth circle and a smaller concentric circle, with centre C and radius labels.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 5, y: 5 }, radius: 3.5, label: "Earth" },
					{ type: "circle", center: { x: 5, y: 5 }, radius: 2, label: "enclosed sphere" },
					{ type: "point", at: { x: 5, y: 5 }, label: "C", labelPosition: "sw" },
					{ type: "segment", from: { x: 5, y: 5 }, to: { x: 8.5, y: 5 }, label: "R_E", dashed: null, tickMarks: null, arrowEnd: null },
					{ type: "segment", from: { x: 5, y: 5 }, to: { x: 7, y: 5 }, label: "R_E - d", dashed: true, tickMarks: null, arrowEnd: null },
				],
			},
		};
	}

	if (
		/\bheight\s+h|above\s+earth|above\s+.*surface|small\s+height\b/.test(stemCtx) ||
		(!hasStemCategory && /\bheight\s+h|above\s+earth|above\s+.*surface|small\s+height\b/.test(ideaCtx))
	) {
		return {
			caption: "Earth radius and altitude sketch for comparing g above the surface.",
			altText: "Earth circle with centre C, surface point S, and a point P at height h above the surface.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 10, yMin: 0, yMax: 11, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 5, y: 4.2 }, radius: 3, label: "Earth" },
					{ type: "point", at: { x: 5, y: 4.2 }, label: "C", labelPosition: "sw" },
					{ type: "point", at: { x: 5, y: 7.2 }, label: "S", labelPosition: "w" },
					{ type: "point", at: { x: 5, y: 8.8 }, label: "P", labelPosition: "e" },
					{ type: "segment", from: { x: 5, y: 4.2 }, to: { x: 5, y: 7.2 }, label: "R_E", dashed: null, tickMarks: null, arrowEnd: null },
					{ type: "segment", from: { x: 5, y: 7.2 }, to: { x: 5, y: 8.8 }, label: "h", dashed: true, tickMarks: null, arrowEnd: null },
				],
			},
		};
	}

	return {
		caption: captionBase,
		altText: "Earth cutaway with centre C, surface radius, and an interior point for depth comparison.",
		spec: {
			kind: "math_geometry",
			view: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, showGrid: false, showAxes: false },
			primitives: [
				{ type: "circle", center: { x: 5, y: 5 }, radius: 3.5, label: "Earth" },
				{ type: "point", at: { x: 5, y: 5 }, label: "C", labelPosition: "sw" },
				{ type: "point", at: { x: 5, y: 8.5 }, label: "surface", labelPosition: "n" },
				{ type: "point", at: { x: 5, y: 6.75 }, label: "P", labelPosition: "e" },
				{ type: "segment", from: { x: 5, y: 5 }, to: { x: 5, y: 8.5 }, label: "R_E", dashed: null, tickMarks: null, arrowEnd: null },
				{ type: "segment", from: { x: 5, y: 8.5 }, to: { x: 5, y: 6.75 }, label: "d", dashed: true, tickMarks: null, arrowEnd: null },
			],
		},
	};
}

export function buildPhysicsIdeaAwareEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope | null {
	const idea = visualIdea?.trim() ?? "";
	if (idea.length < 8) return null;

	const ctx = routingContext(idea, questionText);

	// For wave/oscillation or KTG/thermodynamics topics, physics_diagram/free_body
	// is never the right visual. Return null so the fallback loop can try
	// math_function_plot (which handles sinusoidal wave plots) instead.
	if (WAVE_OSCILLATION_CTX_RE.test(ctx) || KTG_THERMODYNAMICS_CTX_RE.test(ctx)) return null;
	if (GRAVITATION_CTX_RE.test(ctx)) return buildGravitationGeometryEnvelope(questionText, visualIdea);
	if (VECTOR_RESULTANT_CTX_RE.test(ctx)) return buildVectorResultantEnvelope(questionText, visualIdea);
	if (KINEMATICS_COMPONENT_CTX_RE.test(ctx)) return buildKinematicsComponentEnvelope(questionText, visualIdea);
	if (WORK_FRICTION_CTX_RE.test(ctx)) return buildWorkFrictionEnvelope(questionText, visualIdea);

	const sub = routePhysicsSubkind(ctx);
	const caption = shortCaptionFromIdea(idea, 120);
	const altBase = caption;

	if (sub === "circuit") {
		const parallel = hashString(questionText + idea) % 2 === 0;
		if (!parallel) {
			return {
				caption,
				altText: `${altBase} — single-loop battery and resistor scaffold (values are illustrative).`,
				spec: {
					kind: "physics_diagram",
					subKind: "circuit",
					nodes: [
						{ id: "n1", x: 0, y: 1 },
						{ id: "n2", x: 4, y: 1 },
					],
					components: [
						{ type: "battery", from: "n1", to: "n2", emfVolts: 12, label: "12 V" },
						{ type: "resistor", from: "n2", to: "n1", resistanceOhms: 6, label: "R" },
					],
				},
			};
		}
		return {
			caption,
			altText: `${altBase} — parallel branch scaffold with battery (illustrative).`,
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 2 },
					{ id: "n2", x: 0, y: 0 },
					{ id: "n3", x: 6, y: 2 },
					{ id: "n4", x: 6, y: 0 },
					{ id: "n5", x: 3, y: 2 },
					{ id: "n6", x: 3, y: 0 },
				],
				components: [
					{ type: "battery", from: "n2", to: "n1", emfVolts: 6, label: "6 V" },
					{ type: "wire", from: "n1", to: "n5" },
					{ type: "wire", from: "n5", to: "n3" },
					{ type: "wire", from: "n2", to: "n6" },
					{ type: "wire", from: "n6", to: "n4" },
					{ type: "resistor", from: "n5", to: "n6", resistanceOhms: 4, label: "R₁" },
					{ type: "resistor", from: "n3", to: "n4", resistanceOhms: 6, label: "R₂" },
				],
			},
		};
	}

	if (sub === "ray_optics") {
		let lensType: "concave_mirror" | "convex_mirror" | "concave_lens" | "convex_lens" = "convex_lens";
		if (/\bconcave mirror\b/.test(ctx)) lensType = "concave_mirror";
		else if (/\bconvex mirror\b/.test(ctx)) lensType = "convex_mirror";
		else if (/\bconcave lens\b|\bdiverging lens\b/.test(ctx)) lensType = "concave_lens";

		const objX = -12 - (hashString(idea) % 5);
		return {
			caption,
			altText: `${altBase} — principal axis, object arrow, and optical element (scaffold).`,
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -24,
				axisMax: 24,
				axisUnit: "cm",
				objects: [{ kind: "object", x: objX, height: 2.2, dashed: false, label: null }],
				lenses: [{ type: lensType, x: 0, focalLength: 10, label: null }],
				drawRays: false,
			},
		};
	}

	const h = hashString(questionText + idea);
	const variant = h % 3;
	const bodyLabel = (["Block", "Body", "System"] as const)[hashString(questionText + idea) % 3];

	if (variant === 0) {
		return {
			caption,
			altText: `${altBase} — hanging/schematic mass with weight and cord tension (illustrative).`,
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel,
				forces: [
					{ name: "T", magnitude: 49, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 49, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: null,
				axisLegend: null,
			},
		};
	}
	if (variant === 1) {
		return {
			caption,
			altText: `${altBase} — block on horizontal surface with weight and normal (illustrative).`,
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel,
				forces: [
					{ name: "N", magnitude: 58.8, angleDeg: 90, unit: "N", showMagnitude: true, componentArrows: false },
					{ name: "W", magnitude: 58.8, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				],
				inclineDeg: null,
				inclineLabel: null,
				surfaceHatched: true,
				axisLegend: null,
			},
		};
	}

	const incline = 30 + (h % 2) * 5;
	return {
		caption,
		altText: `${altBase} — block on an inclined plane with weight and normal (illustrative).`,
		spec: {
			kind: "physics_diagram",
			subKind: "free_body",
			bodyLabel,
			forces: [
				{ name: "W", magnitude: 98, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				{
					name: "N",
					magnitude: 85,
					angleDeg: 60 + incline / 3,
					unit: "N",
					showMagnitude: true,
					componentArrows: false,
				},
			],
			inclineDeg: incline,
			inclineLabel: null,
			surfaceHatched: true,
			axisLegend: null,
		},
	};
}

export function buildMathFunctionPlotIdeaAwareEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope | null {
	const idea = visualIdea?.trim() ?? "";
	const ctx = routingContext(idea, questionText);
	if (
		idea.length < 8 &&
		!/\b(graph|plot|curve|axes|wave|wavelength|frequency|oscillat|vibrat|sinusoidal|harmonic|shm|amplitude|superposition|beat|resonan|parabola|function|velocity[\s-]time|position[\s-]time|pressure[\s-]volume)\b/.test(
			(questionText + " " + idea).toLowerCase(),
		)
	)
		return null;

	let xLabel = "x";
	let yLabel = "y";
	let expr = "x";
	let xMin = 0;
	let xMax = 10;
	let yMin = 0;
	let yMax = 12;

	const caption = idea.length >= 8 ? shortCaptionFromIdea(idea, 120) : "Graph scaffold aligned to the question.";

	if (/\bp\s*[-–]\s*v\b|pressure.{0,16}volume|pv\b|isotherm|ideal gas.*p.*v\b/.test(ctx)) {
		xLabel = "V";
		yLabel = "P";
		expr = "8/x";
		xMin = 1;
		yMax = 10;
	} else if (/\bt\s*[-–]\s*v\b|temperature.{0,16}volume|charles|isobar/.test(ctx)) {
		xLabel = "V";
		yLabel = "T";
		expr = "0.25 * x + 1";
	} else if (/\bp\s*[-–]\s*t\b|pressure.{0,16}temperature|gay[\s-]*lussac/.test(ctx)) {
		xLabel = "T";
		yLabel = "P";
		expr = "0.35 * x + 2";
	} else if (/\bx\s*[-–]\s*t\b|position.{0,16}time|displacement.{0,16}time/.test(ctx)) {
		xLabel = "t";
		yLabel = "x";
		expr = "2 * x + 1";
	} else if (/\bv\s*[-–]\s*t\b|velocity.{0,16}time/.test(ctx)) {
		xLabel = "t";
		yLabel = "v";
		expr = "3 * x";
	} else if (KINEMATICS_COMPONENT_CTX_RE.test(ctx) && /\bprojectile|trajectory\b/.test(ctx)) {
		xLabel = "x";
		yLabel = "y";
		expr = "0.8*x - 0.08*x^2";
		xMin = 0;
		xMax = 10;
		yMin = 0;
		yMax = 4;
	} else if (/\bsinus|simple harmonic|\bshm\b|sinusoidal|standing wave|stationary wave/.test(ctx)) {
		xLabel = "t";
		yLabel = "x";
		expr = "sin(x)";
		yMin = -2;
		yMax = 2;
	} else if (
		/\bwave|wavelength|frequency|amplitude|superposition|beat|resonan|oscillat|vibrat|progressive wave|transverse|longitudinal/.test(
			ctx,
		)
	) {
		// Generic wave profile for wave-topic questions
		xLabel = "x";
		yLabel = "y";
		expr = "sin(x)";
		xMin = 0;
		xMax = 12;
		yMin = -2;
		yMax = 2;
	} else if (idea.length >= 8) {
		const m = 1 + (hashString(idea) % 4);
		expr = `${m}*x+0.5`;
	} else {
		return null;
	}

	return {
		caption,
		altText: `Axes labelled ${xLabel} and ${yLabel}; curve is an illustrative scaffold (check stem values).`,
		spec: {
			kind: "math_function_plot",
			xMin,
			xMax,
			yMin,
			yMax,
			xLabel,
			yLabel,
			xTickStep: 2,
			yTickStep: 2,
			items: [{ expr, color: "primary", label: null }],
		},
	};
}

export function buildMathGeometryIdeaAwareEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope | null {
	const idea = visualIdea?.trim() ?? "";
	if (GRAVITATION_CTX_RE.test(routingContext(visualIdea, questionText))) {
		return buildGravitationGeometryEnvelope(questionText, visualIdea);
	}
	if (VECTOR_RESULTANT_CTX_RE.test(routingContext(visualIdea, questionText))) {
		return buildVectorResultantEnvelope(questionText, visualIdea);
	}
	if (KINEMATICS_COMPONENT_CTX_RE.test(routingContext(visualIdea, questionText))) {
		return buildKinematicsComponentEnvelope(questionText, visualIdea);
	}
	// Activate for 2D coordinate geometry questions even when no explicit idea is present.
	const isCoordGeometry = COORD_GEOMETRY_2D_RE.test(questionText);
	if (idea.length < 8 && !isCoordGeometry) return null;

	const h = hashString((idea.length >= 8 ? idea : questionText) + questionText);
	const x1 = 1 + (h % 4);
	const y1 = 1 + ((h >> 3) % 4);
	const x2 = x1 + 4 + (h % 3);
	const y2 = y1 + 3 + ((h >> 5) % 3);
	const caption =
		idea.length >= 8
			? shortCaptionFromIdea(idea, 120)
			: "Coordinate geometry scaffold for the question setup.";

	return {
		caption,
		altText: `${caption} — coordinate plane with labelled points or curves (scaffold).`,
		spec: {
			kind: "math_geometry",
			view: {
				xMin: 0,
				xMax: Math.max(12, x2 + 2),
				yMin: 0,
				yMax: Math.max(12, y2 + 2),
				showGrid: true,
				showAxes: true,
			},
			primitives: [
				{
					type: "segment",
					from: { x: x1, y: y1 },
					to: { x: x2, y: y2 },
					label: "AB",
					dashed: false,
					tickMarks: null,
					arrowEnd: null,
				},
			],
		},
	};
}

export function buildChemistryMoleculeIdeaAwareEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope | null {
	const idea = visualIdea?.trim() ?? "";
	const ctx = `${questionText} ${idea}`.toLowerCase();
	if (idea.length < 8 && !/[a-z][a-z]?\d*/i.test(questionText)) return null;
	if (/\b(k_?sp|q_?sp|equilibrium|solubility\s+product|precipitat|common\s+ion|⇌|<=>)\b/i.test(ctx)) {
		return null;
	}
	let smiles: string | null = null;
	let label: string | null = null;
	if (/\bwater|h2o\b/.test(ctx)) {
		smiles = "O";
		label = "H2O";
	} else if (/\bchlorine|cl2\b/.test(ctx)) {
		smiles = "ClCl";
		label = "Cl2";
	} else if (/\bhydrogen|h2\b/.test(ctx)) {
		smiles = "[H][H]";
		label = "H2";
	} else if (/\bcarbon dioxide|co2\b/.test(ctx)) {
		smiles = "O=C=O";
		label = "CO2";
	} else if (/\boxygen|o2\b/.test(ctx)) {
		smiles = "O=O";
		label = "O2";
	} else if (/\bnitrogen|n2\b/.test(ctx)) {
		smiles = "N#N";
		label = "N2";
	} else if (/\bnitric oxide|no\b/.test(ctx)) {
		smiles = "N=O";
		label = "NO";
	} else if (/\bhydrogen iodide|hi\b/.test(ctx)) {
		smiles = "I";
		label = "HI";
	} else if (/\bmethane\b/.test(ctx)) {
		smiles = "C";
		label = "Methane";
	} else if (/\bethanol|ethyl alcohol\b/.test(ctx)) {
		smiles = "CCO";
		label = "Ethanol";
	} else if (/\bbenzene\b/.test(ctx)) {
		smiles = "c1ccccc1";
		label = "Benzene";
	}
	if (!smiles || !label) return null;

	return {
		caption: idea.length >= 8 ? shortCaptionFromIdea(idea, 120) : `2D structure of ${label}.`,
		altText: `2D connectivity structure for ${label}.`,
		spec: {
			kind: "chemistry_molecule",
			smiles,
			display: "2d",
			label,
		},
	};
}

export function buildChemistryReactionIdeaAwareEnvelope(
	questionText: string,
	visualIdea: string | null | undefined,
): QuestionVisualEnvelope | null {
	const idea = visualIdea?.trim() ?? "";
	const ctx = `${questionText} ${idea}`.toLowerCase();
	if (idea.length < 8 && !/[+⇌=]->?|<=>/.test(questionText)) return null;
	let ce: string | null = extractReactionEquation(questionText) ?? extractReactionEquation(idea);
	if (/\beste(r|rif)|hydrolysis|ethyl ethanoate\b/.test(ctx)) {
		ce = "CH3COOC2H5 + H2O -> CH3COOH + C2H5OH";
	} else if (/\bzinc|hydrochloric|hcl\b/.test(ctx)) {
		ce = "Zn + 2HCl -> ZnCl2 + H2";
	} else if (!ce && /\bbarium\s+sulfate|baso4|solubility\s+product|k_?sp\b/.test(ctx)) {
		ce = "BaSO4(s) <=> Ba^2+(aq) + SO4^2-(aq)";
	} else if (!ce && /\bhydrogen\s+iodide|\bhi\b|iodine|i2\b/.test(ctx)) {
		ce = "H2(g) + I2(g) <=> 2HI(g)";
	}
	if (!ce) return null;

	return {
		caption: idea.length >= 8 ? shortCaptionFromIdea(idea, 120) : "Reaction equation from the question stem.",
		altText: "Reaction scheme copied from the question context.",
		spec: {
			kind: "chemistry_reaction",
			ce,
			label: null,
		},
	};
}
