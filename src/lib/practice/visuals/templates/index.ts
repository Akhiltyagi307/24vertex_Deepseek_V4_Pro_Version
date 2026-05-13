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

	// ───────────────────────────────────────────────────────────────────
	// Grade 10 (CBSE / NCERT) — Phase A.10 chapter-specific seed
	// ───────────────────────────────────────────────────────────────────
	// All entries below set gradeBands: ["9-10"]; chapter-specific topicTags
	// raise the planner's match score on Grade 10 generations without
	// disturbing the generic 9-10 / 11-12 entries above. See
	// docs/practice/grade-10-visual-template-audit.md for the chapter map.

	// Mathematics (10)

	template({
		id: "math-polynomial-zeroes-grade-10",
		title: "Polynomial zeroes graph (Grade 10)",
		description: "Polynomial curve crossing the x-axis at its real zeroes.",
		subjects: ["Mathematics"],
		topicTags: ["polynomial", "zeroes", "geometrical meaning", "parabola", "cubic", "degree", "real roots"],
		gradeBands: ["9-10"],
		kind: "math_function_plot",
		priority: "essential",
		slotContract: {
			requiredSlots: ["items", "xMin", "xMax", "xLabel", "yLabel"],
			optionalSlots: ["yMin", "yMax", "xTickStep", "yTickStep"],
			constraints: [
				"The curve must cross the x-axis exactly at the polynomial's real zeroes referenced in the stem.",
				"Do not write the zero values as labels — students must read them off the graph.",
			],
		},
	}),
	template({
		id: "math-linear-equations-pair-grade-10",
		title: "Pair of linear equations graph (Grade 10)",
		description: "Two straight lines on the same axes showing intersection, parallelism, or coincidence.",
		subjects: ["Mathematics"],
		topicTags: ["pair of linear equations", "graphical method", "two variables", "intersection", "consistent", "inconsistent", "lines"],
		gradeBands: ["9-10"],
		kind: "math_function_plot",
		priority: "essential",
		slotContract: {
			requiredSlots: ["items", "xMin", "xMax", "xLabel", "yLabel"],
			optionalSlots: ["yMin", "yMax", "xTickStep", "yTickStep"],
			constraints: [
				"Draw exactly two lines; label each with its equation.",
				"The geometric relationship (intersecting / parallel / coincident) must match the algebraic answer.",
			],
		},
	}),
	template({
		id: "math-quadratic-parabola-grade-10",
		title: "Quadratic parabola (Grade 10)",
		description: "Parabola showing the quadratic's roots and opening direction.",
		subjects: ["Mathematics"],
		topicTags: ["quadratic equation", "parabola", "roots", "nature of roots", "discriminant", "vertex", "axis of symmetry"],
		gradeBands: ["9-10"],
		kind: "math_function_plot",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["items", "xMin", "xMax", "xLabel", "yLabel"],
			optionalSlots: ["yMin", "yMax"],
			constraints: [
				"Plot a single parabola y = ax² + bx + c with opening matching sign(a).",
				"Mark roots only if the question asks students to count or identify them; otherwise leave unlabelled.",
			],
		},
	}),
	template({
		id: "math-triangle-similarity-grade-10",
		title: "Triangle similarity / BPT figure (Grade 10)",
		description: "Two similar triangles or a triangle with a parallel-line transversal for the Basic Proportionality Theorem.",
		subjects: ["Mathematics"],
		topicTags: ["triangles", "similarity", "basic proportionality theorem", "bpt", "thales", "aa criterion", "sas criterion", "sss criterion"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Label vertices clearly; mark corresponding equal angles with the same number of arcs.",
				"For BPT, draw the dividing segment dashed and label the four sub-segment lengths.",
			],
		},
	}),
	template({
		id: "math-pythagoras-right-triangle-grade-10",
		title: "Pythagoras right triangle (Grade 10)",
		description: "Right triangle with labelled legs and hypotenuse and the right-angle marker.",
		subjects: ["Mathematics"],
		topicTags: ["triangles", "pythagoras theorem", "right triangle", "hypotenuse", "perpendicular", "base"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Mark the right angle with a small square at the correct vertex.",
				"Label any two of the three sides with their numeric lengths; the unknown side stays unlabelled.",
			],
		},
	}),
	template({
		id: "math-trigonometry-right-triangle-grade-10",
		title: "Trigonometry right triangle (Grade 10)",
		description: "Right triangle with the reference angle and opposite / adjacent / hypotenuse positions called out.",
		subjects: ["Mathematics"],
		topicTags: ["introduction to trigonometry", "trigonometric ratios", "sine", "cosine", "tangent", "right triangle", "opposite", "adjacent", "hypotenuse"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Mark the right angle and the reference angle (θ) explicitly.",
				"Do not name a ratio in any label — students must compute sin / cos / tan from the figure.",
			],
		},
	}),
	template({
		id: "math-heights-distances-grade-10",
		title: "Heights and distances figure (Grade 10)",
		description: "Vertical object (pole, tower, building) with horizontal ground, angle of elevation / depression, and the line of sight.",
		subjects: ["Mathematics"],
		topicTags: ["heights and distances", "applications of trigonometry", "angle of elevation", "angle of depression", "line of sight", "tower", "building"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Draw the ground as a horizontal segment and the object as a vertical segment meeting at a right angle.",
				"Mark the angle of elevation or depression with an arc and its numeric value (e.g. 30°, 45°, 60°).",
			],
		},
	}),
	template({
		id: "math-circle-tangent-grade-10",
		title: "Circle tangent figure (Grade 10)",
		description: "Circle with a tangent line, the radius to the point of contact, and any chord or external point referenced in the stem.",
		subjects: ["Mathematics"],
		topicTags: ["circles", "tangent", "chord", "point of contact", "radius", "external point", "secant"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "essential",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Draw the radius to the point of contact and mark the 90° angle between radius and tangent.",
				"Every named point in the stem (P, Q, O, T, …) must appear with the same label in the figure.",
			],
		},
	}),
	template({
		id: "math-circle-sector-segment-grade-10",
		title: "Circle sector or segment (Grade 10)",
		description: "Circle with a sector or segment highlighted and the central angle labelled.",
		subjects: ["Mathematics"],
		topicTags: ["areas related to circles", "sector", "segment", "central angle", "minor", "major", "arc"],
		gradeBands: ["9-10"],
		kind: "math_geometry",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["view", "primitives"],
			optionalSlots: [],
			constraints: [
				"Shade or dash the requested region (sector / minor segment / major segment) without numeric area labels.",
				"Mark the central angle with an arc and its value (e.g. 60°, 90°, 120°).",
			],
		},
	}),
	template({
		id: "math-statistics-ogive-grade-10",
		title: "Statistics ogive (Grade 10)",
		description: "Less-than or more-than ogive built from a grouped frequency distribution.",
		subjects: ["Mathematics", "Statistics"],
		topicTags: ["statistics", "ogive", "cumulative frequency", "less than", "more than", "grouped data", "median"],
		gradeBands: ["9-10"],
		kind: "statistics_chart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "bins", "cumulative", "xLabel", "yLabel"],
			optionalSlots: [],
			constraints: [
				"`subKind` must be `ogive` and `cumulative` must match the question (`less_than` or `more_than`).",
				"Bin upper boundaries (or lower boundaries for more-than) must match the class intervals in the stem.",
			],
		},
	}),

	// Science (9) — biology-content entries deliberately omitted; the
	// existing biology-ecology-flow and biology-pedigree-trait templates
	// at the top of the registry already serve Grade 10 ecology and
	// inheritance stems, so no Grade 10-specific biology template is added.

	template({
		id: "science-chemical-reaction-types-grade-10",
		title: "Chemical reaction with type (Grade 10)",
		description: "Balanced chemical equation with state symbols and (optional) conditions, illustrating combination, decomposition, displacement, or double displacement.",
		subjects: ["Science", "Chemistry"],
		topicTags: ["chemical reactions and equations", "combination reaction", "decomposition reaction", "displacement reaction", "double displacement", "state symbols", "balanced equation"],
		gradeBands: ["9-10"],
		kind: "chemistry_reaction",
		priority: "essential",
		slotContract: {
			requiredSlots: ["ce"],
			optionalSlots: ["label"],
			constraints: [
				"Use mhchem syntax with explicit state symbols (s), (l), (g), (aq).",
				"Equation must be balanced for both atoms and charge.",
				"Do not state the reaction type in the label if the question asks students to identify it.",
			],
		},
	}),
	template({
		id: "science-ph-scale-grade-10",
		title: "pH scale table (Grade 10)",
		description: "Reference table mapping pH values to common substances and acid/base/neutral classification.",
		subjects: ["Science", "Chemistry"],
		topicTags: ["acids bases and salts", "ph scale", "indicator", "acidic", "basic", "neutral", "hydrogen ion concentration"],
		gradeBands: ["9-10"],
		kind: "data_table",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["headers", "rows"],
			optionalSlots: ["caption"],
			constraints: [
				"Headers should include at least 'Substance' and 'pH'; rows should span both acidic (pH < 7) and basic (pH > 7) regions.",
				"Do not pre-classify the asked-about substance as acidic / basic / neutral.",
			],
		},
	}),
	template({
		id: "science-reactivity-series-grade-10",
		title: "Reactivity series table (Grade 10)",
		description: "Reactivity-series comparison table ordering common metals from most to least reactive.",
		subjects: ["Science", "Chemistry"],
		topicTags: ["metals and non-metals", "reactivity series", "displacement", "thermite", "potassium", "sodium", "iron", "copper", "gold"],
		gradeBands: ["9-10"],
		kind: "data_table",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["headers", "rows"],
			optionalSlots: ["caption"],
			constraints: [
				"Order rows from most reactive (top) to least reactive (bottom) unless the question asks for the reverse.",
				"Do not include the metal being asked about as boldface unless the answer is independent of position.",
			],
		},
	}),
	template({
		id: "science-carbon-functional-groups-grade-10",
		title: "Carbon compound structure (Grade 10)",
		description: "Structural formula of a Grade 10 carbon compound: alcohol, aldehyde, ketone, carboxylic acid, alkane, alkene, alkyne, or haloalkane.",
		subjects: ["Science", "Chemistry"],
		topicTags: ["carbon and its compounds", "functional group", "homologous series", "alcohol", "aldehyde", "carboxylic acid", "ketone", "alkane", "alkene", "structural isomer"],
		gradeBands: ["9-10"],
		kind: "chemistry_molecule",
		priority: "essential",
		slotContract: {
			requiredSlots: ["smiles"],
			optionalSlots: ["label", "display"],
			constraints: [
				"Use valid SMILES; molecule must be a 1-6 carbon compound from the Grade 10 syllabus.",
				"Do not name the functional group in the label when the question asks students to identify it.",
			],
		},
	}),
	template({
		id: "science-light-mirror-ray-grade-10",
		title: "Spherical mirror ray diagram (Grade 10)",
		description: "Concave or convex mirror ray diagram showing object, image, focal point, and centre of curvature.",
		subjects: ["Science", "Physics"],
		topicTags: ["light reflection and refraction", "spherical mirror", "concave mirror", "convex mirror", "focal length", "centre of curvature", "principal axis", "real image", "virtual image"],
		gradeBands: ["9-10"],
		kind: "physics_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "axisMin", "axisMax", "objects", "lenses"],
			optionalSlots: ["axisUnit", "drawRays"],
			constraints: [
				"`subKind` must be `ray_optics` and `lenses[].type` must be `concave_mirror` or `convex_mirror`.",
				"Object distance, focal length, and image position must satisfy the mirror formula 1/v + 1/u = 1/f using the sign convention.",
			],
		},
	}),
	template({
		id: "science-light-lens-ray-grade-10",
		title: "Lens ray diagram (Grade 10)",
		description: "Concave or convex lens ray diagram showing object, image, focal points, and the principal axis.",
		subjects: ["Science", "Physics"],
		topicTags: ["light refraction", "lens", "convex lens", "concave lens", "focal length", "principal axis", "magnification", "image formation"],
		gradeBands: ["9-10"],
		kind: "physics_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "axisMin", "axisMax", "objects", "lenses"],
			optionalSlots: ["axisUnit", "drawRays"],
			constraints: [
				"`subKind` must be `ray_optics` and `lenses[].type` must be `convex_lens` or `concave_lens`.",
				"Object and image positions must satisfy 1/v - 1/u = 1/f under the lens sign convention.",
			],
		},
	}),
	template({
		id: "science-human-eye-defects-grade-10",
		title: "Human eye defect and correction (Grade 10)",
		description: "Eye-defect ray diagram (myopia / hypermetropia / presbyopia) and the corrective lens that fixes it.",
		subjects: ["Science", "Physics"],
		topicTags: ["human eye", "defects of vision", "myopia", "hypermetropia", "presbyopia", "near point", "far point", "corrective lens"],
		gradeBands: ["9-10"],
		kind: "physics_diagram",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["subKind", "axisMin", "axisMax", "objects", "lenses"],
			optionalSlots: ["axisUnit", "drawRays"],
			constraints: [
				"`subKind` must be `ray_optics`; show the corrective lens type that matches the defect.",
				"Do not label the defect name when the question asks for identification.",
			],
		},
	}),
	template({
		id: "science-circuit-series-parallel-grade-10",
		title: "Series / parallel circuit (Grade 10)",
		description: "Battery with resistors in series or parallel, optional ammeter / voltmeter / bulb / switch.",
		subjects: ["Science", "Physics"],
		topicTags: ["electricity", "ohm's law", "series resistor", "parallel resistor", "ammeter", "voltmeter", "potential difference", "current"],
		gradeBands: ["9-10"],
		kind: "physics_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind", "nodes", "components"],
			optionalSlots: [],
			constraints: [
				"`subKind` must be `circuit`.",
				"Ammeter must be in series with the component whose current is measured; voltmeter must be in parallel.",
				"Resistor values, emf, and any visible meter reading must match the answer.",
			],
		},
	}),
	template({
		id: "science-magnetic-field-conductor-grade-10",
		title: "Magnetic field around conductor (Grade 10)",
		description: "Magnetic field lines around a current-carrying straight conductor, circular loop, or solenoid.",
		subjects: ["Science", "Physics"],
		topicTags: ["magnetic effects of electric current", "magnetic field lines", "current carrying conductor", "solenoid", "right hand rule", "north pole", "south pole"],
		gradeBands: ["9-10"],
		kind: "physics_field_diagram",
		priority: "essential",
		slotContract: {
			requiredSlots: ["fieldType", "title", "sources", "fieldLineCount"],
			optionalSlots: ["labels"],
			constraints: [
				"`fieldType` must be `magnetic`.",
				"Field-line arrows must match the right-hand rule for the current direction shown.",
			],
		},
		fallbackKind: "physics_diagram",
	}),

	// Geography (5)

	template({
		id: "geography-india-resources-grade-10",
		title: "India resources / soils map (Grade 10)",
		description: "India political-or-thematic map highlighting soil-type or resource-distribution regions.",
		subjects: ["Geography", "Social Science"],
		topicTags: ["resources and development", "soil", "alluvial", "black soil", "red and yellow soil", "laterite", "land use", "resource distribution"],
		gradeBands: ["9-10"],
		kind: "india_map",
		priority: "essential",
		slotContract: {
			requiredSlots: ["mapStyle", "highlightedStates"],
			optionalSlots: [],
			constraints: [
				"`highlightedStates` ids must come from the india-map state code list (e.g. `mh`, `gj`, `rj`).",
				"Do not write the answer (soil type / resource name) into the alt text.",
			],
		},
		fallbackKind: "map_visual",
	}),
	template({
		id: "geography-india-water-grade-10",
		title: "India water resources map (Grade 10)",
		description: "India map highlighting multi-purpose river-project regions or major river basins.",
		subjects: ["Geography", "Social Science"],
		topicTags: ["water resources", "multi purpose river project", "bhakra nangal", "sardar sarovar", "tehri", "river basin", "hirakud", "narmada", "rainwater harvesting"],
		gradeBands: ["9-10"],
		kind: "india_map",
		priority: "essential",
		slotContract: {
			requiredSlots: ["mapStyle", "highlightedStates"],
			optionalSlots: [],
			constraints: [
				"Highlight only the states the project / river basin spans.",
				"Do not place the project's name in the alt text when the question asks students to identify it.",
			],
		},
		fallbackKind: "map_visual",
	}),
	template({
		id: "geography-india-minerals-grade-10",
		title: "India minerals / energy map (Grade 10)",
		description: "India map highlighting iron / coal / bauxite / oilfield / nuclear-power locations.",
		subjects: ["Geography", "Social Science"],
		topicTags: ["minerals and energy resources", "iron ore", "coal", "bauxite", "manganese", "petroleum", "nuclear power", "thermal power", "ferrous minerals"],
		gradeBands: ["9-10"],
		kind: "india_map",
		priority: "essential",
		slotContract: {
			requiredSlots: ["mapStyle", "highlightedStates"],
			optionalSlots: [],
			constraints: [
				"Highlight the producing states only; non-producing states stay default.",
				"Do not name the mineral / energy source in the alt text when identification is being assessed.",
			],
		},
		fallbackKind: "map_visual",
	}),
	template({
		id: "geography-india-industries-grade-10",
		title: "India manufacturing industries map (Grade 10)",
		description: "India map highlighting iron-steel, cotton-textile, sugar, IT, or petrochemical industrial regions.",
		subjects: ["Geography", "Social Science"],
		topicTags: ["manufacturing industries", "iron steel", "cotton textile", "sugar industry", "petrochemical", "information technology", "industrial region", "agro based"],
		gradeBands: ["9-10"],
		kind: "india_map",
		priority: "essential",
		slotContract: {
			requiredSlots: ["mapStyle", "highlightedStates"],
			optionalSlots: [],
			constraints: [
				"Highlighted states must be the principal producing region for the industry referenced.",
				"Alt text describes geography only — no industrial output figures unless given by the stem.",
			],
		},
		fallbackKind: "map_visual",
	}),
	template({
		id: "geography-india-lifelines-grade-10",
		title: "India lifelines (transport) map (Grade 10)",
		description: "India map highlighting golden quadrilateral, major railway zones, major sea ports, or international airports.",
		subjects: ["Geography", "Social Science"],
		topicTags: ["lifelines of national economy", "transport", "roadways", "railways", "pipelines", "waterways", "airways", "golden quadrilateral", "sea ports"],
		gradeBands: ["9-10"],
		kind: "india_map",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["mapStyle", "highlightedStates"],
			optionalSlots: [],
			constraints: [
				"Highlight only states the corridor / port serves.",
				"Do not write the corridor / port name in alt text when identification is being assessed.",
			],
		},
		fallbackKind: "map_visual",
	}),

	// History (3)

	template({
		id: "history-nationalism-europe-timeline-grade-10",
		title: "Rise of nationalism in Europe timeline (Grade 10)",
		description: "Chronological events 1789–1871: French Revolution, Congress of Vienna, 1830 & 1848 revolutions, unification of Germany and Italy.",
		subjects: ["History", "Social Science"],
		topicTags: ["rise of nationalism in europe", "french revolution", "congress of vienna", "1848 revolution", "unification of germany", "unification of italy", "mazzini", "bismarck", "cavour"],
		gradeBands: ["9-10"],
		kind: "timeline",
		priority: "essential",
		slotContract: {
			requiredSlots: ["title", "events"],
			optionalSlots: ["axisLabel"],
			constraints: [
				"Events must be in chronological order (1789 → 1871) unless the question asks students to reorder them.",
				"`dateLabel` should be the four-digit year and `label` the event name.",
			],
		},
	}),
	template({
		id: "history-nationalism-india-timeline-grade-10",
		title: "Nationalism in India timeline (Grade 10)",
		description: "Chronological events 1915–1947: Champaran, Rowlatt Act, Non-Cooperation, Civil Disobedience, Quit India.",
		subjects: ["History", "Social Science"],
		topicTags: ["nationalism in india", "khilafat", "non cooperation movement", "rowlatt act", "jallianwala bagh", "civil disobedience", "salt march", "dandi", "quit india", "champaran"],
		gradeBands: ["9-10"],
		kind: "timeline",
		priority: "essential",
		slotContract: {
			requiredSlots: ["title", "events"],
			optionalSlots: ["axisLabel"],
			constraints: [
				"Events must follow Gandhi-led movement chronology (1915 onwards) unless the question asks for reorder.",
				"Use the four-digit year as `dateLabel`.",
			],
		},
	}),
	template({
		id: "history-print-culture-source-grade-10",
		title: "Print culture source extract (Grade 10)",
		description: "Primary-source extract (Gutenberg, Luther, vernacular press, Raja Rammohan Roy) for source-based comprehension.",
		subjects: ["History", "Social Science"],
		topicTags: ["print culture and the modern world", "gutenberg", "printing press", "vernacular press", "luther", "reformation", "censorship", "newspapers"],
		gradeBands: ["9-10"],
		kind: "source_extract",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["lines"],
			optionalSlots: ["title", "source", "context"],
			constraints: [
				"Lines must be numbered starting at 1.",
				"Do not summarize the source's argument in `context` — students must infer it from the text.",
			],
		},
		fallbackKind: "english_passage",
	}),

	// Civics (3)

	template({
		id: "civics-federalism-structure-grade-10",
		title: "Indian federalism structure (Grade 10)",
		description: "Three-tier flowchart of Union / State / Local government with the subject lists each tier legislates on.",
		subjects: ["Civics", "Social Science"],
		topicTags: ["federalism", "union government", "state government", "local government", "union list", "state list", "concurrent list", "panchayat", "municipality", "decentralisation"],
		gradeBands: ["9-10"],
		kind: "flowchart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["title", "nodes", "edges"],
			optionalSlots: [],
			constraints: [
				"Top-level node must be the Union; child nodes are State and then Local (Panchayat / Municipality).",
				"Edge labels may name the legislative list ('Union list', 'State list', 'Concurrent list') only when the question is not about identifying the list.",
			],
		},
	}),
	template({
		id: "civics-power-sharing-grade-10",
		title: "Power-sharing models flowchart (Grade 10)",
		description: "Side-by-side flowchart comparing the Belgian accommodation model and the Sri Lankan majoritarian model.",
		subjects: ["Civics", "Social Science"],
		topicTags: ["power sharing", "belgium", "sri lanka", "majoritarianism", "accommodation", "ethnic conflict", "linguistic groups", "tamil", "sinhala"],
		gradeBands: ["9-10"],
		kind: "flowchart",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["title", "nodes", "edges"],
			optionalSlots: [],
			constraints: [
				"Two parallel branches — one for Belgium, one for Sri Lanka.",
				"Outcome nodes ('stability' / 'civil war') should not be pre-labelled if the question is about consequence-comparison.",
			],
		},
	}),
	template({
		id: "civics-political-parties-table-grade-10",
		title: "Political parties comparison table (Grade 10)",
		description: "Table comparing national and state political parties on recognition criteria, symbol, base region, and seat share.",
		subjects: ["Civics", "Social Science"],
		topicTags: ["political parties", "national party", "state party", "recognised", "symbol", "two party", "multi party", "election commission", "regional party"],
		gradeBands: ["9-10"],
		kind: "data_table",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["headers", "rows"],
			optionalSlots: ["caption"],
			constraints: [
				"Headers should include 'Party', 'Type (National/State)', and any other criterion the question references (symbol, seat share).",
				"Do not mark the answer cell bold — the stem must drive identification.",
			],
		},
	}),

	// Economics (3)

	template({
		id: "economics-development-comparison-grade-10",
		title: "Development indicators comparison (Grade 10)",
		description: "Table comparing two or more countries / states on per-capita income, literacy, infant mortality, HDI rank, life expectancy.",
		subjects: ["Economics", "Social Science"],
		topicTags: ["development", "per capita income", "hdi", "human development", "literacy rate", "infant mortality", "life expectancy", "national income", "growth rate"],
		gradeBands: ["9-10"],
		kind: "data_table",
		priority: "essential",
		slotContract: {
			requiredSlots: ["headers", "rows"],
			optionalSlots: ["caption"],
			constraints: [
				"Columns should include at minimum the country/state name and the indicator the question asks about.",
				"Do not pre-rank or pre-classify the entities — the stem must drive interpretation.",
			],
		},
	}),
	template({
		id: "economics-sectors-chart-grade-10",
		title: "Sectors of Indian economy chart (Grade 10)",
		description: "Pie or bar chart of primary / secondary / tertiary share in GDP or employment for India over time.",
		subjects: ["Economics", "Social Science", "Statistics"],
		topicTags: ["sectors of the indian economy", "primary sector", "secondary sector", "tertiary sector", "service sector", "gva", "employment share", "gdp share"],
		gradeBands: ["9-10"],
		kind: "statistics_chart",
		priority: "essential",
		slotContract: {
			requiredSlots: ["subKind"],
			optionalSlots: ["xLabel", "yLabel"],
			constraints: [
				"Use `subKind: pie` for share-at-one-point-in-time, `subKind: bar` for cross-period comparison.",
				"Values must reconcile to ~100 % across the three sectors in a pie.",
			],
		},
	}),
	template({
		id: "economics-money-credit-flow-grade-10",
		title: "Money and credit flowchart (Grade 10)",
		description: "Flowchart of credit sources — formal (banks, cooperatives, RBI) vs. informal (moneylender, trader, friends).",
		subjects: ["Economics", "Social Science"],
		topicTags: ["money and credit", "formal credit", "informal credit", "bank", "moneylender", "cooperative", "self help group", "rbi", "collateral", "interest rate"],
		gradeBands: ["9-10"],
		kind: "flowchart",
		priority: "recommended",
		slotContract: {
			requiredSlots: ["title", "nodes", "edges"],
			optionalSlots: [],
			constraints: [
				"Top node is 'Sources of Credit'; left branch is Formal, right branch is Informal.",
				"Outcome / interest-rate labels should not give away the answer when the question is about comparison.",
			],
		},
		fallbackKind: "data_table",
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
