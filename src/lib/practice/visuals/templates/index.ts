import type { QuestionVisualKind } from "../types";

export const CORE_VISUAL_TEMPLATE_SUBJECTS = [
	"Mathematics",
	"Physics",
	"Chemistry",
	"Biology",
	"Accountancy",
	"Economics",
	"Statistics",
	"English",
	"Social Science",
	"Geography",
	"History",
	"Civics",
	"Business Studies",
	"Science",
] as const;

export type CoreVisualTemplateSubject = (typeof CORE_VISUAL_TEMPLATE_SUBJECTS)[number];
export type VisualTemplateGradeBand = "6-8" | "9-10" | "11-12" | "any";
export type VisualTemplatePriority = "essential" | "recommended" | "optional";

export type VisualTemplateSlotContract = {
	requiredSlots: string[];
	optionalSlots: string[];
	constraints: string[];
};

export type VisualTemplateDefinition = {
	id: string;
	title: string;
	description: string;
	subjects: CoreVisualTemplateSubject[];
	topicTags: string[];
	gradeBands: VisualTemplateGradeBand[];
	kind: QuestionVisualKind;
	priority: VisualTemplatePriority;
	slotContract: VisualTemplateSlotContract;
	validatorHints: string[];
	fallbackKind: QuestionVisualKind | null;
};

export type VisualTemplatePolicy = {
	enabled: boolean;
	subject: CoreVisualTemplateSubject | null;
	templates: VisualTemplateDefinition[];
	preferredKinds: QuestionVisualKind[];
	promptBrief: string;
};

const SUBJECT_ALIASES = new Map<string, CoreVisualTemplateSubject>([
	["math", "Mathematics"],
	["mathematics", "Mathematics"],
	["physics", "Physics"],
	["chemistry", "Chemistry"],
	["biology", "Biology"],
	["accountancy", "Accountancy"],
	["accounts", "Accountancy"],
	["economics", "Economics"],
	["statistics", "Statistics"],
	["english", "English"],
	["social science", "Social Science"],
	["social_science", "Social Science"],
	["sst", "Social Science"],
	["geography", "Geography"],
	["history", "History"],
	["civics", "Civics"],
	["political science", "Civics"],
	["business studies", "Business Studies"],
	["business_studies", "Business Studies"],
	["science", "Science"],
]);

function normalizeText(value: string | null | undefined): string {
	return (value ?? "")
		.toLowerCase()
		.replace(/[_-]+/g, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeSubject(subjectName: string): CoreVisualTemplateSubject | null {
	const normalized = normalizeText(subjectName);
	return SUBJECT_ALIASES.get(normalized) ?? null;
}

function template(
	definition: Omit<VisualTemplateDefinition, "validatorHints" | "fallbackKind"> &
		Partial<Pick<VisualTemplateDefinition, "validatorHints" | "fallbackKind">>,
): VisualTemplateDefinition {
	return {
		...definition,
		validatorHints: definition.validatorHints ?? [],
		fallbackKind: definition.fallbackKind ?? null,
	};
}

export const VISUAL_TEMPLATE_REGISTRY: VisualTemplateDefinition[] = [
	template({
		id: "math-coordinate-geometry",
		title: "Coordinate geometry construction",
		description: "Labelled points, segments, distances, and slopes on a coordinate plane.",
		subjects: ["Mathematics"],
		topicTags: ["coordinate", "distance", "midpoint", "section", "slope", "geometry"],
		gradeBands: ["9-10", "11-12"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["points", "segments", "view"],
			optionalSlots: ["angleMarkers", "circles", "labels"],
			constraints: ["All point labels in the stem must appear in the diagram.", "Use integer coordinates when possible."],
		},
	}),
	template({
		id: "math-function-graph",
		title: "Function graph",
		description: "Single or multi-curve graph with labelled axes and bounded domain.",
		subjects: ["Mathematics", "Statistics"],
		topicTags: ["function", "polynomial", "quadratic", "linear", "graph", "calculus"],
		gradeBands: ["9-10", "11-12"],
		kind: "math_function_plot",
		priority: "essential",
		slotContract: {
			requiredSlots: ["expression", "xRange", "axisLabels"],
			optionalSlots: ["yRange", "tickSteps", "legend"],
			constraints: ["Expressions must use renderer-supported syntax.", "Do not plot decorative curves unrelated to the question."],
		},
	}),
	template({
		id: "math-number-line-interval",
		title: "Number line interval",
		description: "Intervals, open and closed endpoints, and labelled critical points.",
		subjects: ["Mathematics"],
		topicTags: ["number line", "inequality", "sets", "interval"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "number_line",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["min", "max", "tickStep", "intervals"],
			optionalSlots: ["points", "axisLabel", "minorTicks"],
			constraints: ["Endpoint openness must match the solution set exactly."],
		},
	}),
	template({
		id: "physics-circuit-measurement",
		title: "Circuit measurement",
		description: "Board-style circuit with battery, resistor/bulb, switch, ammeter, and voltmeter.",
		subjects: ["Physics", "Science"],
		topicTags: ["circuit", "current", "voltage", "resistance", "ohm", "electricity"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["components", "connections", "battery"],
			optionalSlots: ["currentArrow", "polarityMarks", "componentValues"],
			constraints: ["Ammeter must be in series.", "Voltmeter must be parallel to the measured component."],
		},
	}),
	template({
		id: "physics-electric-field-lines",
		title: "Electric or magnetic field lines",
		description: "Field-source diagram for charges, poles, or current-carrying conductors.",
		subjects: ["Physics", "Science"],
		topicTags: ["electric field", "field lines", "charge", "magnetic field", "potential", "dipole"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_field_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["fieldType", "sources", "fieldLineCount"],
			optionalSlots: ["labels", "title"],
			constraints: ["Electric field arrows must point away from positive and toward negative charges."],
		},
		fallbackKind: "physics_diagram",
	}),
	template({
		id: "physics-wave-markers",
		title: "Wave marker diagram",
		description: "Waveform with amplitude, wavelength, node, antinode, or phase markers.",
		subjects: ["Physics", "Science"],
		topicTags: ["wave", "wavelength", "amplitude", "standing wave", "interference", "sound"],
		gradeBands: ["9-10", "11-12"],
		kind: "physics_wave_diagram",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["waveType", "xRange", "amplitude"],
			optionalSlots: ["wavelength", "markers"],
			constraints: ["The labelled marker positions must match the wave quantity asked in the stem."],
		},
	}),
	template({
		id: "chemistry-galvanic-cell",
		title: "Electrochemical cell",
		description: "Anode, cathode, electrolyte, salt bridge, and electron-flow direction.",
		subjects: ["Chemistry"],
		topicTags: ["galvanic", "electrochemical", "cell", "salt bridge", "electrode", "electron flow"],
		gradeBands: ["11-12"],
		kind: "chemistry_cell_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["anode", "cathode", "electronFlow"],
			optionalSlots: ["saltBridge", "labels"],
			constraints: ["Anode/cathode polarity must match the cell type.", "Do not reveal the answer in labels."],
		},
		fallbackKind: "chemistry_reaction",
	}),
	template({
		id: "chemistry-reaction-conditions",
		title: "Reaction equation with conditions",
		description: "Equation or conversion sequence with reagents and conditions.",
		subjects: ["Chemistry", "Science"],
		topicTags: ["reaction", "equation", "organic", "redox", "equilibrium", "conversion"],
		gradeBands: ["9-10", "11-12"],
		kind: "chemistry_reaction",
		priority: "essential",
		slotContract: {
			requiredSlots: ["equation"],
			optionalSlots: ["conditions", "stateSymbols", "labels"],
			constraints: ["Use mhchem syntax.", "Captions must not reveal a product if prediction is assessed."],
		},
	}),
	template({
		id: "biology-pedigree-trait",
		title: "Pedigree trait diagram",
		description: "Pedigree-style biology diagram for inheritance questions.",
		subjects: ["Biology", "Science"],
		topicTags: ["pedigree", "inheritance", "trait", "genetics", "recessive", "dominant"],
		gradeBands: ["9-10", "11-12"],
		kind: "biology_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "labels", "title"],
			optionalSlots: ["notes"],
			constraints: ["Affected and unaffected labels must be visually distinguishable in text and shape."],
		},
		fallbackKind: "data_table",
	}),
	template({
		id: "biology-ecology-flow",
		title: "Biology ecology process",
		description: "Food chain, ecological pyramid, or biological process flow.",
		subjects: ["Biology", "Science"],
		topicTags: ["food chain", "ecology", "ecosystem", "pyramid", "nitrogen cycle", "process"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "biology_diagram",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["subKind", "labels"],
			optionalSlots: ["notes", "title"],
			constraints: ["Energy or material flow direction must be explicit when assessed."],
		},
		fallbackKind: "flowchart",
	}),
	template({
		id: "accountancy-ledger-statement",
		title: "Accountancy statement or ledger",
		description: "Journal, ledger, trial balance, balance sheet, P&L, cash book, or rectification table.",
		subjects: ["Accountancy"],
		topicTags: ["journal", "ledger", "trial balance", "balance sheet", "profit and loss", "rectification", "cash book"],
		gradeBands: ["11-12"],
		kind: "accountancy_table",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "rows"],
			optionalSlots: ["totals", "blankCells", "workingNotes"],
			constraints: ["Balanced tables must reconcile.", "Leave blank only the assessed cells."],
		},
	}),
	template({
		id: "economics-demand-supply",
		title: "Demand and supply curve",
		description: "Market curve with equilibrium and policy marks.",
		subjects: ["Economics", "Business Studies"],
		topicTags: ["demand", "supply", "equilibrium", "price ceiling", "price floor", "market"],
		gradeBands: ["11-12"],
		kind: "economics_curve",
		priority: "essential",
		slotContract: {
			requiredSlots: ["curves", "axisLabels"],
			optionalSlots: ["marks", "equilibriumPoint", "policyLine"],
			constraints: ["Caption must not state the interpretation being assessed."],
		},
	}),
	template({
		id: "statistics-chart-stimulus",
		title: "Statistics chart",
		description: "Histogram, bar, line, scatter, pie, frequency polygon, ogive, or box chart.",
		subjects: ["Statistics", "Economics", "Business Studies", "Geography", "Social Science"],
		topicTags: ["statistics", "frequency", "histogram", "bar chart", "line graph", "ogive", "box plot", "data"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "statistics_chart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "data"],
			optionalSlots: ["axisLabels", "legend", "callouts"],
			constraints: ["Chart data must match values used by the answer key."],
		},
	}),
	template({
		id: "english-line-source-extract",
		title: "Line-numbered passage",
		description: "Short passage, poem, dialogue, or case stimulus with line numbers.",
		subjects: ["English"],
		topicTags: ["passage", "poem", "dialogue", "comprehension", "source", "line"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "english_passage",
		priority: "essential",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source"],
			constraints: ["Line references in the stem must exist in the passage."],
		},
	}),
	template({
		id: "social-science-source-extract",
		title: "Source extract",
		description: "History, civics, economics, or geography source/case extract with line numbers.",
		subjects: ["Social Science", "History", "Civics", "Geography", "Business Studies"],
		topicTags: ["source", "extract", "case", "constitution", "history", "civics", "passage"],
		gradeBands: ["9-10", "11-12"],
		kind: "source_extract",
		priority: "essential",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source", "context"],
			constraints: ["Do not put interpretation or answers in alt text."],
		},
		fallbackKind: "english_passage",
	}),
	template({
		id: "social-science-map-location",
		title: "Map visual",
		description: "Map-based location, region, route, or thematic stimulus.",
		subjects: ["Geography", "Social Science", "History"],
		topicTags: ["map", "location", "state", "region", "river", "resource", "route", "climate"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "map_visual",
		priority: "essential",
		slotContract: {
			requiredSlots: ["scope", "regions", "title"],
			optionalSlots: ["mapStyle"],
			constraints: ["Every highlighted region must be named in alt text without revealing the answer."],
		},
		fallbackKind: "india_map",
	}),
	template({
		id: "history-timeline",
		title: "Timeline",
		description: "Chronological events with labelled dates and concise annotations.",
		subjects: ["History", "Social Science"],
		topicTags: ["timeline", "chronology", "movement", "event", "period", "dates"],
		gradeBands: ["6-8", "9-10", "11-12"],
		kind: "timeline",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["events", "title"],
			optionalSlots: ["axisLabel"],
			constraints: ["Events must be in chronological order unless the question asks students to reorder them."],
		},
	}),
	template({
		id: "business-process-flow",
		title: "Business process flow",
		description: "Management, planning, organizing, staffing, or communication flowchart.",
		subjects: ["Business Studies"],
		topicTags: ["management", "planning", "organising", "staffing", "directing", "controlling", "process"],
		gradeBands: ["11-12"],
		kind: "flowchart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["nodes", "edges"],
			optionalSlots: ["decisionLabels", "outcomes"],
			constraints: ["Node labels must not name the principle if the question assesses identification."],
		},
	}),
	template({
		id: "science-classification-table",
		title: "Science classification table",
		description: "Comparison or classification table for general science concepts.",
		subjects: ["Science"],
		topicTags: ["classification", "comparison", "properties", "observation", "experiment", "table"],
		gradeBands: ["6-8", "9-10"],
		kind: "data_table",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["headers", "rows"],
			optionalSlots: ["caption", "boldCells"],
			constraints: ["The table should contain the stimulus, not duplicate all information in the stem."],
		},
	}),
];

function gradeBandScore(template: VisualTemplateDefinition, gradeBand: VisualTemplateGradeBand | null): number {
	if (!gradeBand || gradeBand === "any") return 0;
	if (template.gradeBands.includes(gradeBand)) return 4;
	if (template.gradeBands.includes("any")) return 1;
	return -3;
}

function priorityScore(priority: VisualTemplatePriority): number {
	if (priority === "essential") return 3;
	if (priority === "recommended") return 2;
	return 1;
}

function topicScore(template: VisualTemplateDefinition, topicHintNorm: string): number {
	if (!topicHintNorm) return 0;
	let score = 0;
	for (const tag of template.topicTags) {
		const normalizedTag = normalizeText(tag);
		if (normalizedTag && topicHintNorm.includes(normalizedTag)) score += 6;
	}
	const titleWords = normalizeText(`${template.title} ${template.description}`).split(" ").filter((word) => word.length > 3);
	for (const word of titleWords) {
		if (topicHintNorm.includes(word)) score += 1;
	}
	return score;
}

export function getVisualTemplatesForSubjectTopic(args: {
	subjectName: string;
	topicHint?: string | null;
	gradeBand?: VisualTemplateGradeBand | null;
	maxTemplates?: number;
}): VisualTemplateDefinition[] {
	const subject = normalizeSubject(args.subjectName);
	if (!subject) return [];
	const topicHintNorm = normalizeText(args.topicHint);
	const maxTemplates = Math.max(1, args.maxTemplates ?? VISUAL_TEMPLATE_REGISTRY.length);

	return VISUAL_TEMPLATE_REGISTRY.filter((template) => template.subjects.includes(subject))
		.map((template, order) => ({
			template,
			order,
			score:
				topicScore(template, topicHintNorm) +
				gradeBandScore(template, args.gradeBand ?? null) +
				priorityScore(template.priority),
		}))
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.slice(0, maxTemplates)
		.map((entry) => entry.template);
}

function uniqueKinds(templates: VisualTemplateDefinition[]): QuestionVisualKind[] {
	const seen = new Set<QuestionVisualKind>();
	const kinds: QuestionVisualKind[] = [];
	for (const template of templates) {
		if (seen.has(template.kind)) continue;
		seen.add(template.kind);
		kinds.push(template.kind);
	}
	return kinds;
}

export function resolveVisualTemplatePolicy(args: {
	subjectName: string;
	topicHint?: string | null;
	gradeBand?: VisualTemplateGradeBand | null;
	maxTemplates?: number;
}): VisualTemplatePolicy {
	const subject = normalizeSubject(args.subjectName);
	const templates = getVisualTemplatesForSubjectTopic(args);
	const preferredKinds = uniqueKinds(templates);
	const promptBrief =
		templates.length === 0 ?
			"Visual template engine: no subject/topic templates are available; keep visual null unless the legacy renderer policy requires one."
		:	[
				"Visual template engine: choose only from these template IDs and fill only their declared slots.",
				...templates.map((template, index) => {
					const required = template.slotContract.requiredSlots.join(", ");
					const constraints = template.slotContract.constraints.join(" ");
					return `${index + 1}. ${template.id} (${template.kind}) required: ${required}. ${constraints}`;
				}),
			].join("\n");

	return {
		enabled: templates.length > 0,
		subject,
		templates,
		preferredKinds,
		promptBrief,
	};
}
