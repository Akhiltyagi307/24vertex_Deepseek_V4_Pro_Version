/**
 * Few-shot exemplars for the `visual` field. The shared system instructions
 * append a "## Examples" block built from this list so the model has
 * concrete shapes to imitate.
 *
 * Curation rules:
 * - Mix `visual: null` with non-null examples — shows valid JSON for sparse stems.
 *   **Note:** the live system prompt now tells the model to **maximize** non-null
 *   visuals; null rows here are for schema contrast, not a frequency target.
 * - Keep stems short and self-contained; the visual is load-bearing OR the
 *   stem stands alone. Avoid pasting duplicate numerics both in prose and caption
 *   unless the stem instructs reading from the figure (then numbers in **spec must match).
 * - Cover visual kinds shipped for Phase 2. Selection uses stratified sampling
 *   by `spec.kind` (and subKind / finer stratification keys) in `pickExemplarsForSubject`.
 * - **Caption**: one line, stimulus title + the minimum read-off or structure cue (what to look at).
 * - **Alt text**: exhaustive enough for blindness *and* for the model — name axes, landmarks,
 *   tick endpoints, shaded/open/closed conventions, arrow directions, units implied by axis labels,
 *   and multi-curve legends by colour role if more than one series.
 * - **`topicKeywords`**: prefer 3–8 lowercase substring phrases aligned with syllabus/chapter blobs
 *   (helps `pickExemplarsForSubject` surface relevant few-shots). Add to every exemplar where practical.
 * - Do not reference renderer features we do not implement (extra circuit elements, decorative Ray drawn,
 *   3-D perspective on `physics_diagram`, etc.).
 * - Include NCERT/CBSE-typical stems plus international-exam-shaped stimuli (AP,
 *   IB, SAT-style graphs, circuits, molecules) where they fit the same schema.
 */

import type { QuestionVisualEnvelope } from "./schemas";

export type VisualExemplar = {
	stem: string;
	visual: QuestionVisualEnvelope | null;
	/**
	 * Optional lowercase phrases matched as substrings against server-built topic/chapter hint text
	 * to prioritize this exemplar when it aligns with selected practice topics (see `pickExemplarsForSubject`).
	 */
	topicKeywords?: ReadonlyArray<string>;
	subjects: ReadonlyArray<
		| "mathematics"
		| "physics"
		| "chemistry"
		| "biology"
		| "accountancy"
		| "economics_statistics"
		| "business_studies"
		| "geography"
		| "social_science"
		| "science"
		| "english"
	>;
};

const BASE_VISUAL_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	// ───────────────────────────────────────────────────────────────────────
	// MATHEMATICS
	// ───────────────────────────────────────────────────────────────────────
	// Geometry-heavy kinds from routing: `math_geometry` (points, segments,
	// polygons, vectors, angle_marker, circle, arc), `number_line`, plus graphs/tables.
	{
		stem: "Solve for x: $2x + 5 = 17$.",
		topicKeywords: ["linear equation", "algebra", "equation"],
		visual: null,
		subjects: ["mathematics"],
	},
	{
		stem: "Find the slope of segment AB shown below.",
		topicKeywords: ["coordinate geometry", "slope", "line", "segment"],
		visual: {
			caption: "Segment AB from (1,2) through (4,8) — constant slope $\\Delta y / \\Delta x = 7/3$.",
			altText:
				"Axes with light grid visible; plotted points A dot (1,2) southwest and B dot (4,8) northeast; stiff segment chord drawn between labelled markers.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 6, yMin: 0, yMax: 10, showGrid: true, showAxes: true },
				primitives: [
					{ type: "point", at: { x: 1, y: 2 }, label: "A" },
					{ type: "point", at: { x: 4, y: 8 }, label: "B" },
					{ type: "segment", from: { x: 1, y: 2 }, to: { x: 4, y: 8 }, label: null, dashed: false },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "For the graph of $y = x^2 - 4$ shown, state the y-coordinate of the vertex.",
		topicKeywords: ["quadratic", "parabola", "function", "graph", "vertex"],
		visual: {
			caption: "Parabola $y=x^2-4$, window $\\pm4$: vertex at basin (0,-4).",
			altText:
				"Smooth U-shaped curve on grid; trough visually at x equals zero dipping to y minus four crossing y-axis labeled; symmetrical arms rise toward window edges crossing x-axis schematically.",
			spec: {
				kind: "math_function_plot",
				xMin: -4,
				xMax: 4,
				yMin: -6,
				yMax: 8,
				xLabel: "x",
				yLabel: "y",
				items: [{ expr: "x^2 - 4", color: "primary", label: null }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Which inequality matches the interval highlighted on the number line below?",
		topicKeywords: ["inequality", "interval", "number line"],
		visual: {
			caption: "Half-open ray on [2,6): filled endpoint 2, open endpoint 6.",
			altText:
				"Integer ticks 0 through 6; thick segment shaded from inclusive 2 toward 6 terminating with open circle ring at upper bound signalling strict inequality.",
			spec: {
				kind: "number_line",
				min: 0,
				max: 6,
				tickStep: 1,
				points: [{ value: 2, label: "2", openCircle: false }],
				intervals: [{ from: 2, to: 6, leftOpen: false, rightOpen: true, label: null }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In the circle below, O is the centre of radius 5 cm and OC is perpendicular to chord AB. Find the length of AB.",
		topicKeywords: ["circle", "chord", "geometry", "perpendicular"],
		visual: {
			caption: "Circle with centre O, chord AB, and perpendicular OC.",
			altText:
				"Circle centred at origin with radius 5; horizontal chord AB below the centre; segment OC perpendicular to AB at its midpoint C.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -7, xMax: 7, yMin: -7, yMax: 7, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 0, y: 0 }, radius: 5, label: null },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: -4, y: -3 }, label: "A" },
					{ type: "point", at: { x: 4, y: -3 }, label: "B" },
					{ type: "point", at: { x: 0, y: -3 }, label: "C" },
					{ type: "segment", from: { x: -4, y: -3 }, to: { x: 4, y: -3 }, label: null, dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 0, y: -3 }, label: null, dashed: false },
					{ type: "angle_marker", vertex: { x: 0, y: -3 }, fromRayPoint: { x: 0, y: 0 }, toRayPoint: { x: 4, y: -3 }, label: "90°" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In triangle PQR shown, angle R = 90 degrees, PR = 6 cm, QR = 8 cm. Find PQ.",
		topicKeywords: ["triangle", "pythagoras", "right triangle", "geometry"],
		visual: {
			caption: "Right triangle PQR with the right angle at R.",
			altText:
				"Triangle with vertex P at top left, Q at bottom right, and R at bottom left; right-angle marker at R.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 0, y: 6 }, { x: 8, y: 0 }, { x: 0, y: 0 }], label: null, filled: false },
					{ type: "point", at: { x: 0, y: 6 }, label: "P" },
					{ type: "point", at: { x: 8, y: 0 }, label: "Q" },
					{ type: "point", at: { x: 0, y: 0 }, label: "R" },
					{ type: "angle_marker", vertex: { x: 0, y: 0 }, fromRayPoint: { x: 0, y: 6 }, toRayPoint: { x: 8, y: 0 }, label: "90°" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Displacement vectors OA and AB are shown below. What is the magnitude of the resultant displacement OB?",
		topicKeywords: ["vectors", "displacement", "resultant", "magnitude", "coordinate geometry"],
		visual: {
			caption: "Displacement chain O → A → B on a Cartesian grid (right-angle path).",
			altText:
				"Grid with labelled axes origin O; OA is horizontal from (0,0) to (3,0); AB is vertical from (3,0) to (3,4); arrows show head-to-tail OA then AB.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 5, yMin: -1, yMax: 6, showGrid: true, showAxes: true },
				primitives: [
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: 3, y: 0 }, label: "A" },
					{ type: "point", at: { x: 3, y: 4 }, label: "B" },
					{ type: "vector", from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, label: "OA" },
					{ type: "vector", from: { x: 3, y: 0 }, to: { x: 3, y: 4 }, label: "AB" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In parallelogram $ABCD$ shown, which pair of opposite sides are parallel?",
		topicKeywords: ["parallelogram", "opposite sides", "parallel", "quadrilateral", "geometry"],
		visual: {
			caption: "Convex parallelogram ABCD traced counter-clockwise (AB ∥ DC, AD ∥ BC).",
			altText:
				"Slightly slanted convex quadrilateral; vertices A→B→C→D clockwise on the perimeter; opposite sides visibly parallel pairs.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 5 }, { x: 2, y: 5 }], label: null, filled: false },
					{ type: "point", at: { x: 1, y: 1 }, label: "A" },
					{ type: "point", at: { x: 7, y: 1 }, label: "B" },
					{ type: "point", at: { x: 8, y: 5 }, label: "C" },
					{ type: "point", at: { x: 2, y: 5 }, label: "D" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Rectangle $PQRS$ lies on the grid as shown. What is the length of diagonal $PR$?",
		topicKeywords: ["rectangle", "diagonal", "pythagoras", "coordinate geometry"],
		visual: {
			caption: "Axis-aligned rectangle PQRS — 6 × 3 on the grid — diagonal PR dashed.",
			altText:
				"Unit-gridded figure; P bottom-left at (2,2), Q (8,2), R (8,5), S (2,5); dashed diagonal PR crosses the rectangle interior.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 7, showGrid: true, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 5 }, { x: 2, y: 5 }], label: null, filled: false },
					{ type: "point", at: { x: 2, y: 2 }, label: "P" },
					{ type: "point", at: { x: 8, y: 2 }, label: "Q" },
					{ type: "point", at: { x: 8, y: 5 }, label: "R" },
					{ type: "point", at: { x: 2, y: 5 }, label: "S" },
					{ type: "segment", from: { x: 2, y: 2 }, to: { x: 8, y: 5 }, label: null, dashed: true },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Trapezium $ABCD$ has $AB \\parallel CD$ as shown. What is the length of the shorter parallel side?",
		topicKeywords: ["trapezium", "trapezoid", "parallel sides", "quadrilateral"],
		visual: {
			caption: "Trapezium with longer base AB below and shorter base CD parallel above.",
			altText:
				"Labeled A,B on the bottom edge (full width 8), C,D on the top edge spanning 4 units centred above; non-parallel legs AD and BC slant inward.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 7, showGrid: false, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 6, y: 4 }, { x: 2, y: 4 }], label: null, filled: false },
					{ type: "point", at: { x: 0, y: 0 }, label: "A" },
					{ type: "point", at: { x: 8, y: 0 }, label: "B" },
					{ type: "point", at: { x: 6, y: 4 }, label: "C" },
					{ type: "point", at: { x: 2, y: 4 }, label: "D" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In $\\triangle ABC$, points $M$ and $N$ are midpoints of $AB$ and $AC$ as marked. What can you say about segment $MN$ relative to side $BC$?",
		topicKeywords: ["triangle", "midpoint", "mid segment", "proportion", "similarity"],
		visual: {
			caption: "△ABC (∠B and ∠C on base BC) — M, N midpoint markers on AB, AC.",
			altText:
				"A at apex ~ (0,9), BC on x-axis length 12; M bisects AB and N bisects AC visually; chord MN parallels BC and half its schematic length.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -2, xMax: 14, yMin: -2, yMax: 11, showGrid: false, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 0, y: 9 }, { x: 0, y: 0 }, { x: 12, y: 0 }], label: null, filled: false },
					{ type: "point", at: { x: 0, y: 9 }, label: "A" },
					{ type: "point", at: { x: 0, y: 0 }, label: "B" },
					{ type: "point", at: { x: 12, y: 0 }, label: "C" },
					{ type: "point", at: { x: 0, y: 4.5 }, label: "M" },
					{ type: "point", at: { x: 6, y: 4.5 }, label: "N" },
					{ type: "segment", from: { x: 0, y: 4.5 }, to: { x: 6, y: 4.5 }, label: null, dashed: false },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Lines $\\ell_1$ and $\\ell_2$ are parallel and cut by transversal $t$ as shown. Angles $\\alpha$ and $\\beta$ occupy matching corners at each intersection. What is the relationship between $\\alpha$ and $\\beta$?",
		topicKeywords: ["parallel lines", "transversal", "corresponding angles", "geometry"],
		visual: {
			caption: "Parallel ℓ₁, ℓ₂ with transversal — corresponding angles marked α (upper left) and β (lower left of same side).",
			altText:
				"Two horizontal parallels stacked; vertical-ish transversal cuts both forming four angles each; arcs mark α northeast of intersection on upper line and β same relative corner on lower intersection.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -9, xMax: 9, yMin: -8, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "segment", from: { x: -7, y: 4 }, to: { x: 7, y: 4 }, label: null, dashed: false },
					{ type: "segment", from: { x: -7, y: -4 }, to: { x: 7, y: -4 }, label: null, dashed: false },
					{ type: "segment", from: { x: 0, y: -7 }, to: { x: 0, y: 7 }, label: null, dashed: false },
					{ type: "angle_marker", vertex: { x: 0, y: 4 }, fromRayPoint: { x: 7, y: 4 }, toRayPoint: { x: 0, y: 7 }, label: "α" },
					{ type: "angle_marker", vertex: { x: 0, y: -4 }, fromRayPoint: { x: 7, y: -4 }, toRayPoint: { x: 0, y: -7 }, label: "β" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "$\\overline{AB}$ is horizontal with midpoint $M$. Equal-radius compass arcs centred at $A$ and $B$ meet above $AB$, and the dashed vertical through their crossing passes through $M$. What role does this dashed vertical play for segment $AB$?",
		topicKeywords: ["construction", "perpendicular bisector", "ruler compass", "geometry"],
		visual: {
			caption: "Classic perpendicular-bisector construction on segment AB.",
			altText:
				"Horizontal chord AB midpoint M labelled; symmetrical dashed arcs (same compass radius from A and B) meet above midpoint; dashed vertical rises through arc crossing and bisects AB at ninety degrees schematically.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 13, yMin: -1, yMax: 10, showGrid: false, showAxes: false },
				primitives: [
					{ type: "segment", from: { x: 2, y: 3 }, to: { x: 10, y: 3 }, label: null, dashed: false },
					{ type: "point", at: { x: 2, y: 3 }, label: "A" },
					{ type: "point", at: { x: 10, y: 3 }, label: "B" },
					{ type: "point", at: { x: 6, y: 3 }, label: "M" },
					{
						type: "arc",
						center: { x: 2, y: 3 },
						radius: 5,
						startAngleDeg: 25,
						endAngleDeg: 75,
						minorArc: true,
						dashed: true,
						label: null,
					},
					{
						type: "arc",
						center: { x: 10, y: 3 },
						radius: 5,
						startAngleDeg: 105,
						endAngleDeg: 155,
						minorArc: true,
						dashed: true,
						label: null,
					},
					{ type: "segment", from: { x: 6, y: 1 }, to: { x: 6, y: 9 }, label: null, dashed: true },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "The two right triangles shown are similar with a scale factor of $2$ from the smaller to the larger (matching vertices aligned). What is the ratio of corresponding legs?",
		topicKeywords: ["similarity", "right triangle", "scale factor", "corresponding sides"],
		visual: {
			caption: "Two similar RTs sharing orientation — legs 3,4 versus 6,8 on the grid.",
			altText:
				"Left triangle right angle at Southwest corner spanning 3 by 4; right triangle same orientation scaled to 6 by 8; both right-angle wedges marked at matching acute layout.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 16, yMin: -1, yMax: 12, showGrid: true, showAxes: false },
				primitives: [
					{ type: "polygon", vertices: [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 6 }], label: null, filled: false },
					{ type: "angle_marker", vertex: { x: 2, y: 2 }, fromRayPoint: { x: 5, y: 2 }, toRayPoint: { x: 2, y: 6 }, label: "90°" },
					{ type: "point", at: { x: 2, y: 6 }, label: "D" },
					{ type: "polygon", vertices: [{ x: 8, y: 2 }, { x: 14, y: 2 }, { x: 8, y: 10 }], label: null, filled: false },
					{ type: "angle_marker", vertex: { x: 8, y: 2 }, fromRayPoint: { x: 14, y: 2 }, toRayPoint: { x: 8, y: 10 }, label: "90°" },
					{ type: "point", at: { x: 8, y: 10 }, label: "G" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Quadrilateral $ABCD$ is inscribed in the circle shown with centre $O$. What relationship holds between opposite angles of $ABCD$?",
		topicKeywords: ["cyclic quadrilateral", "circle", "circumcircle", "opposite angles", "geometry"],
		visual: {
			caption: "Cyclic kite-like ordering A→B→C→D equally spaced cardinal points.",
			altText:
				"Unit circle centre O; A top, B right, C bottom, D left cardinal points chained by chords; convex quadrilateral interior visible.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -7, xMax: 7, yMin: -7, yMax: 7, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 0, y: 0 }, radius: 5, label: null },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "polygon", vertices: [{ x: 0, y: 5 }, { x: 5, y: 0 }, { x: 0, y: -5 }, { x: -5, y: 0 }], label: null, filled: false },
					{ type: "point", at: { x: 0, y: 5 }, label: "A" },
					{ type: "point", at: { x: 5, y: 0 }, label: "B" },
					{ type: "point", at: { x: 0, y: -5 }, label: "C" },
					{ type: "point", at: { x: -5, y: 0 }, label: "D" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In the diagram, $O$ is the centre of the circle and radii $OA$ and $OB$ are drawn. The highlighted arc from $A$ to $B$ is the **major** arc. What is the reflex angle $\\angle AOB$ at the centre?",
		topicKeywords: ["circle", "major arc", "reflex angle", "central angle", "circumference"],
		visual: {
			caption: "Radii OA and OB with traced major arc (long path A→B clockwise).",
			altText:
				"A on positive x-axis, B elevated ~120° counter-clockwise along rim; thickened arc skips the shorter minor span and sweeps remainder of circumference to show major arc from A toward B.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -7, xMax: 7, yMin: -7, yMax: 7, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 0, y: 0 }, radius: 5, label: null },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: 5, y: 0 }, label: "A" },
					{ type: "point", at: { x: -2.5, y: 4.3 }, label: "B" },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, label: null, dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: -2.5, y: 4.3 }, label: null, dashed: false },
					{
						type: "arc",
						center: { x: 0, y: 0 },
						radius: 5,
						startAngleDeg: 0,
						endAngleDeg: 120,
						minorArc: false,
						dashed: false,
						label: null,
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "The shaded triangular region is bounded by the axes and the line through $(6,0)$ and $(0,4)$ as shown. State the lengths of the intercepts on the axes.",
		topicKeywords: ["coordinate geometry", "intercepts", "linear equation", "triangle", "axes"],
		visual: {
			caption: "Right Δ in Q1 bounded by axes and line connecting (6,0) ↔ (0,4).",
			altText:
				"Lightly filled right triangle anchored at origin; x-leg six units ending on positive x-axis; y-leg four units ending on positive y-axis; hypotenuse straight between those intercept ticks.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 8, yMin: -1, yMax: 6, showGrid: true, showAxes: true },
				primitives: [
					{ type: "polygon", vertices: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }], label: null, filled: true },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: 6, y: 0 }, label: null },
					{ type: "point", at: { x: 0, y: 4 }, label: null },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Using only the census snapshot table, which district has the highest population density?",
		topicKeywords: ["statistics", "population density", "data handling", "census"],
		visual: {
			caption: "Wide snapshot table — read Density column (people per km²) only for ranking.",
			altText:
				"Four district rows labelled Alpha Beta Gamma Delta; columns include Area km², Pop k splits, percentages, Workers k, Density (502 / 928 / 929 / 380), Zone letter; Density is the discriminative statistic for answering.",
			spec: {
				kind: "data_table",
				caption: "District indicators (sample)",
				headers: ["District", "Area km²", "Pop k", "Male k", "Female k", "Urban %", "Lit %", "Workers k", "Density", "Zone"],
				rows: [
					[
						{ value: "Alpha", bold: false, align: "left" },
						{ value: "820", bold: false, align: "right" },
						{ value: "412", bold: false, align: "right" },
						{ value: "210", bold: false, align: "right" },
						{ value: "202", bold: false, align: "right" },
						{ value: "62", bold: false, align: "right" },
						{ value: "84", bold: false, align: "right" },
						{ value: "158", bold: false, align: "right" },
						{ value: "502", bold: false, align: "right" },
						{ value: "N", bold: false, align: "center" },
					],
					[
						{ value: "Beta", bold: false, align: "left" },
						{ value: "540", bold: false, align: "right" },
						{ value: "501", bold: false, align: "right" },
						{ value: "251", bold: false, align: "right" },
						{ value: "250", bold: false, align: "right" },
						{ value: "71", bold: false, align: "right" },
						{ value: "88", bold: false, align: "right" },
						{ value: "190", bold: false, align: "right" },
						{ value: "928", bold: false, align: "right" },
						{ value: "N", bold: false, align: "center" },
					],
					[
						{ value: "Gamma", bold: false, align: "left" },
						{ value: "310", bold: false, align: "right" },
						{ value: "288", bold: false, align: "right" },
						{ value: "142", bold: false, align: "right" },
						{ value: "146", bold: false, align: "right" },
						{ value: "58", bold: false, align: "right" },
						{ value: "79", bold: false, align: "right" },
						{ value: "96", bold: false, align: "right" },
						{ value: "929", bold: false, align: "right" },
						{ value: "S", bold: false, align: "center" },
					],
					[
						{ value: "Delta", bold: false, align: "left" },
						{ value: "960", bold: false, align: "right" },
						{ value: "365", bold: false, align: "right" },
						{ value: "183", bold: false, align: "right" },
						{ value: "182", bold: false, align: "right" },
						{ value: "44", bold: false, align: "right" },
						{ value: "76", bold: false, align: "right" },
						{ value: "121", bold: false, align: "right" },
						{ value: "380", bold: false, align: "right" },
						{ value: "E", bold: false, align: "center" },
					],
				],
			},
		},
		subjects: ["mathematics", "social_science"],
	},
	{
		stem: "The graphs of $y = \\frac{x^2}{8}$, $y = 2x + 1$, and $y = 9 - x$ are shown on the same axes for $x \\geq 0$. How many intersection points lie strictly between $x = 2$ and $x = 6$?",
		topicKeywords: ["graph intersection", "quadratic", "linear", "coordinate geometry"],
		visual: {
			caption: "Triple overlay for x∈[0,8]: parabola, rising line, falling line — count crossings with 2<x<6.",
			altText:
				"Same axes 0≤x≤8≤ y≤14: gentle blue parabola from origin (y=x²/8), green rising line y=2x+1 from y-intercept +1, orange decreasing line y=9−x; student counts intersection points lying strictly between the vertical grid lines x=2 and x=6.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 8,
				yMin: 0,
				yMax: 14,
				xLabel: "x",
				yLabel: "y",
				items: [
					{ expr: "x^2 / 8", color: "primary", label: null },
					{ expr: "2*x + 1", color: "secondary", label: null },
					{ expr: "9 - x", color: "accent", label: null },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Read off the x-values where y = sin x crosses the x-axis in the interval shown.",
		topicKeywords: ["trigonometry", "sine graph", "zeros", "roots", "period"],
		visual: {
			caption: "Sine curve shown over approximately two full periods.",
			altText:
				"sin(x) on window x≈−6.5 to 6.5, y≈±2; amplitude about 1; trace crosses x-axis at multiples of π (x=−2π, −π, 0, π, 2π within view) turning from negative to positive or vice versa.",
			spec: {
				kind: "math_function_plot",
				xMin: -6.5,
				xMax: 6.5,
				yMin: -2,
				yMax: 2,
				xLabel: "x",
				yLabel: "y",
				xTickStep: 1.5708,
				yTickStep: 0.5,
				items: [{ expr: "sin(x)", color: "primary", label: "y = sin x" }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Using the graph of $y = \\ln x$ shown, estimate the $x$-value where $y = 0$.",
		topicKeywords: ["logarithms", "natural logarithm", "ln", "graphs"],
		visual: {
			caption: "Increasing ln curve — root at x=1 where ln1=0.",
			altText:
				"Natural log plotted for x≥0.2; curve rises slowly rightward; crosses y=0 at x≈1 (only x-intercept in window); domain approaches but does not cross x=0 vertically.",
			spec: {
				kind: "math_function_plot",
				xMin: 0.2,
				xMax: 8,
				yMin: -2,
				yMax: 3,
				xLabel: "x",
				yLabel: "y",
				items: [{ expr: "ln(x)", color: "primary", label: "y = ln x" }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Where does the graph of $y = |x - 2|$ change slope on the window shown?",
		topicKeywords: ["absolute value", "piecewise linear", "vertex", "graphs"],
		visual: {
			caption: "V vertex at x=2; slope −1 left and +1 right.",
			altText:
				"V-shaped trace on −1≤x≤5: vertex on x-axis at 2 touching y=0; left ray descends to (−1,3); right ray rises toward (5,3).",
			spec: {
				kind: "math_function_plot",
				xMin: -1,
				xMax: 5,
				yMin: -0.5,
				yMax: 4,
				xLabel: "x",
				yLabel: "y",
				items: [{ expr: "abs(x - 2)", color: "primary", label: null }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Use the graph to find the x-coordinates of the intersection points of $y = x^2$ and $y = 2x + 3$.",
		topicKeywords: ["quadratic", "straight line", "intersection", "simultaneous equations"],
		visual: {
			caption: "Parabola vs line legend on axes — two crossings in-window.",
			altText:
				"−3≤x≤5: upward parabola y=x² and straight line y=2x+3 in distinct palette colours labelled in legend tone; crossings one in x<0 quadrant and one in x>0 (both discernible endpoints).",
			spec: {
				kind: "math_function_plot",
				xMin: -3,
				xMax: 5,
				yMin: -2,
				yMax: 16,
				xLabel: "x",
				yLabel: "y",
				items: [
					{ expr: "x^2", color: "primary", label: "y = x²" },
					{ expr: "2*x + 3", color: "secondary", label: "y = 2x + 3" },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "The graph shows $y = e^{-x}$. State the y-intercept and describe the behaviour of y as x increases.",
		topicKeywords: ["exponential", "decay", "asymptote", "calculus introduction"],
		visual: {
			caption: "Exponential decay through (0,1), asymptotic to y→0.",
			altText:
				"y=e^{−x} on −1≤x≤4, 0≤y≤4; starts near y=e≈2.72 at left edge, passes (0,1), falls monotonically toward x-axis without reaching it before x=4.",
			spec: {
				kind: "math_function_plot",
				xMin: -1,
				xMax: 4,
				yMin: 0,
				yMax: 4,
				xLabel: "x",
				yLabel: "y",
				items: [{ expr: "exp(-x)", color: "primary", label: "y = e^{-x}" }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "On the number line shown, mark the solution set of $-3 \\leq x < 2$.",
		topicKeywords: ["inequalities", "number line", "interval notation"],
		visual: {
			caption: "Empty scaffold ticks −5…4 awaiting student shading for −3≤x<2.",
			altText:
				"No highlight yet; uniformly spaced integer anchors from negative five upward to four labelled for manual interval sketching practise.",
			spec: {
				kind: "number_line",
				min: -5,
				max: 4,
				tickStep: 1,
				points: [],
				intervals: [],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Which point on the number line below represents $x = \\frac{3}{2}$?",
		topicKeywords: ["fractions", "rational numbers", "number line"],
		visual: {
			caption: "Rational 3/2 as closed dot midway between labelled 1 and 2 — label P.",
			altText:
				"Tight window zero-three with unit ticks enumerated; midpoint tick between successive integers hosts solid disc lettering P signalling three halves location.",
			spec: {
				kind: "number_line",
				min: 0,
				max: 3,
				tickStep: 1,
				points: [{ value: 1.5, label: "P", openCircle: false }],
				intervals: [],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Which integer values of $x$ lie in **either** interval highlighted on the number line below?",
		topicKeywords: ["compound inequality", "union of intervals", "number line"],
		visual: {
			caption: "Two disjoint arcs: (−3, 1] and [3, 5); sample markers a (−2) solid, b (4) open.",
			altText:
				"Ticks every unit from −4 through 6; solid intervals along (−3, 1] and [3, 5); open circles at −3 and 5; closed dots at 1 and 3; extra labelled points at −2 and 4.",
			spec: {
				kind: "number_line",
				min: -4,
				max: 6,
				tickStep: 1,
				points: [
					{ value: -2, label: "a", openCircle: false },
					{ value: 4, label: "b", openCircle: true },
				],
				intervals: [
					{ from: -3, to: 1, leftOpen: true, rightOpen: false, label: null },
					{ from: 3, to: 5, leftOpen: false, rightOpen: true, label: null },
				],
			},
		},
		subjects: ["mathematics"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// PHYSICS
	// ───────────────────────────────────────────────────────────────────────
	// Allowed kinds for Physics practice (`preferredVisualKindsForSubject`): only
	// `physics_diagram`, `math_function_plot`, and `data_table`. Within
	// `physics_diagram`: free_body (forces + optional incline), ray_optics (lens /
	// mirror + object / image arrows), circuit (battery, R, bulb, switch, meter,
	// wires). Below we maximise topic coverage (mechanics, fluids, buoyancy,
	// centripetal force, projectile paths, EMI/rectifier-shaped curves, Wheatstone /
	// bridge DC layouts, optics, waves/oscillations, thermal, spectroscopy /
	// nuclear data tables) within those renderers.
	{
		stem: "State the SI unit of electric charge and write the relation between charge, current, and time.",
		topicKeywords: ["SI units", "electric charge", "current", "coulomb", "ampere"],
		visual: null,
		subjects: ["physics"],
	},
	{
		stem: "The diagram shows a block on a frictionless 30° incline with weight W = 49 N and normal force N. What is the magnitude of N?",
		topicKeywords: ["inclined plane", "normal force", "weight", "resolution of forces", "free body diagram"],
		visual: {
			caption: "Weight and normal force on a block on a 30-degree incline.",
			altText:
				"Block on a 30-degree slope; weight arrow pointing vertically down labelled W; normal arrow perpendicular to the surface labelled N.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 49, angleDeg: 270 },
					{ name: "N", magnitude: 42.4, angleDeg: 60 },
				],
				inclineDeg: 30,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the free-body diagram shown, a ball of mass 0.5 kg hangs at rest from a string. What is the tension T in the string?",
		topicKeywords: ["equilibrium", "string tension", "hang at rest", "free body diagram"],
		visual: {
			caption: "Ball in equilibrium showing tension T and weight W.",
			altText:
				"Circular body labelled Ball; upward arrow labelled T for tension; downward arrow labelled W for weight.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Ball",
				forces: [
					{ name: "T", magnitude: 4.9, angleDeg: 90 },
					{ name: "W", magnitude: 4.9, angleDeg: 270 },
				],
				inclineDeg: null,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the circuit shown, through which component does conventional current leave the positive terminal of the battery?",
		topicKeywords: ["circuit", "battery polarity", "conventional current", "series loop"],
		visual: {
			caption: "Single-loop circuit with a battery and resistor.",
			altText:
				"Two labelled nodes; a 12 volt battery and a 4 ohm resistor form one closed loop between them.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 1 },
					{ id: "n2", x: 4, y: 1 },
				],
				components: [
					{ type: "battery", from: "n1", to: "n2", emfVolts: 12, label: "12 V" },
					{ type: "resistor", from: "n2", to: "n1", resistanceOhms: 4, label: "R" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "With the switch closed as shown, which symbols does conventional current pass through in series between the battery terminals?",
		topicKeywords: ["series circuit", "switch", "bulb", "current path"],
		visual: {
			caption: "Series circuit with battery, closed switch, and filament bulb.",
			altText:
				"Single rectangular loop: cell, switch shown closed, and bulb symbol connected end-to-end.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 2 },
					{ id: "n2", x: 4, y: 2 },
					{ id: "n3", x: 4, y: 0 },
					{ id: "n4", x: 0, y: 0 },
				],
				components: [
					{ type: "battery", from: "n4", to: "n1", emfVolts: 9, label: "9 V" },
					{ type: "wire", from: "n1", to: "n2" },
					{ type: "switch", from: "n2", to: "n3", closed: true, label: "S" },
					{ type: "bulb", from: "n3", to: "n4", label: "L" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the parallel circuit shown, R₁ = 4 Ω and R₂ = 6 Ω are connected to a 6 V battery. Find the total current drawn from the battery.",
		topicKeywords: ["parallel combination", "ohms law", "equivalent resistance", "circuit"],
		visual: {
			caption: "Parallel circuit with two resistors R₁ and R₂ and a 6 V battery.",
			altText:
				"Battery on the left branch; two horizontal rails connect to two resistors wired in parallel between them.",
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
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the ray diagram below, where is the convex lens located on the principal axis?",
		topicKeywords: ["thin lens", "convex lens", "principal axis", "ray optics"],
		visual: {
			caption: "Object and convex lens on a principal axis.",
			altText:
				"Horizontal axis from negative to positive positions; small object arrow left of centre; convex lens marker at the origin.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -20,
				axisMax: 20,
				objects: [{ kind: "object", x: -10, height: 2, dashed: false }],
				lenses: [{ type: "convex_lens", x: 0, focalLength: 10 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Two identical convex lenses are mounted coaxially on the principal axis shown with one upright object arrow far left of both lenses. As drawn, how many optical components intersect the horizontal principal axis?",
		topicKeywords: ["lens system", "optical bench", "ray optics scaffold"],
		visual: {
			caption: "Two coaxial convex lenses plus principal-axis object arrow.",
			altText:
				"Horizontal principal axis spanning symmetric positions; upright object arrow on the far left; two convex lenses centred at distinct positions along the axis with focal ticks roughly symmetrical either side of each lens.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -28,
				axisMax: 28,
				objects: [{ kind: "object", x: -22, height: 2.5, dashed: false }],
				lenses: [
					{ type: "convex_lens", x: -6, focalLength: 10 },
					{ type: "convex_lens", x: 12, focalLength: 10 },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the ray diagram, an object is placed 15 cm in front of a concave mirror of focal length 10 cm. State whether the image is real or virtual.",
		topicKeywords: ["concave mirror", "mirror formula", "image characteristics", "geometrical optics"],
		visual: {
			caption: "Object placed beyond the focal length of a concave mirror.",
			altText:
				"Horizontal principal axis; upright object arrow at 15 cm from the mirror; concave mirror at the origin with focal length 10 cm marked.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -30,
				axisMax: 5,
				objects: [{ kind: "object", x: -15, height: 2, dashed: false }],
				lenses: [{ type: "concave_mirror", x: 0, focalLength: 10 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "A concave lens of focal length 6 cm forms the image shown. Is the image erect or inverted?",
		topicKeywords: ["concave lens", "diverging lens", "virtual erect image"],
		visual: {
			caption: "Object and virtual image formed by a concave lens.",
			altText:
				"Horizontal principal axis; upright object at 8 cm from the lens on the left; concave lens at origin; smaller upright dashed image on the same side as the object.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -15,
				axisMax: 10,
				objects: [
					{ kind: "object", x: -8, height: 2, dashed: false },
					{ kind: "image", x: -3, height: 1, dashed: true },
				],
				lenses: [{ type: "concave_lens", x: 0, focalLength: 6 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The table gives the resistivity of three materials at 20°C. Which material is the best conductor?",
		topicKeywords: ["resistivity", "conductivity", "current electricity materials"],
		visual: {
			caption: "Resistivity of three common materials at 20°C.",
			altText:
				"Three-row table with columns for material name and resistivity in ohm-metres.",
			spec: {
				kind: "data_table",
				caption: "Resistivity at 20°C",
				headers: ["Material", "Resistivity (Ω·m)"],
				rows: [
					[
						{ value: "Copper", bold: false, align: "left" },
						{ value: "1.7 × 10⁻⁸", bold: false, align: "right" },
					],
					[
						{ value: "Iron", bold: false, align: "left" },
						{ value: "1.0 × 10⁻⁷", bold: false, align: "right" },
					],
					[
						{ value: "Nichrome", bold: false, align: "left" },
						{ value: "1.1 × 10⁻⁶", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics"],
	},
	{
		stem: "The velocity-time graph of a uniformly accelerating object is shown. What is the acceleration?",
		topicKeywords: ["acceleration", "uniform acceleration", "v t graph", "kinematics"],
		visual: {
			caption: "Velocity-time graph for uniform acceleration from rest.",
			altText:
				"Straight line rising from (0, 0) to (5, 10) on a graph with time on the horizontal axis and velocity on the vertical axis.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 6,
				yMin: 0,
				yMax: 12,
				xLabel: "Time (s)",
				yLabel: "Velocity (m/s)",
				items: [{ expr: "2 * x", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The block moves horizontally at constant velocity under the forces shown. What is the magnitude of the kinetic friction force?",
		topicKeywords: ["kinetic friction", "constant velocity equilibrium", "free body diagram"],
		visual: {
			caption: "Free-body diagram on a horizontal surface with applied drag and friction.",
			altText:
				"Rectangle body with weight downward, normal upward, applied force horizontally right, and friction horizontally left; incline not shown.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 40, angleDeg: 270 },
					{ name: "N", magnitude: 40, angleDeg: 90 },
					{ name: "F", magnitude: 12, angleDeg: 0 },
					{ name: "f_k", magnitude: 12, angleDeg: 180 },
				],
				inclineDeg: null,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The block is in equilibrium on the rough incline shown. Which labelled arrow acts parallel to the surface opposing impending slip?",
		topicKeywords: ["static friction", "rough incline", "equilibrium inclined plane"],
		visual: {
			caption: "Weight, normal, and static-friction vectors on a rough inclined plane.",
			altText:
				"Incline drawn beneath the block; weight vertically downward; normal perpendicular to the slope into the block; friction directed upslope.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 80, angleDeg: 270 },
					{ name: "N", magnitude: 72.5, angleDeg: 115 },
					{ name: "f_s", magnitude: 34, angleDeg: 25 },
				],
				inclineDeg: 25,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "During powered ascent the thrust and weight vectors are as shown. Is the magnitude of acceleration nonzero? Explain using net vertical force.",
		topicKeywords: ["thrust vs weight", "newtons laws", "rocket model", "net force"],
		visual: {
			caption: "Vertical thrust greater than weight on a climbing rocket model.",
			altText:
				"Block labelled Rocket with long upward arrow labelled F_thrust and shorter downward arrow labelled W.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Rocket",
				forces: [
					{ name: "W", magnitude: 50000, angleDeg: 270 },
					{ name: "F_thrust", magnitude: 70000, angleDeg: 90 },
				],
				inclineDeg: null,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "An upright object is in front of a convex mirror as shown. Is the image upright or inverted relative to the object?",
		topicKeywords: ["convex mirror", "virtual image", "upright diminished"],
		visual: {
			caption: "Convex mirror with real-space object and smaller virtual image.",
			altText:
				"Principal axis; convex mirror at origin; object arrow left of mirror; smaller dashed upright image arrow on the reflective side.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -22,
				axisMax: 14,
				objects: [
					{ kind: "object", x: -12, height: 2.2, dashed: false },
					{ kind: "image", x: 6, height: 1.2, dashed: true },
				],
				lenses: [{ type: "convex_mirror", x: 0, focalLength: 9 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the thin convex lens arrangement shown, the dashed arrow marks the image. Describe its orientation compared with the object.",
		topicKeywords: ["thin lens", "real inverted image", "object image orientation"],
		visual: {
			caption: "Real inverted image formed by a convex lens on the opposite side of the object.",
			altText:
				"Convex lens at centre; tall upright object on the left; dashed inverted image arrow farther to the right along the principal axis.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -26,
				axisMax: 38,
				objects: [
					{ kind: "object", x: -14, height: 2.5, dashed: false },
					{ kind: "image", x: 22, height: -3.2, dashed: true },
				],
				lenses: [{ type: "convex_lens", x: 0, focalLength: 10 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Ideal meters are inserted as shown. Which component must carry the same current as resistor $R$?",
		topicKeywords: ["ammeter ideal", "series current", "measurement circuits"],
		visual: {
			caption: "Simple series loop with an ideal ammeter and a resistor.",
			altText:
				"Rectangle circuit: cell, ammeter symbol in series with one resistor completing the loop.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 2 },
					{ id: "n2", x: 6, y: 2 },
					{ id: "n3", x: 6, y: 0 },
					{ id: "n4", x: 0, y: 0 },
				],
				components: [
					{ type: "battery", from: "n4", to: "n3", emfVolts: 12, label: "12 V" },
					{ type: "wire", from: "n3", to: "n2" },
					{ type: "resistor", from: "n2", to: "n1", resistanceOhms: 6, label: "R" },
					{ type: "ammeter", from: "n1", to: "n4", label: "A" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Which instrument is connected in parallel with $R$ so it senses the potential difference across $R$?",
		topicKeywords: ["voltmeter", "potential difference measurement", "parallel branch"],
		visual: {
			caption: "Resistor in a single loop with a voltmeter bridged across it.",
			altText:
				"Battery supplies the loop; one resistor between two nodes; voltmeter leads attach to the same two nodes as the resistor.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 2 },
					{ id: "n2", x: 0, y: 0 },
					{ id: "n3", x: 6, y: 2 },
					{ id: "n4", x: 6, y: 0 },
				],
				components: [
					{ type: "battery", from: "n2", to: "n1", emfVolts: 9, label: "9 V" },
					{ type: "wire", from: "n1", to: "n3" },
					{ type: "resistor", from: "n3", to: "n4", resistanceOhms: 10, label: "R" },
					{ type: "wire", from: "n4", to: "n2" },
					{ type: "voltmeter", from: "n3", to: "n4", label: "V" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The switch is open. Through which components does steady conventional current flow?",
		topicKeywords: ["open switch", "circuit continuity", "steady current qualitative"],
		visual: {
			caption: "Series circuit with battery, resistor, and open switch.",
			altText:
				"Closed loop wiring with switch gap shown open between two nodes; no complete path for steady current.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 2 },
					{ id: "n2", x: 6, y: 2 },
					{ id: "n3", x: 6, y: 0 },
					{ id: "n4", x: 0, y: 0 },
				],
				components: [
					{ type: "battery", from: "n4", to: "n3", emfVolts: 5, label: "5 V" },
					{ type: "wire", from: "n3", to: "n2" },
					{ type: "resistor", from: "n2", to: "n1", resistanceOhms: 100, label: "R" },
					{ type: "switch", from: "n1", to: "n4", closed: false, label: "S" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The velocity-time graph shows motion with constant speed. What is the velocity?",
		topicKeywords: ["uniform motion", "constant speed", "horizontal v t"],
		visual: {
			caption: "Horizontal v–t line (uniform motion).",
			altText:
				"Velocity on vertical axis constant at 6 metres per second over time from 0 to 8 seconds.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 8,
				yMin: 0,
				yMax: 10,
				xLabel: "t (s)",
				yLabel: "v (m/s)",
				items: [{ expr: "6", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The straight-line v–t graph describes uniform retardation from 12 m/s. What is the acceleration?",
		topicKeywords: ["uniform retardation", "v t slope negative acceleration", "kinematics"],
		visual: {
			caption: "Velocity decreasing linearly with time.",
			altText:
				"Segment from (0,12) sloping down to (4,0); velocity in metres per second, time in seconds.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 5,
				yMin: 0,
				yMax: 14,
				xLabel: "t (s)",
				yLabel: "v (m/s)",
				items: [{ expr: "12 - 3*x", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The straight-line $x$–$t$ graph describes uniform motion along an axis. What is the speed?",
		topicKeywords: ["uniform motion", "x t graph slope equals speed", "position time graph"],
		visual: {
			caption: "Position proportional to time (constant slope).",
			altText:
				"Graph through the origin with position in metres on the vertical axis and time in seconds on the horizontal axis; constant positive slope.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 6,
				yMin: 0,
				yMax: 35,
				xLabel: "t (s)",
				yLabel: "x (m)",
				items: [{ expr: "5*x", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The graph shows vertical displacement $y$ versus time $t$ for a projectile near Earth's surface (modelled). Where does the curve reach its maximum?",
		topicKeywords: ["projectile motion", "max height graphical", "symmetry of trajectory"],
		visual: {
			caption: "Parabolic height versus time under constant downward acceleration.",
			altText:
				"Inverted parabola opening downward; vertical axis displacement in metres; horizontal axis time in seconds.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 3.2,
				yMin: 0,
				yMax: 14,
				xLabel: "t (s)",
				yLabel: "y (m)",
				items: [{ expr: "15*x - 4.9*x^2", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the oscillator whose displacement–time graph is shown, how many full cycles occur between $t = 0$ and $t = 4$ s?",
		topicKeywords: ["simple harmonic motion", "periodicity", "sine oscillator"],
		visual: {
			caption: "Sinusoidal displacement versus time (simple harmonic motion shape).",
			altText:
				"Sine-shaped curve crossing equilibrium twice per cycle; time axis in seconds; displacement in metres.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 4,
				yMin: -2,
				yMax: 2,
				xLabel: "t (s)",
				yLabel: "x (m)",
				items: [{ expr: "sin((3.141592653589793*x)/2)", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The snapshot shows transverse displacement versus position along a stretched string. What is the wavelength (crest-to-next-crest horizontal distance)?",
		topicKeywords: ["transverse wave", "wavelength graphical", "string waves"],
		visual: {
			caption: "Sinusoidal snapshot y versus x along a string.",
			altText:
				"Periodic sine wave on position axis in metres; amplitude labelled implicitly by vertical scale.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 8,
				yMin: -1.2,
				yMax: 1.2,
				xLabel: "x (m)",
				yLabel: "y (mm)",
				items: [{ expr: "sin(3.141592653589793*x)", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "An ideal gas sample obeys $PV = \\text{constant}$ at fixed temperature. According to the curve, what happens to $P$ when $V$ doubles from 2 m³ to 4 m³?",
		topicKeywords: ["Boyle's law", "isothermal", "ideal gas graphs"],
		visual: {
			caption: "Hyperbolic P–V isotherm for a fixed amount of ideal gas.",
			altText:
				"Pressure decreasing as volume increases along a smooth reciprocal curve in the first quadrant.",
			spec: {
				kind: "math_function_plot",
				xMin: 1,
				xMax: 8,
				yMin: 0,
				yMax: 10,
				xLabel: "V (m³)",
				yLabel: "P (kPa)",
				items: [{ expr: "8/x", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Using the table, rank the media by the speed of sound (fastest first).",
		topicKeywords: ["sound waves", "speed of wave in medium", "data table"],
		visual: {
			caption: "Approximate speed of sound in several media at ~20°C.",
			altText:
				"Two-column table listing medium names and speeds in metres per second.",
			spec: {
				kind: "data_table",
				caption: "Speed of sound",
				headers: ["Medium", "v (m/s)"],
				rows: [
					[
						{ value: "Air", bold: false, align: "left" },
						{ value: "343", bold: false, align: "right" },
					],
					[
						{ value: "Fresh water", bold: false, align: "left" },
						{ value: "1482", bold: false, align: "right" },
					],
					[
						{ value: "Steel", bold: false, align: "left" },
						{ value: "≈ 5960", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Light travels from air into each medium in the table at the same angle of incidence. Which medium bends the ray most toward the normal?",
		topicKeywords: ["refractive index", "refraction bending", "Snell qualitative"],
		visual: {
			caption: "Refractive indices (approximate) for lesson problems.",
			altText:
				"Small table of materials with dimensionless refractive index n.",
			spec: {
				kind: "data_table",
				caption: "Refractive index",
				headers: ["Medium", "n (approx.)"],
				rows: [
					[
						{ value: "Air", bold: false, align: "left" },
						{ value: "1.00", bold: false, align: "right" },
					],
					[
						{ value: "Water", bold: false, align: "left" },
						{ value: "1.33", bold: false, align: "right" },
					],
					[
						{ value: "Crown glass", bold: false, align: "left" },
						{ value: "1.52", bold: false, align: "right" },
					],
					[
						{ value: "Diamond", bold: false, align: "left" },
						{ value: "2.42", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Equal masses of the substances listed receive the same heat for the same ΔT. Which stores the least thermal energy increase per kilogram according to the table?",
		topicKeywords: ["specific heat capacity", "calorimetry", "thermal energy stored"],
		visual: {
			caption: "Specific heat capacities at constant pressure (approximate).",
			altText:
				"Two-column table with substance names and c in joules per kilogram kelvin.",
			spec: {
				kind: "data_table",
				caption: "Specific heat",
				headers: ["Substance", "c (J kg⁻¹ K⁻¹)"],
				rows: [
					[
						{ value: "Water", bold: false, align: "left" },
						{ value: "4186", bold: false, align: "right" },
					],
					[
						{ value: "Aluminium", bold: false, align: "left" },
						{ value: "900", bold: false, align: "right" },
					],
					[
						{ value: "Iron", bold: false, align: "left" },
						{ value: "449", bold: false, align: "right" },
					],
					[
						{ value: "Lead", bold: false, align: "left" },
						{ value: "128", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For wires of the same length and cross-section, which material in the table has the lowest resistance at room temperature?",
		topicKeywords: ["resistivity conductors", "resistance comparison", "specific resistance"],
		visual: {
			caption: "Electrical resistivity at ~300 K (order-of-magnitude lesson values).",
			altText:
				"Materials listed with resistivity in ohm-metres in scientific notation.",
			spec: {
				kind: "data_table",
				caption: "Resistivity comparison",
				headers: ["Metal", "ρ (Ω·m)"],
				rows: [
					[
						{ value: "Silver", bold: false, align: "left" },
						{ value: "1.6 × 10⁻⁸", bold: false, align: "right" },
					],
					[
						{ value: "Copper", bold: false, align: "left" },
						{ value: "1.7 × 10⁻⁸", bold: false, align: "right" },
					],
					[
						{ value: "Constantan", bold: false, align: "left" },
						{ value: "4.9 × 10⁻⁷", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The curve shows the vertical height $y$ of a projectile versus horizontal distance $x$ (both in metres) under a simple model. At which $x$ does the trajectory return to $y = 0$?",
		topicKeywords: ["projectile", "kinematics", "motion in a plane", "parabola"],
		visual: {
			caption: "Parabolic path $y$ versus $x$ for a projectile model.",
			altText:
				"Downward-opening parabola starting at the origin, peaking around the middle of the window, crossing the horizontal axis again on the right.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 8,
				yMin: 0,
				yMax: 22,
				xLabel: "x (m)",
				yLabel: "y (m)",
				items: [{ expr: "12*x - 2*x^2", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The dashed curve lags the solid curve by a constant phase — about how many radians (to one decimal)?",
		topicKeywords: ["alternating current", "AC", "phasor", "phase", "waves"],
		visual: {
			caption: "Two sinusoidal voltages on the same time axis.",
			altText:
				"Sine curves with the same amplitude and frequency; one curve is horizontally shifted slightly right relative to the other.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 4,
				yMin: -1.2,
				yMax: 1.2,
				xLabel: "t (s)",
				yLabel: "V (a.u.)",
				items: [
					{
						expr: "sin(3.141592653589793*x)",
						color: "primary",
						label: null,
					},
					{
						expr: "sin(3.141592653589793*x - 1.0471975511965976)",
						color: "secondary",
						label: null,
					},
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "On the sketch, curve A follows $P \\propto 1/V$ at fixed $T$, while curve B is adiabatic with larger magnitude slope near the same point. Identify which plotted relation is curve A.",
		topicKeywords: ["thermodynamics", "ideal gas", "adiabatic", "isothermal", "P-V diagram"],
		visual: {
			caption: "Pressure–volume curves: hyperbolic isotherm vs adiabat (model).",
			altText:
				"Two decreasing curves in the first quadrant; both drop as volume increases but one is visibly steeper at the left end.",
			spec: {
				kind: "math_function_plot",
				xMin: 0.5,
				xMax: 8,
				yMin: 0,
				yMax: 18,
				xLabel: "V",
				yLabel: "P",
				items: [
					{
						expr: "12/x",
						color: "primary",
						label: "A",
					},
					{
						expr: "20/(x^1.4)",
						color: "secondary",
						label: "B",
					},
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The plotted waveform is periodic with one zero crossing between consecutive peaks within each half-cycle interval. Describe it in comparison with an ordinary sine of the same period.",
		topicKeywords: ["rectifier", "diode", "alternating current", "electromagnetic induction"],
		visual: {
			caption: "Full-wave rectified sinusoidal waveform (model).",
			altText:
				"A positive-only periodic waveform with rounded peaks resembling absolute-value sine halves.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 4,
				yMin: 0,
				yMax: 1.2,
				xLabel: "t (s)",
				yLabel: "I (a.u.)",
				items: [
					{
						expr: "abs(sin(3.141592653589793*x))",
						color: "primary",
						label: null,
					},
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the ideal spring following Hooke’s law in the graph, estimate the spring constant $k$ from the slope of $F$ versus $x$ (SI units).",
		topicKeywords: ["work", "energy", "spring", "restoring force", "hooke"],
		visual: {
			caption: "Linear restoring force versus extension for a model spring.",
			altText:
				"Straight line through the origin with force on the vertical axis and displacement on the horizontal axis; positive slope.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 0.2,
				yMin: 0,
				yMax: 10,
				xLabel: "x (m)",
				yLabel: "F (N)",
				items: [{ expr: "40*x", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "The graph models discharge current in an $RC$ branch. By what factor does the value drop from $t = 0$ to $t = 2$ s (model)?",
		topicKeywords: ["RC circuit", "capacitor", "time constant", "current electricity"],
		visual: {
			caption: "Exponential decay of current versus time (model).",
			altText:
				"Curve starting at a positive intercept on the vertical axis and approaching zero with a smooth exponential shape.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 6,
				yMin: 0,
				yMax: 3,
				xLabel: "t (s)",
				yLabel: "I (A)",
				items: [{ expr: "2.5*exp(-0.5*x)", color: "primary", label: null }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the satellite in uniform circular motion, the single real force shown points toward Earth’s centre. What provides the centripetal acceleration?",
		topicKeywords: ["gravitation", "circular motion", "centripetal", "satellite"],
		visual: {
			caption: "Free-body diagram for a satellite in circular orbit (schematic).",
			altText:
				"Small block labelled Satellite with one arrow pointing horizontally toward the implied centre of the orbit labelled F_g.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Satellite",
				forces: [{ name: "F_g", magnitude: 8000, angleDeg: 180 }],
				inclineDeg: null,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "A wooden block floats at rest with the two forces shown. State the relation between the magnitudes of weight and buoyant force.",
		topicKeywords: ["fluids", "buoyancy", "archimedes", "equilibrium"],
		visual: {
			caption: "Floating block: weight and buoyant force in equilibrium.",
			altText:
				"Rectangular block with a downward arrow labelled W and an equal-length upward arrow labelled F_B along the same vertical line.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 30, angleDeg: 270 },
					{ name: "F_B", magnitude: 30, angleDeg: 90 },
				],
				inclineDeg: null,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the balanced-bridge layout, which components form the four arms of the Wheatstone network between the battery corners?",
		topicKeywords: ["wheatstone", "bridge", "current electricity", "galvanometer", "resistance"],
		visual: {
			caption: "Wheatstone-style bridge: four arm resistors and ideal voltmeter across one diagonal.",
			altText:
				"Rectangular loop of four resistors R1 through R4 with a battery along one diagonal and a voltmeter symbol along the other diagonal.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n_tl", x: 0, y: 2 },
					{ id: "n_tr", x: 4, y: 2 },
					{ id: "n_br", x: 4, y: 0 },
					{ id: "n_bl", x: 0, y: 0 },
				],
				components: [
					{ type: "resistor", from: "n_tl", to: "n_tr", resistanceOhms: 10, label: "R1" },
					{ type: "resistor", from: "n_tr", to: "n_br", resistanceOhms: 10, label: "R2" },
					{ type: "resistor", from: "n_br", to: "n_bl", resistanceOhms: 10, label: "R3" },
					{ type: "resistor", from: "n_bl", to: "n_tl", resistanceOhms: 10, label: "R4" },
					{ type: "battery", from: "n_tl", to: "n_br", emfVolts: 6, label: "6 V" },
					{ type: "voltmeter", from: "n_tr", to: "n_bl", label: "V" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Using the Balmer-series wavelengths in air, which transition has the longest wavelength (lowest photon energy among the lines listed)?",
		topicKeywords: ["atomic physics", "hydrogen spectrum", "dual nature", "photon", "spectroscopy"],
		visual: {
			caption: "Balmer visible lines (approximate vacuum/air lesson values).",
			altText:
				"Four-row table naming hydrogen Balmer transitions and listing wavelength in nanometres.",
			spec: {
				kind: "data_table",
				caption: "Hydrogen Balmer (approx.)",
				headers: ["Line", "λ (nm)"],
				rows: [
					[
						{ value: "Hα", bold: false, align: "left" },
						{ value: "656", bold: false, align: "right" },
					],
					[
						{ value: "Hβ", bold: false, align: "left" },
						{ value: "486", bold: false, align: "right" },
					],
					[
						{ value: "Hγ", bold: false, align: "left" },
						{ value: "434", bold: false, align: "right" },
					],
					[
						{ value: "Hδ", bold: false, align: "left" },
						{ value: "410", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "According to the table, which nucleus has (approximately) the largest binding energy per nucleon?",
		topicKeywords: ["nucleus", "binding energy", "mass defect", "nuclides", "atoms"],
		visual: {
			caption: "Binding energy per nucleon — representative lesson-scale values.",
			altText:
				"Two-column table naming selected nuclides and binding energy per nucleon in megaelectronvolts.",
			spec: {
				kind: "data_table",
				caption: "BE/A (approx.)",
				headers: ["Nuclide", "BE/A (MeV)"],
				rows: [
					[
						{ value: "⁴He", bold: false, align: "left" },
						{ value: "7.1", bold: false, align: "right" },
					],
					[
						{ value: "¹²C", bold: false, align: "left" },
						{ value: "7.7", bold: false, align: "right" },
					],
					[
						{ value: "⁶²Ni", bold: false, align: "left" },
						{ value: "8.8", bold: false, align: "right" },
					],
					[
						{ value: "²³⁸U", bold: false, align: "left" },
						{ value: "7.6", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["physics", "science"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// BIOLOGY (tables & charts only — no tissue / organ diagram renderer in v1)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain why enzymes are highly specific to their substrate molecules.",
		topicKeywords: ["enzyme", "substrate", "protein", "biochemistry"],
		visual: null,
		subjects: ["biology"],
	},
	{
		stem: "Using the enzyme assay results in the table, at which temperature was the highest initial reaction rate recorded?",
		topicKeywords: ["enzyme", "temperature", "rate", "assay", "experiment"],
		visual: {
			caption: "Trial enzyme activity — initial rate vs temperature.",
			altText:
				"Three-column table: trial label, temperature in degrees Celsius, initial rate in micromoles per minute.",
			spec: {
				kind: "data_table",
				caption: "Enzyme assay (three trials)",
				headers: ["Trial", "Temperature (°C)", "Initial rate (µmol·min⁻¹)"],
				rows: [
					[
						{ value: "A", bold: false, align: "left" },
						{ value: "25", bold: false, align: "right" },
						{ value: "12", bold: false, align: "right" },
					],
					[
						{ value: "B", bold: false, align: "left" },
						{ value: "37", bold: false, align: "right" },
						{ value: "28", bold: false, align: "right" },
					],
					[
						{ value: "C", bold: false, align: "left" },
						{ value: "45", bold: false, align: "right" },
						{ value: "9", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["biology"],
	},
	{
		stem: "According to the bar chart, which sampling zone had the greatest estimated plant species richness?",
		topicKeywords: ["ecology", "species", "biodiversity", "population", "sampling"],
		visual: {
			caption: "Estimated species richness by sampling zone.",
			altText:
				"Vertical bars for four labelled zones on the horizontal axis and species count on the vertical axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Zone",
				yLabel: "Species (count)",
				data: [
					{ label: "Forest edge", value: 18 },
					{ label: "Grassland", value: 26 },
					{ label: "Wetland", value: 31 },
					{ label: "Bare soil", value: 7 },
				],
			},
		},
		subjects: ["biology"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// CHEMISTRY
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain why the bond angle in H₂O is approximately 104.5° and not 109.5°.",
		topicKeywords: ["vsepr", "molecular geometry", "water", "bond angle", "electron pair repulsion"],
		visual: null,
		subjects: ["chemistry"],
	},
	{
		stem: "Identify the functional group present in the molecule shown.",
		topicKeywords: ["organic chemistry", "functional group", "carboxylic acid", "spectator structure"],
		visual: {
			caption: "Ethanoic acid (acetic acid) skeletal — methyl plus carboxyl C(=O)OH.",
			altText:
				"Two-carbon backbone with a carbonyl carbon bonded to an OH group and a methyl group.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CC(=O)O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Name the organic compound whose structure is shown and state the homologous series it belongs to.",
		topicKeywords: ["aromatic", "benzene", "homologous series", "organic nomenclature"],
		visual: {
			caption: "Skeletal structure of benzene.",
			altText:
				"Hexagonal ring of six carbons with alternating bonds; one hydrogen at each vertex implied.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "c1ccccc1",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The structure shown is ethanol. Name the functional group present and the class of this compound.",
		topicKeywords: ["alcohol", "functional group", "ethanol", "hydroxyl"],
		visual: {
			caption: "Skeletal structure of ethanol.",
			altText:
				"Two-carbon chain; the second carbon carries an OH group.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CCO",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Identify the compound shown and classify it as monosaccharide, disaccharide, or polysaccharide.",
		topicKeywords: ["carbohydrate", "glucose", "monosaccharide", "biomolecule"],
		visual: {
			caption: "Open-chain structure of glucose.",
			altText:
				"Six-carbon chain with an aldehyde group at carbon 1 and hydroxyl groups at carbons 2 through 6.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "OCC(O)C(O)C(O)C(O)C=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Name the compound whose structure is shown and identify its IUPAC suffix.",
		topicKeywords: ["aldehyde", "iupac", "organic nomenclature", "propanal"],
		visual: {
			caption: "Skeletal structure of propanal.",
			altText:
				"Three-carbon chain with a terminal aldehyde group at carbon 1.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CCC=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The molecule shown is carbon dioxide. How many $\\sigma$ and $\\pi$ bonds involve the central carbon?",
		topicKeywords: ["chemical bonding", "sigma bond", "pi bond", "lewis structure"],
		visual: {
			caption: "Line structure of carbon dioxide (O=C=O).",
			altText:
				"Central carbon double-bonded to two oxygen atoms; linear arrangement.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "O=C=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The structure shown is a primary amine. Write its IUPAC name.",
		topicKeywords: ["amine", "primary amine", "organic nomenclature", "functional group"],
		visual: {
			caption: "Skeletal structure of methylamine.",
			altText:
				"Single carbon bonded to an amino group NH2.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CN",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The ball-and-stick model represents methane. How many hydrogen atoms are bonded to the central carbon?",
		topicKeywords: ["molecular shape", "tetrahedral", "methane", "structural model"],
		visual: {
			caption: "Methane structural model (2D depiction of tetrahedral connectivity).",
			altText:
				"Central carbon with four identical bonds arranged tetrahedrally toward hydrogen atoms; textbook methane geometry.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "C",
				display: "2d",
				label: "Methane (CH₄)",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The skeletal structure shown includes one stereogenic centre. State whether the drawn enantiomer has R or S configuration at that carbon (assume standard CIP priorities).",
		topicKeywords: ["enantiomer", "chirality", "cip priorities", "r s configuration"],
		visual: {
			caption: "L-Alanine — 2D structure with tetrahedral stereochemistry.",
			altText:
				"Central alpha carbon bonded to an amino group, carboxyl group, methyl side chain, and hydrogen; wedge-and-dash at the stereocentre indicates one enantiomer.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "N[C@H](C)C(=O)O",
				display: "2d",
				label: "Alanine",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Classify the reaction shown: is it synthesis, decomposition, or displacement?",
		topicKeywords: ["classification of reaction", "combination reaction", "water formation"],
		visual: {
			caption: "Formation of water from hydrogen and oxygen.",
			altText: "Chemical equation with hydrogen and oxygen as reactants and water as product.",
			spec: {
				kind: "chemistry_reaction",
				ce: "2 H2 + O2 -> 2 H2O",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The balanced equation shown represents an esterification reaction. Name the ester formed.",
		topicKeywords: ["esterification", "organic reaction", "ester", "ethyl acetate"],
		visual: {
			caption: "Esterification of acetic acid with ethanol.",
			altText:
				"Acetic acid and ethanol on the left of the reaction arrow; ethyl acetate and water on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "CH3COOH + C2H5OH -> CH3COOC2H5 + H2O",
				label: "Esterification",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The equation shown represents a neutralisation reaction. Identify the salt formed.",
		topicKeywords: ["acid base", "neutralisation", "salt", "ionic compound"],
		visual: {
			caption: "Neutralisation of hydrochloric acid with sodium hydroxide.",
			altText:
				"Hydrochloric acid and sodium hydroxide on the left; sodium chloride and water on the right of the reaction arrow.",
			spec: {
				kind: "chemistry_reaction",
				ce: "HCl + NaOH -> NaCl + H2O",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Using the equation shown, state the type of reaction and identify the oxidising agent.",
		topicKeywords: ["combustion", "oxidation reduction", "redox", "oxygen"],
		visual: {
			caption: "Complete combustion of methane in oxygen.",
			altText:
				"Methane and oxygen on the left of the reaction arrow; carbon dioxide and water as products on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "CH4 + 2 O2 -> CO2 + 2 H2O",
				label: "Combustion",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The equation shown represents thermal decomposition of hydrogen peroxide. Identify the type of reaction.",
		topicKeywords: ["decomposition", "catalyst omitted", "peroxide"],
		visual: {
			caption: "Decomposition of hydrogen peroxide into water and oxygen.",
			altText:
				"Hydrogen peroxide on the left of the arrow; water and oxygen gas on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "2 H2O2 -> 2 H2O + O2",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The reversible reaction shown reaches dynamic equilibrium in a closed vessel. What happens to the rates of the forward and backward reactions at equilibrium?",
		topicKeywords: ["chemical equilibrium", "dynamic equilibrium", "forward reaction", "haber"],
		visual: {
			caption: "Synthesis of ammonia — reversible equilibrium.",
			altText:
				"Nitrogen and hydrogen as reactants linked by a double-headed arrow to ammonia as product; balanced stoichiometric coefficients.",
			spec: {
				kind: "chemistry_reaction",
				ce: "N2 + 3 H2 <=> 2 NH3",
				label: "Haber process (equilibrium)",
			},
		},
		subjects: ["chemistry", "science"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// ACCOUNTANCY
	// ───────────────────────────────────────────────────────────────────────
	// Practice routing (`preferredVisualKindsForSubject`): only `accountancy_table`.
	// SubKinds: journal_entry, ledger, trial_balance, balance_sheet, p_and_l,
	// cash_book, rectification. Stratification uses row/particulars fingerprints so
	// several journals or cash books can surface in one exemplar pick.
	{
		stem: "Which accounting concept requires a business to record its owner’s personal transactions separately from the business?",
		topicKeywords: ["business entity", "accounting concepts", "separate entity"],
		visual: null,
		subjects: ["accountancy"],
	},
	{
		stem: "Complete the journal entry for purchase of furniture for ₹15,000 cash on 1 April 2026 using the skeleton below.",
		topicKeywords: ["journal entry", "debit credit", "asset purchase"],
		visual: {
			caption: "Blank journal entry form for a furniture purchase.",
			altText:
				"Columns for date, particulars, debit, and credit; the accounts to be debited and credited are shown with blank amount cells.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-01",
						particulars: "Furniture A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Post the following transactions to the Cash Account shown and balance it: (i) Received ₹20,000 from Rohan; (ii) Paid ₹8,000 rent.",
		topicKeywords: ["cash account", "ledger posting", "t account", "balancing"],
		visual: {
			caption: "Cash Account (T-form) with opening balance of ₹5,000.",
			altText:
				"Ledger in T-format with debit side showing the opening balance; credit side is blank for the student to post transactions and balance the account.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Cash Account",
					debitSide: [
						{ date: "2026-04-01", particulars: "To Balance b/d", amount: 5000 },
					],
					creditSide: [],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "The trial balance below contains an error on one side. Identify the account whose balance is incorrectly placed.",
		topicKeywords: ["trial balance", "detecting errors", "debit credit"],
		visual: {
			caption: "Trial balance as on 31 March 2026.",
			altText:
				"Three-row trial balance with columns for particulars, debit, and credit; one entry appears on the wrong side.",
			spec: {
				kind: "accountancy_table",
				subKind: "trial_balance",
				rows: [
					{ particulars: "Capital A/c", debit: null, credit: 50000 },
					{ particulars: "Furniture A/c", debit: 20000, credit: null },
					{ particulars: "Bank A/c", debit: null, credit: 30000 },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Using the balance sheet shown, calculate the current ratio (Current Assets / Current Liabilities).",
		topicKeywords: ["balance sheet", "current ratio", "liquidity", "financial analysis"],
		visual: {
			caption: "Abbreviated balance sheet as on 31 March 2026.",
			altText:
				"Two-sided balance sheet; assets side lists furniture, debtors, and cash; equity and liabilities side lists capital and creditors with totals.",
			spec: {
				kind: "accountancy_table",
				subKind: "balance_sheet",
				assetsSide: [
					{ particulars: "Non-Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Furniture", amount: 20000, indent: 1, bold: false },
					{ particulars: "Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Debtors", amount: 10000, indent: 1, bold: false },
					{ particulars: "Cash and Bank", amount: 5000, indent: 1, bold: false },
					{ particulars: "Total Assets", amount: 35000, indent: 0, bold: true },
				],
				equityAndLiabilitiesSide: [
					{ particulars: "Equity", amount: null, indent: 0, bold: true },
					{ particulars: "Capital", amount: 30000, indent: 1, bold: false },
					{ particulars: "Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Creditors", amount: 5000, indent: 1, bold: false },
					{ particulars: "Total Equity & Liabilities", amount: 35000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "From the P&L account shown, calculate the net profit ratio (Net Profit / Net Sales x 100).",
		topicKeywords: ["profit and loss", "ratio analysis", "net profit ratio", "profitability"],
		visual: {
			caption: "Profit and Loss Account for the year ending 31 March 2026.",
			altText:
				"P&L statement with sales revenue at the top; expenses including cost of goods sold, rent, and salaries are deducted; net profit is shown at the bottom.",
			spec: {
				kind: "accountancy_table",
				subKind: "p_and_l",
				rows: [
					{ particulars: "Revenue from Operations (Sales)", amount: 100000, indent: 0, bold: true },
					{ particulars: "Less: Cost of Goods Sold", amount: 60000, indent: 1, bold: false },
					{ particulars: "Gross Profit", amount: 40000, indent: 0, bold: true },
					{ particulars: "Less: Rent", amount: 12000, indent: 1, bold: false },
					{ particulars: "Less: Salaries", amount: 15000, indent: 1, bold: false },
					{ particulars: "Net Profit", amount: 13000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Balance the cash book shown by inserting the missing closing balance on 31 March.",
		topicKeywords: ["cash book", "triple column intuition", "balancing", "bookkeeping"],
		visual: {
			caption: "Simple cash book for March 2026 with closing balance missing.",
			altText:
				"Cash book with two receipt entries and two payment entries; the closing balance entry has blank debit and credit cells.",
			spec: {
				kind: "accountancy_table",
				subKind: "cash_book",
				rows: [
					{ date: "2026-03-01", particulars: "To Balance b/d", debit: 10000, credit: null, narration: null },
					{ date: "2026-03-10", particulars: "To Sales", debit: 25000, credit: null, narration: null },
					{ date: "2026-03-05", particulars: "By Purchases", debit: null, credit: 15000, narration: null },
					{ date: "2026-03-20", particulars: "By Rent", debit: null, credit: 8000, narration: null },
					{ date: "2026-03-31", particulars: "By Balance c/d", debit: null, credit: null, narration: null },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Wages paid ₹3,000 were not posted to the Wages Account. Pass the rectification entry using the skeleton below.",
		topicKeywords: ["rectification", "journal entry", "error correction", "adjustment"],
		visual: {
			caption: "Rectification journal entry skeleton for a posting omission.",
			altText:
				"Journal entry form showing the accounts to be debited and credited; the debit and credit amount cells are blank for the student to fill in.",
			spec: {
				kind: "accountancy_table",
				subKind: "rectification",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Wages A/c           Dr.",
						debit: null,
						credit: null,
						narration: "(Being omission of wages posting corrected)",
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Record credit purchases of goods worth ₹48,000 from Apex Suppliers on 8 April 2026 using the journal skeleton.",
		topicKeywords: ["credit purchase", "journal entry", "trade payable"],
		visual: {
			caption: "Journal voucher skeleton — purchases on credit.",
			altText:
				"Journal columns with particulars naming Purchases as debit and Apex Suppliers as credit; amount cells empty.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-08",
						particulars: "Purchases A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Apex Suppliers A/c",
						debit: null,
						credit: null,
						narration: "(Being goods purchased on credit)",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Bad debts of ₹7,500 are written off against Mehta Stores on 25 March 2026. Complete the journal skeleton.",
		topicKeywords: ["bad debts", "write off", "debtors", "journal"],
		visual: {
			caption: "Journal voucher skeleton — bad debts written off.",
			altText:
				"Debit line names Bad Debts Account; credit line names debtor Mehta Stores; monetary amounts omitted.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-03-25",
						particulars: "Bad Debts A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Mehta Stores A/c",
						debit: null,
						credit: null,
						narration: "(Being bad debts written off)",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Enter cash drawings ₹12,000 by the proprietor on 14 June and balance the cash ledger excerpt shown.",
		topicKeywords: ["drawings", "capital", "cash ledger", "posting"],
		visual: {
			caption: "Cash Account ledger excerpt after routine receipts and payments.",
			altText:
				"T-format ledger named Cash Account with debit entries To Capital introduced and To Cash Sales; credit entries By Rent and By Electricity already posted.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Cash Account",
					debitSide: [
						{ date: "2026-06-01", particulars: "To Balance b/d", amount: 8000 },
						{ date: "2026-06-05", particulars: "To Capital A/c", amount: 40000 },
						{ date: "2026-06-12", particulars: "To Sales A/c", amount: 22000 },
					],
					creditSide: [
						{ date: "2026-06-07", particulars: "By Rent A/c", amount: 6000 },
						{ date: "2026-06-09", particulars: "By Electricity A/c", amount: 3500 },
					],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Prepare debtors control postings from the trial balance extract — verify debit equals credit totals.",
		topicKeywords: ["trial balance", "financial statements prelude", "arithmetic accuracy"],
		visual: {
			caption: "Trial balance extract before preparing financial statements.",
			altText:
				"Six ledger balances with debit column Machinery, Debtors, Cash and credit column Capital, Creditors, Sales.",
			spec: {
				kind: "accountancy_table",
				subKind: "trial_balance",
				rows: [
					{ particulars: "Machinery A/c", debit: 80000, credit: null },
					{ particulars: "Trade Debtors A/c", debit: 22000, credit: null },
					{ particulars: "Cash A/c", debit: 13000, credit: null },
					{ particulars: "Capital A/c", debit: null, credit: 90000 },
					{ particulars: "Trade Creditors A/c", debit: null, credit: 14000 },
					{ particulars: "Sales A/c", debit: null, credit: 11000 },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Compute debt-to-equity using only long-term borrowings and owners equity from the abbreviated balance sheet.",
		topicKeywords: ["capital structure", "debt equity ratio", "balance sheet ratios"],
		visual: {
			caption: "Abbreviated balance sheet including bank loan (non-current).",
			altText:
				"Assets split non-current machinery and current inventory debtors cash; liabilities split equity capital retained earnings bank loan and trade creditors.",
			spec: {
				kind: "accountancy_table",
				subKind: "balance_sheet",
				assetsSide: [
					{ particulars: "Non-Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Machinery", amount: 85000, indent: 1, bold: false },
					{ particulars: "Current Assets", amount: null, indent: 0, bold: true },
					{ particulars: "Inventory", amount: 21000, indent: 1, bold: false },
					{ particulars: "Trade Debtors", amount: 14000, indent: 1, bold: false },
					{ particulars: "Cash and Bank", amount: 9000, indent: 1, bold: false },
					{ particulars: "Total Assets", amount: 129000, indent: 0, bold: true },
				],
				equityAndLiabilitiesSide: [
					{ particulars: "Equity", amount: null, indent: 0, bold: true },
					{ particulars: "Share Capital", amount: 60000, indent: 1, bold: false },
					{ particulars: "Retained Earnings", amount: 18000, indent: 1, bold: false },
					{ particulars: "Non-Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Bank Loan", amount: 27000, indent: 1, bold: false },
					{ particulars: "Current Liabilities", amount: null, indent: 0, bold: true },
					{ particulars: "Trade Creditors", amount: 24000, indent: 1, bold: false },
					{ particulars: "Total Equity & Liabilities", amount: 129000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "From the statement shown, determine operating profit before interest using only the labelled lines.",
		topicKeywords: ["profit and loss", "operating profit", "finance cost", "financial statement"],
		visual: {
			caption: "Profit and Loss Account — revenue through operating profit.",
			altText:
				"Income statement listing revenue, cost of goods sold, gross profit, operating expenses including depreciation, operating profit, interest expense, and profit before tax.",
			spec: {
				kind: "accountancy_table",
				subKind: "p_and_l",
				rows: [
					{ particulars: "Revenue from Operations", amount: 182000, indent: 0, bold: true },
					{ particulars: "Less: Cost of Goods Sold", amount: 92000, indent: 1, bold: false },
					{ particulars: "Gross Profit", amount: 90000, indent: 0, bold: true },
					{ particulars: "Less: Salaries & Wages", amount: 28000, indent: 1, bold: false },
					{ particulars: "Less: Rent & Rates", amount: 9000, indent: 1, bold: false },
					{ particulars: "Less: Depreciation", amount: 5200, indent: 1, bold: false },
					{ particulars: "Operating Profit", amount: 47800, indent: 0, bold: true },
					{ particulars: "Less: Interest on Loan", amount: 3800, indent: 1, bold: false },
					{ particulars: "Profit Before Tax", amount: 44000, indent: 0, bold: true },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Insert the balancing figures so debits equal credits for March’s cash book before ledger posting.",
		topicKeywords: ["cash book", "balancing totals", "arithmetic drill"],
		visual: {
			caption: "Cash book — receipts from debtor and capital injection.",
			altText:
				"Cash book rows include debit receipt from debtor Sunil Traders and capital introduced by proprietor; payments include salaries and bank deposit.",
			spec: {
				kind: "accountancy_table",
				subKind: "cash_book",
				rows: [
					{ date: "2026-03-01", particulars: "To Balance b/d", debit: 15000, credit: null, narration: null },
					{ date: "2026-03-04", particulars: "To Capital A/c", debit: 50000, credit: null, narration: null },
					{ date: "2026-03-08", particulars: "To Sunil Traders A/c", debit: 33000, credit: null, narration: null },
					{ date: "2026-03-12", particulars: "By Salaries A/c", debit: null, credit: 22000, narration: null },
					{ date: "2026-03-18", particulars: "By Bank A/c", debit: null, credit: 38000, narration: null },
					{ date: "2026-03-31", particulars: "By Balance c/d", debit: null, credit: null, narration: null },
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Rent paid ₹9,000 was wrongly debited to Rates Expense. Pass one compound journal entry to correct using the skeleton.",
		topicKeywords: ["rectification", "compound entry", "nominal accounts"],
		visual: {
			caption: "Rectification skeleton — mis-post between nominal accounts.",
			altText:
				"Debit Rent Account credit Rates Expense Account lines with narration referencing correction of mis-posting.",
			spec: {
				kind: "accountancy_table",
				subKind: "rectification",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Rent A/c               Dr.",
						debit: null,
						credit: null,
						narration: "(Being rent wrongly charged to Rates — corrected)",
					},
					{
						date: "",
						particulars: "    To Rates Expense A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// ECONOMICS / STATISTICS
	// ───────────────────────────────────────────────────────────────────────
	// Allowed kinds when subject matches economics OR statistics:
	// `economics_curve`, `statistics_chart`, `data_table`, `math_function_plot`.
	// Pure statistics items primarily use `statistics_chart` (8 subKinds) plus
	// raw grouped data in `data_table`; reserve `economics_curve` for micro/macro
	// diagrams. Stratification keys keep distinct histograms/scatters/etc.
	{
		stem: "State the law of demand and explain the relationship between price and quantity demanded.",
		topicKeywords: ["law of demand", "microeconomics", "price determination"],
		visual: null,
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which class interval is the modal class in the histogram shown?",
		topicKeywords: ["histogram", "mode", "frequency distribution", "statistics"],
		visual: {
			caption: "Frequency distribution of marks.",
			altText:
				"Histogram with five adjacent class intervals on the horizontal axis and frequency on the vertical axis; bar heights vary across intervals.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Marks",
				yLabel: "Frequency",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 7 },
					{ label: "30-40", frequency: 12 },
					{ label: "40-50", frequency: 9 },
					{ label: "50-60", frequency: 3 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The bar chart shows student enrolment by stream. Which stream has the highest enrolment?",
		topicKeywords: ["bar chart", "enrolment", "data interpretation"],
		visual: {
			caption: "Student enrolment by stream in a senior secondary school.",
			altText:
				"Four vertical bars labelled Science, Commerce, Arts, and Vocational; bar heights differ across streams.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Stream",
				yLabel: "Number of Students",
				data: [
					{ label: "Science", value: 120 },
					{ label: "Commerce", value: 95 },
					{ label: "Arts", value: 80 },
					{ label: "Vocational", value: 45 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The line graph shows GDP growth rate (%) over five years. In which year did the growth rate peak?",
		topicKeywords: ["GDP", "growth rate", "macroeconomics", "time series"],
		visual: {
			caption: "Annual GDP growth rate (% per annum) over five years.",
			altText:
				"Line graph with years 2018 through 2022 on the horizontal axis and growth rate percentage on the vertical axis; the line rises and falls across the period.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Year",
				yLabel: "GDP Growth Rate (%)",
				series: [
					{
						name: "GDP Growth",
						points: [
							{ x: 2018, y: 6.5 },
							{ x: 2019, y: 5.0 },
							{ x: 2020, y: -6.6 },
							{ x: 2021, y: 8.7 },
							{ x: 2022, y: 7.2 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Based on the scatter diagram, state whether the correlation between study hours and test marks is positive, negative, or zero.",
		topicKeywords: ["scatter plot", "correlation", "bivariate data"],
		visual: {
			caption: "Scatter diagram of daily study hours versus test marks.",
			altText:
				"Ten data points on a grid; daily study hours from 2 to 9 on the horizontal axis; test marks from 40 to 92 on the vertical axis; points trend upward from left to right.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Study Hours (per day)",
				yLabel: "Test Marks",
				points: [
					{ x: 2, y: 40, label: null },
					{ x: 3, y: 52, label: null },
					{ x: 3, y: 48, label: null },
					{ x: 4, y: 58, label: null },
					{ x: 5, y: 65, label: null },
					{ x: 5, y: 70, label: null },
					{ x: 6, y: 72, label: null },
					{ x: 7, y: 80, label: null },
					{ x: 8, y: 88, label: null },
					{ x: 9, y: 92, label: null },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which sector contributes the largest share to GDP according to the pie chart?",
		topicKeywords: ["GDP composition", "pie chart", "sectoral distribution"],
		visual: {
			caption: "Sector-wise contribution to GDP.",
			altText:
				"Pie chart with four slices labelled Agriculture, Industry, Services, and Others; slice sizes differ.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Agriculture", value: 18 },
					{ label: "Industry", value: 26 },
					{ label: "Services", value: 50 },
					{ label: "Others", value: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the frequency polygon shown, identify the class interval with the highest frequency.",
		topicKeywords: ["frequency polygon", "wages distribution", "statistics"],
		visual: {
			caption: "Frequency polygon for weekly wages of factory workers.",
			altText:
				"Five class intervals on the horizontal axis and number of workers on the vertical axis; points connected by line segments form a polygon.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Weekly Wages (₹)",
				yLabel: "Number of Workers",
				bins: [
					{ label: "200-300", frequency: 5 },
					{ label: "300-400", frequency: 14 },
					{ label: "400-500", frequency: 20 },
					{ label: "500-600", frequency: 11 },
					{ label: "600-700", frequency: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the more-than ogive shown, estimate how many students scored at least 40 marks.",
		topicKeywords: ["ogive", "cumulative frequency", "more than", "marks distribution"],
		visual: {
			caption: "More-than ogive for marks of 60 students.",
			altText:
				"Downward-sloping cumulative curve; marks on the horizontal axis; more-than cumulative frequency on the vertical axis from 60 down toward zero.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Marks",
				yLabel: "More-than cf.",
				cumulative: "more_than",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 12 },
					{ label: "30-40", frequency: 20 },
					{ label: "40-50", frequency: 16 },
					{ label: "50-60", frequency: 8 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Using the less-than ogive shown, find the median of the distribution.",
		topicKeywords: ["median", "ogive", "less than cumulative", "statistics"],
		visual: {
			caption: "Less-than ogive for marks of 60 students.",
			altText:
				"S-shaped cumulative frequency curve; marks on the horizontal axis from 10 to 60; cumulative frequency on the vertical axis from 0 to 60.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Marks",
				yLabel: "Cumulative Frequency",
				cumulative: "less_than",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 12 },
					{ label: "30-40", frequency: 20 },
					{ label: "40-50", frequency: 16 },
					{ label: "50-60", frequency: 8 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the interquartile ranges of Group A and Group B using the box plots shown.",
		topicKeywords: ["box plot", "interquartile range", "quartiles", "compare distributions"],
		visual: {
			caption: "Box plots of test scores for Group A and Group B.",
			altText:
				"Two box plots; each shows minimum, Q1, median, Q3, and maximum; Group A and Group B have different spreads.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Group",
				yLabel: "Test Score",
				groups: [
					{ name: "Group A", min: 30, q1: 45, median: 58, q3: 70, max: 90 },
					{ name: "Group B", min: 40, q1: 55, median: 65, q3: 72, max: 85 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "State whether the histogram suggests slight skew left or skew right relative to the central peaks.",
		topicKeywords: ["skewness", "histogram", "shape of distribution"],
		visual: {
			caption: "Distribution of heights in a random sample of school athletes.",
			altText:
				"Histogram with height bins on the horizontal axis and frequency on the vertical; tallest bars lie slightly toward taller heights.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Height (cm)",
				yLabel: "Frequency",
				bins: [
					{ label: "150-154", frequency: 2 },
					{ label: "155-159", frequency: 5 },
					{ label: "160-164", frequency: 11 },
					{ label: "165-169", frequency: 14 },
					{ label: "170-174", frequency: 9 },
					{ label: "175-179", frequency: 4 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which city recorded the highest total rainfall in the month shown?",
		topicKeywords: ["rainfall", "comparative bar chart", "climatology"],
		visual: {
			caption: "Monthly rainfall totals across cities.",
			altText:
				"Vertical bar chart with cities on the horizontal axis and rainfall in millimetres on the vertical; bars differ in height.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "City",
				yLabel: "Rainfall (mm)",
				data: [
					{ label: "Mumbai", value: 312 },
					{ label: "Delhi", value: 89 },
					{ label: "Kolkata", value: 242 },
					{ label: "Chennai", value: 156 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the two index series on the chart and identify which stayed strictly higher across every plotted quarter.",
		topicKeywords: ["consumer price index", "inflation index", "line graph comparison"],
		visual: {
			caption: "Quarterly consumer prices indexed with base quarter = 100.",
			altText:
				"Two line traces labelled Rural CPI and Urban CPI sharing quarterly horizontal ticks from Q1 through Q8.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Quarter",
				yLabel: "Index (base = 100)",
				series: [
					{
						name: "Urban CPI",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101.4 },
							{ x: 3, y: 102.8 },
							{ x: 4, y: 104.6 },
							{ x: 5, y: 106.1 },
							{ x: 6, y: 107.9 },
							{ x: 7, y: 108.8 },
							{ x: 8, y: 110.5 },
						],
					},
					{
						name: "Rural CPI",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 100.9 },
							{ x: 3, y: 102.2 },
							{ x: 4, y: 103.8 },
							{ x: 5, y: 105.4 },
							{ x: 6, y: 107 },
							{ x: 7, y: 107.9 },
							{ x: 8, y: 109.7 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compare the three indexed wage series on the chart and identify which remained strictly lowest at quarter 8.",
		topicKeywords: ["wage indices", "index numbers", "comparative time series"],
		visual: {
			caption: "Quarterly wage indices — three sectors (base quarter = 100).",
			altText:
				"Three line traces labelled Manufacturing, Services, and Agriculture sharing quarterly ticks Q1–Q8 on the horizontal axis and index values on the vertical.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Quarter",
				yLabel: "Index (base = 100)",
				series: [
					{
						name: "Manufacturing",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101.2 },
							{ x: 3, y: 103.1 },
							{ x: 4, y: 104.8 },
							{ x: 5, y: 106.5 },
							{ x: 6, y: 108.7 },
							{ x: 7, y: 110.1 },
							{ x: 8, y: 112.4 },
						],
					},
					{
						name: "Services",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 101 },
							{ x: 3, y: 102.4 },
							{ x: 4, y: 103.9 },
							{ x: 5, y: 105.8 },
							{ x: 6, y: 107.6 },
							{ x: 7, y: 109 },
							{ x: 8, y: 111 },
						],
					},
					{
						name: "Agriculture",
						points: [
							{ x: 1, y: 100 },
							{ x: 2, y: 100.6 },
							{ x: 3, y: 101.5 },
							{ x: 4, y: 102.8 },
							{ x: 5, y: 104 },
							{ x: 6, y: 105.5 },
							{ x: 7, y: 106.9 },
							{ x: 8, y: 108.2 },
						],
					},
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the scatter of outdoor temperature and heater sales, describe the direction of association.",
		topicKeywords: ["scatter plot", "negative association", "interpretation"],
		visual: {
			caption: "Daily mean temperature versus heater units sold.",
			altText:
				"Bivariate scatter trending downward; warmer days paired with fewer heaters sold.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Temperature (°C)",
				yLabel: "Heaters sold",
				points: [
					{ x: 8, y: 920, label: null },
					{ x: 10, y: 880, label: null },
					{ x: 12, y: 830, label: null },
					{ x: 14, y: 790, label: null },
					{ x: 16, y: 740, label: null },
					{ x: 18, y: 690, label: null },
					{ x: 20, y: 620, label: null },
					{ x: 22, y: 560, label: null },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "According to the commuter survey pie chart, what fraction of respondents chose public transport (approximate from the diagram)?",
		topicKeywords: ["pie chart", "proportion", "transport survey"],
		visual: {
			caption: "Primary mode of transport for daily commuting.",
			altText:
				"Pie chart with slices labelled Metro or Bus, Private car, Two-wheeler, Walk or Cycle; slice areas reflect approximate percentages.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Metro or Bus", value: 38 },
					{ label: "Private car", value: 24 },
					{ label: "Two-wheeler", value: 29 },
					{ label: "Walk or Cycle", value: 9 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Sketch mentally how the frequency polygon would close back to the axis after the highest vertex shown.",
		topicKeywords: ["frequency polygon", "mental geometry", "endpoints"],
		visual: {
			caption: "Frequency polygon for reaction times in a psychology experiment.",
			altText:
				"Five class intervals on the horizontal axis measured in milliseconds and counts on the vertical; vertices rise then fall.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Reaction time (ms)",
				yLabel: "No. of trials",
				bins: [
					{ label: "180-199", frequency: 4 },
					{ label: "200-219", frequency: 18 },
					{ label: "220-239", frequency: 31 },
					{ label: "240-259", frequency: 22 },
					{ label: "260-279", frequency: 9 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Which factory batch shows the largest gap between median and third quartile per the box plots?",
		topicKeywords: ["box plot", "quartile interpretation", "manufacturing quality"],
		visual: {
			caption: "Unit defect counts per thousand items — three plants.",
			altText:
				"Three side-by-side box plots labelled Plant North, Plant Central, Plant South on the horizontal axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Plant",
				yLabel: "Defects per 1000 units",
				groups: [
					{ name: "Plant North", min: 1.2, q1: 2.4, median: 3.6, q3: 5.8, max: 9.2 },
					{ name: "Plant Central", min: 0.9, q1: 1.8, median: 2.7, q3: 4.1, max: 7.5 },
					{ name: "Plant South", min: 2.1, q1: 3.5, median: 4.9, q3: 7.2, max: 11 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Estimate the median pocket-money bracket using the less-than ogive (60 students).",
		topicKeywords: ["median", "ogive", "grouped data", "economics statistics"],
		visual: {
			caption: "Less-than ogive for weekly pocket money.",
			altText:
				"Cumulative frequency rising from zero toward 60 as pocket money increases along the horizontal axis.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Pocket money (₹)",
				yLabel: "Cumulative frequency",
				cumulative: "less_than",
				bins: [
					{ label: "100-200", frequency: 8 },
					{ label: "200-300", frequency: 14 },
					{ label: "300-400", frequency: 20 },
					{ label: "400-500", frequency: 12 },
					{ label: "500-600", frequency: 6 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Compute the arithmetic mean monthly saving from the grouped frequency table.",
		topicKeywords: ["mean", "grouped frequency", "statistics", "economics statistics"],
		visual: {
			caption: "Household saving intervals — mid-values implied by class centres.",
			altText:
				"Two columns for savings bracket in rupees and number of households surveyed.",
			spec: {
				kind: "data_table",
				caption: "Monthly household savings",
				headers: ["Bracket (₹)", "Households"],
				rows: [
					[
						{ value: "0 – 5,000", bold: false, align: "left" },
						{ value: "18", bold: false, align: "right" },
					],
					[
						{ value: "5,000 – 10,000", bold: false, align: "left" },
						{ value: "26", bold: false, align: "right" },
					],
					[
						{ value: "10,000 – 15,000", bold: false, align: "left" },
						{ value: "22", bold: false, align: "right" },
					],
					[
						{ value: "15,000 – 20,000", bold: false, align: "left" },
						{ value: "14", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the chart to read off an approximate probability $P(0 \\leq Z \\leq 1)$ as the shaded area under the standard normal curve.",
		topicKeywords: ["normal distribution", "standard normal", "probability density", "z score"],
		visual: {
			caption: "Bell-shaped density curve with horizontal axis standard deviations from the mean.",
			altText:
				"Symmetric curve peaked at zero from negative three to positive three on the horizontal axis; textbook-style normal reference sketch.",
			spec: {
				kind: "math_function_plot",
				xMin: -3.5,
				xMax: 3.5,
				yMin: 0,
				yMax: 0.45,
				xLabel: "z",
				yLabel: "φ(z)",
				items: [{ expr: "exp(-x^2/2)*0.39894228040143267", color: "primary", label: null }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the demand and supply curves shown to read the equilibrium price and quantity at their intersection.",
		topicKeywords: ["supply and demand", "market equilibrium", "microeconomics diagram"],
		visual: {
			caption: "Market diagram with downward demand and upward supply.",
			altText:
				"Quantity on the horizontal axis, price on the vertical; two curves meet at a point labelled Equilibrium in the first quadrant.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity",
				yLabel: "Price",
				xMin: 0,
				xMax: 200,
				yMin: 0,
				yMax: 100,
				curves: [
					{ expr: "80 - 0.4 * p", color: "primary", label: "Demand" },
					{ expr: "0.4 * p", color: "secondary", label: "Supply" },
				],
				marks: [{ x: 100, y: 40, label: "Equilibrium" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The PPF below shows production possibilities for wheat and cotton. Which labelled point represents an attainable but productively inefficient output combination?",
		topicKeywords: ["production possibility frontier", "opportunity cost", "inefficiency", "economics curve"],
		visual: {
			caption: "Production Possibility Frontier for wheat and cotton with three labelled points.",
			altText:
				"Straight downward PPF from wheat 0 cotton 200 to wheat 100 cotton 0; point A lies strictly inside the frontier (inefficient but attainable); point B on the frontier; point C above the line (unattainable).",
			spec: {
				kind: "economics_curve",
				xLabel: "Wheat (tonnes)",
				yLabel: "Cotton (tonnes)",
				xMin: 0,
				xMax: 120,
				yMin: 0,
				yMax: 240,
				curves: [
					{ expr: "200 - 2 * p", color: "primary", label: "PPF" },
				],
				marks: [
					{ x: 40, y: 70, label: "A" },
					{ x: 80, y: 40, label: "B" },
					{ x: 90, y: 120, label: "C" },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "The AD-AS diagram shows the economy at equilibrium E₁. If AD shifts right to AD₂, what happens to the equilibrium price level?",
		topicKeywords: ["aggregate demand", "aggregate supply", "macroeconomics equilibrium", "AD AS model"],
		visual: {
			caption: "AD-AS diagram showing original equilibrium E₁ and a rightward shift of AD.",
			altText:
				"Two downward-sloping AD curves and one upward-sloping SRAS curve; AD₁ and SRAS intersect at E₁; AD₂ is shifted to the right of AD₁.",
			spec: {
				kind: "economics_curve",
				xLabel: "Real GDP (Y)",
				yLabel: "Price Level (P)",
				xMin: 0,
				xMax: 200,
				yMin: 0,
				yMax: 150,
				curves: [
					{ expr: "120 - 0.6 * p", color: "primary", label: "AD₁" },
					{ expr: "140 - 0.6 * p", color: "accent", label: "AD₂" },
					{ expr: "20 + 0.4 * p", color: "secondary", label: "SRAS" },
				],
				marks: [{ x: 100, y: 60, label: "E₁" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the monopoly diagram shown, state the profit-maximising quantity (horizontal-axis value) where MR intersects MC.",
		topicKeywords: ["monopoly", "marginal revenue", "marginal cost", "profit maximisation"],
		visual: {
			caption: "Monopoly diagram with demand (AR), MR, and MC curves.",
			altText:
				"Downward-sloping AR and steeper MR below it; horizontal MC; MR and MC cross at a point whose horizontal coordinate is the profit-maximising output.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity (Q)",
				yLabel: "Price / Revenue / Cost (₹)",
				xMin: 0,
				xMax: 60,
				yMin: 0,
				yMax: 110,
				curves: [
					{ expr: "100 - p", color: "primary", label: "AR (Demand)" },
					{ expr: "100 - 2 * p", color: "secondary", label: "MR" },
					{ expr: "20", color: "muted", label: "MC" },
				],
				marks: [{ x: 40, y: 20, label: "Q*", kind: "vertical_line" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the data table, find the mean number of plants per house.",
		topicKeywords: ["weighted mean", "frequency table", "mean from grouped data"],
		visual: {
			caption: "Plants per house — survey of 25 houses.",
			altText:
				"Two-column data table: number of plants 0 to 5 against frequency, frequencies summing to 25.",
			spec: {
				kind: "data_table",
				caption: "Plants per house",
				headers: ["Number of plants", "Frequency"],
				rows: [
					[
						{ value: "0", bold: false, align: "left" },
						{ value: "1", bold: false, align: "right" },
					],
					[
						{ value: "1", bold: false, align: "left" },
						{ value: "5", bold: false, align: "right" },
					],
					[
						{ value: "2", bold: false, align: "left" },
						{ value: "8", bold: false, align: "right" },
					],
					[
						{ value: "3", bold: false, align: "left" },
						{ value: "6", bold: false, align: "right" },
					],
					[
						{ value: "4", bold: false, align: "left" },
						{ value: "3", bold: false, align: "right" },
					],
					[
						{ value: "5", bold: false, align: "left" },
						{ value: "2", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["economics_statistics", "mathematics"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// BUSINESS STUDIES — charts, tables, curves (same renderer surface as Economics / Stats)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain in one sentence why management is considered a multidimensional activity.",
		topicKeywords: ["management fundamentals", "nature of management", "management functions"],
		visual: null,
		subjects: ["business_studies"],
	},
	{
		stem: "According to the bar chart, which quarter recorded the highest revenue for Division North?",
		topicKeywords: ["bar chart", "revenue reporting", "quarterly comparison"],
		visual: {
			caption: "Quarterly revenue — Division North (₹ lakh).",
			altText:
				"Four vertical bars labelled Q1–Q4 with revenue in lakh rupees on the vertical axis; one quarter bar is tallest.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Quarter",
				yLabel: "Revenue (₹ lakh)",
				data: [
					{ label: "Q1", value: 42 },
					{ label: "Q2", value: 55 },
					{ label: "Q3", value: 48 },
					{ label: "Q4", value: 61 },
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "Using the table, compute the percentage share of Product B in total units sold across all three products.",
		topicKeywords: ["percentage", "distribution", "marketing data table"],
		visual: {
			caption: "Annual units sold by product line.",
			altText:
				"Two-column table listing Product A, B, and C with integer unit sales; totals can be summed from the rows.",
			spec: {
				kind: "data_table",
				caption: "Units sold (year ended March)",
				headers: ["Product", "Units sold"],
				rows: [
					[
						{ value: "A", bold: false, align: "left" },
						{ value: "12,400", bold: false, align: "right" },
					],
					[
						{ value: "B", bold: false, align: "left" },
						{ value: "8,600", bold: false, align: "right" },
					],
					[
						{ value: "C", bold: false, align: "left" },
						{ value: "5,200", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "Using the break-even diagram, read off the approximate output level (units) where total revenue equals total cost.",
		topicKeywords: ["break-even", "cost-volume-profit", "TR TC intersection"],
		visual: {
			caption: "Break-even chart — total revenue and total cost vs units sold.",
			altText:
				"Quantity on the horizontal axis and rupees on the vertical; a straight total revenue line rising from the origin crosses an upward-sloping total cost line that starts above zero at fixed cost.",
			spec: {
				kind: "economics_curve",
				xLabel: "Units (Q)",
				yLabel: "Amount (₹)",
				xMin: 0,
				xMax: 70,
				yMin: 0,
				yMax: 1400,
				curves: [
					{ expr: "25 * p", color: "primary", label: "TR" },
					{ expr: "500 + 10 * p", color: "secondary", label: "TC" },
				],
				marks: [{ x: 33.3, y: 833, label: "Break-even" }],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "According to the pie chart, which cost component absorbed the largest share of factory overheads in the survey month?",
		topicKeywords: ["pie chart", "cost structure", "overheads"],
		visual: {
			caption: "Factory overhead composition — one plant.",
			altText:
				"Pie chart with slices for wages, power and fuel, raw materials, depreciation, and other factory overheads; proportions sum to the whole.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Wages", value: 38 },
					{ label: "Power & fuel", value: 18 },
					{ label: "Raw materials", value: 22 },
					{ label: "Depreciation", value: 12 },
					{ label: "Other overheads", value: 10 },
				],
			},
		},
		subjects: ["business_studies"],
	},
	{
		stem: "In the histogram of absent days per employee, which class interval contains the mode?",
		topicKeywords: ["histogram", "absenteeism", "mode", "HR analytics"],
		visual: {
			caption: "Absent days per employee — one reporting month.",
			altText:
				"Five adjacent class intervals on the horizontal axis and employee count on the vertical; bar heights show how many staff fell in each absent-day bracket.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Absent days",
				yLabel: "Employees",
				bins: [
					{ label: "0", frequency: 42 },
					{ label: "1", frequency: 28 },
					{ label: "2", frequency: 15 },
					{ label: "3", frequency: 9 },
					{ label: "4-5", frequency: 6 },
				],
			},
		},
		subjects: ["business_studies"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// GEOGRAPHY / SOCIAL SCIENCE — charts, tables, function plots, India map (`india_map`)
	// ───────────────────────────────────────────────────────────────────────
	// Preferred kinds: india_map, statistics_chart, data_table, math_function_plot.
	// Tag both geography and social_science so picks work for elective Geography
	// and integrated Social Science.
	{
		stem: "Explain why mid-latitude west coast stations often show a smaller annual temperature range than inland stations at similar latitude.",
		topicKeywords: ["continentality", "maritime climate", "temperature range", "geography climates"],
		visual: null,
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The graph shows mean monthly temperature (°C) at a coastal station. Which month marks the lowest mean temperature?",
		topicKeywords: ["climate", "temperature", "weather", "season"],
		visual: {
			caption: "Mean monthly temperature at one coastal station.",
			altText:
				"Line graph with months 1 through 12 on the horizontal axis and temperature in degrees Celsius on the vertical; the trace rises through mid-year then falls toward December.",
			spec: {
				kind: "statistics_chart",
				subKind: "line",
				xLabel: "Month",
				yLabel: "Temperature (°C)",
				series: [
					{
						name: "Mean temperature",
						points: [
							{ x: 1, y: 22 },
							{ x: 2, y: 23 },
							{ x: 3, y: 25 },
							{ x: 4, y: 27 },
							{ x: 5, y: 29 },
							{ x: 6, y: 30 },
							{ x: 7, y: 29 },
							{ x: 8, y: 28 },
							{ x: 9, y: 27 },
							{ x: 10, y: 26 },
							{ x: 11, y: 24 },
							{ x: 12, y: 22 },
						],
					},
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The bar chart shows average monthly rainfall (mm) during one calendar year at a monsoon-affected station. Which month received the highest rainfall?",
		topicKeywords: ["rainfall", "monsoon", "precipitation", "climate", "hydrology"],
		visual: {
			caption: "Monthly rainfall totals at one station.",
			altText:
				"Twelve vertical bars for months 1 to 12 with rainfall in millimetres on the vertical axis; one mid-year bar is tallest.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "Month",
				yLabel: "Rainfall (mm)",
				data: [
					{ label: "1", value: 12 },
					{ label: "2", value: 9 },
					{ label: "3", value: 18 },
					{ label: "4", value: 42 },
					{ label: "5", value: 88 },
					{ label: "6", value: 165 },
					{ label: "7", value: 210 },
					{ label: "8", value: 145 },
					{ label: "9", value: 96 },
					{ label: "10", value: 38 },
					{ label: "11", value: 14 },
					{ label: "12", value: 8 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "According to the bar chart, which state recorded the largest estimated population (millions) in the survey year?",
		topicKeywords: ["population", "demography", "census", "human geography"],
		visual: {
			caption: "Estimated population by selected states.",
			altText:
				"Horizontal axis lists four Indian states; vertical axis is population in millions; bar heights differ.",
			spec: {
				kind: "statistics_chart",
				subKind: "bar",
				xLabel: "State",
				yLabel: "Population (millions)",
				data: [
					{ label: "Kerala", value: 36 },
					{ label: "Rajasthan", value: 81 },
					{ label: "Bihar", value: 126 },
					{ label: "Tamil Nadu", value: 74 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The pie chart summarises land use within one district. Which land-use category occupies the largest share of area?",
		topicKeywords: ["land use", "resource", "agriculture", "land"],
		visual: {
			caption: "Land-use shares within one district.",
			altText:
				"Pie chart with slices for cropland, forest, built-up, and other land; slice areas reflect approximate percentages.",
			spec: {
				kind: "statistics_chart",
				subKind: "pie",
				slices: [
					{ label: "Cropland", value: 46 },
					{ label: "Forest", value: 28 },
					{ label: "Built-up", value: 14 },
					{ label: "Other", value: 12 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Using the table, which station has the highest annual rainfall total?",
		topicKeywords: ["rainfall", "climate", "station", "temperature"],
		visual: {
			caption: "Climate normals at three weather stations.",
			altText:
				"Three rows list station name, elevation in metres, mean annual rainfall in millimetres, and January mean temperature in Celsius.",
			spec: {
				kind: "data_table",
				caption: "Station climate summary",
				headers: ["Station", "Elevation (m)", "Annual rainfall (mm)", "Jan mean T (°C)"],
				rows: [
					[
						{ value: "Shillong", bold: false, align: "left" },
						{ value: "1495", bold: false, align: "right" },
						{ value: "2180", bold: false, align: "right" },
						{ value: "9", bold: false, align: "right" },
					],
					[
						{ value: "Nagpur", bold: false, align: "left" },
						{ value: "310", bold: false, align: "right" },
						{ value: "1095", bold: false, align: "right" },
						{ value: "21", bold: false, align: "right" },
					],
					[
						{ value: "Thiruvananthapuram", bold: false, align: "left" },
						{ value: "15", bold: false, align: "right" },
						{ value: "1680", bold: false, align: "right" },
						{ value: "27", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The scatter diagram plots latitude (°N) against January mean temperature (°C) for several coastal stations. Describe the direction of association.",
		topicKeywords: ["climate zones", "latitude temperature", "scatter plot", "geography correlation"],
		visual: {
			caption: "Latitude versus January mean temperature (coastal stations).",
			altText:
				"Bivariate scatter with latitude on the horizontal axis and January temperature on the vertical; points trend downward left to right.",
			spec: {
				kind: "statistics_chart",
				subKind: "scatter",
				xLabel: "Latitude (°N)",
				yLabel: "January mean T (°C)",
				points: [
					{ x: 8, y: 27, label: "Kochi" },
					{ x: 12, y: 26, label: null },
					{ x: 16, y: 24, label: "Panaji" },
					{ x: 20, y: 22, label: null },
					{ x: 24, y: 18, label: "Mumbai" },
					{ x: 28, y: 14, label: null },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Which size class of operational land holdings is the modal class in the histogram?",
		topicKeywords: ["histogram", "agricultural geography", "land holdings"],
		visual: {
			caption: "Operational holdings by area — one survey district.",
			altText:
				"Histogram with hectare class intervals on the horizontal axis and number of holdings on the vertical; one central interval has the tallest bar.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Holding size (ha)",
				yLabel: "No. of holdings",
				bins: [
					{ label: "0-1", frequency: 820 },
					{ label: "1-2", frequency: 540 },
					{ label: "2-4", frequency: 310 },
					{ label: "4-10", frequency: 140 },
					{ label: ">10", frequency: 45 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Using the frequency polygon for villages by elevation band, which band contains the greatest number of settlements?",
		topicKeywords: ["frequency polygon", "elevation belts", "rural settlements"],
		visual: {
			caption: "Village counts by median elevation band (m above sea level).",
			altText:
				"Class intervals for elevation on the horizontal axis and village count on the vertical; vertices connect mid-interval frequencies.",
			spec: {
				kind: "statistics_chart",
				subKind: "frequency_polygon",
				xLabel: "Elevation band (m)",
				yLabel: "Villages",
				bins: [
					{ label: "0-200", frequency: 18 },
					{ label: "200-500", frequency: 42 },
					{ label: "500-1000", frequency: 56 },
					{ label: "1000-1500", frequency: 31 },
					{ label: "1500-2500", frequency: 12 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "From the less-than ogive for journey lengths, estimate how many commuter trips were shorter than 25 km.",
		topicKeywords: ["less than ogive", "cumulation journey length", "transport geography"],
		visual: {
			caption: "Less-than cumulative frequency — journey length (sample survey).",
			altText:
				"Cumulative trip count rising along the vertical axis as journey length increases on the horizontal; smooth S-shaped curve.",
			spec: {
				kind: "statistics_chart",
				subKind: "ogive",
				xLabel: "Journey length (km)",
				yLabel: "Cumulative trips",
				cumulative: "less_than",
				bins: [
					{ label: "0-10", frequency: 42 },
					{ label: "10-20", frequency: 68 },
					{ label: "20-30", frequency: 55 },
					{ label: "30-40", frequency: 28 },
					{ label: "40-60", frequency: 17 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Compare the interquartile spread of January mean temperature between the hill station and the plain station using the box plots.",
		topicKeywords: ["climate comparison", "box plot", "hill vs plain temperatures"],
		visual: {
			caption: "January mean temperature — hill vs plain climate stations.",
			altText:
				"Two box plots labelled Hill station and Plain station on the horizontal axis; temperatures in degrees Celsius on the vertical.",
			spec: {
				kind: "statistics_chart",
				subKind: "box",
				xLabel: "Station type",
				yLabel: "January mean T (°C)",
				groups: [
					{ name: "Hill station", min: 4, q1: 6, median: 8, q3: 10, max: 13 },
					{ name: "Plain station", min: 14, q1: 16, median: 18, q3: 20, max: 23 },
				],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The political map highlights three states along the Arabian Sea coast. Which option correctly lists those shaded units?",
		topicKeywords: ["india political map", "arabian sea", "western coast states"],
		visual: {
			caption: "India — selected coastal states (west).",
			altText:
				"Administrative map of India with Kerala, Karnataka, and Goa filled distinctly along the Arabian Sea littoral; neighbours shown in lighter fills.",
			spec: {
				kind: "india_map",
				mapStyle: "political",
				highlightedStates: ["kl", "ka", "ga"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "On the outline-style map, the shaded states lie mainly in the Indo-Gangetic drainage belt. Which labelled choice matches the set shown?",
		topicKeywords: ["outline map india", "indus gangetic plain", "north india states"],
		visual: {
			caption: "India — outline map; plains belt emphasis.",
			altText:
				"Minimal-fill outline map of India with Punjab, Haryana, Uttar Pradesh, and Bihar shaded in amber on interior northern plains.",
			spec: {
				kind: "india_map",
				mapStyle: "outline",
				highlightedStates: ["pb", "hr", "up", "br"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "The physical-palette map emphasises states astride the main Himalayan arc. Which option lists only shaded Himalayan-region units?",
		topicKeywords: ["himalayas", "india relief map", "mountain states india"],
		visual: {
			caption: "India — muted physical palette; Himalayan arc.",
			altText:
				"Muted earth-tone fills across India with Jammu and Kashmir, Himachal Pradesh, and Uttarakhand highlighted in contrasting yellow-green tones.",
			spec: {
				kind: "india_map",
				mapStyle: "physical_palette",
				highlightedStates: ["jk", "hp", "ut"],
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "Refer to the political-style map of India below (no region pre-highlighted). Which option best describes the general orientation of the peninsula south of the Narmada–Tapti belt?",
		topicKeywords: ["physical geography india", "indian peninsula", "map orientation"],
		visual: {
			caption: "India — political-style administrative map (full extent).",
			altText:
				"Map of India with states and union territories in contrasting pastel fills and dark internal borders; Arabian Sea to the west and Bay of Bengal to the east; no single state emphasised.",
			spec: {
				kind: "india_map",
				mapStyle: "political",
				highlightedStates: null,
			},
		},
		subjects: ["geography", "social_science"],
	},
	{
		stem: "On the map below rendered with the default administrative palette (no named style override), which ocean lies immediately west of the Indian peninsula?",
		topicKeywords: ["india map arabian sea", "cardinal directions", "indian ocean geography"],
		visual: {
			caption: "India — administrative boundaries (default map treatment).",
			altText:
				"India map with standard state and UT fills and internal borders; Arabian Sea to the west and Bay of Bengal to the east; no particular state emphasised.",
			spec: {
				kind: "india_map",
				mapStyle: null,
				highlightedStates: null,
			},
		},
		subjects: ["geography", "social_science"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// ENGLISH
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Rewrite the sentence in the passive voice: Meera is writing a letter.",
		topicKeywords: ["active passive voice", "grammar transformation", "voice change"],
		visual: null,
		subjects: ["english"],
	},
	{
		stem: "Read the passage and identify the figure of speech used in line 3.",
		topicKeywords: ["figures of speech", "poetry excerpt", "personification metaphor"],
		visual: {
			caption: "Numbered poem excerpt (lines 1-3).",
			altText:
				"Three short lines of verse, each prefixed by its line number; no interpretation of the literary device is stated.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Across the dawn the river ran," },
					{ number: 2, text: "A silver thread through fields of wheat," },
					{ number: 3, text: "The wind bent down to whisper softly." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Read the passage below and answer: What does the narrator mean by the phrase in line 4?",
		topicKeywords: ["reading comprehension", "prose analysis", "inference"],
		visual: {
			caption: "Prose extract — an interior monologue (lines 1-4).",
			altText:
				"Four numbered lines of prose narration; no interpretive commentary is provided in the caption.",
			spec: {
				kind: "english_passage",
				title: "The Empty House",
				source: null,
				lines: [
					{ number: 1, text: "Aisha stood at the threshold of the empty house." },
					{ number: 2, text: "Every room she entered felt heavier than the last." },
					{ number: 3, text: "There were no voices, no footsteps — and yet" },
					{ number: 4, text: "the silence screamed louder than anything she had ever known." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "In the poem extract below, identify the poetic device used in line 2 and explain its effect on the reader.",
		topicKeywords: ["literary devices", "metaphor imagery", "class 12 literature"],
		visual: {
			caption: "Poem extract (four lines, line-numbered) from a Class 12 anthology.",
			altText:
				"Four numbered lines of verse; no paraphrase or device identification is given in the caption.",
			spec: {
				kind: "english_passage",
				title: "Dawn",
				source: "Class 12 Anthology",
				lines: [
					{ number: 1, text: "The night retreats on silent feet," },
					{ number: 2, text: "As dawn, a painter, brushes light" },
					{ number: 3, text: "Across the canvas of the sky," },
					{ number: 4, text: "And trades the stars for morning bright." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "You are the Secretary of the Eco Club. Draft the body of a notice for the school noticeboard informing students about an inter-house quiz on sustainable development (date, time, venue, and whom to contact).",
		topicKeywords: ["notice writing", "formats", "Eco Club bulletin"],
		visual: {
			caption: "Numbered notice skeleton — Eco Club announcement.",
			altText:
				"Six short lines formatted like a school notice: heading NOTICE, issuing body Eco Club, dated line, subject line about an inter-house quiz, two lines for schedule and venue placeholders, closing line for contact.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "NOTICE" },
					{ number: 2, text: "Eco Club — Greenfield Senior Secondary School" },
					{ number: 3, text: "Date: _______________" },
					{ number: 4, text: "Subject: Inter-House Quiz on Sustainable Development" },
					{ number: 5, text: "All students are informed that an Inter-House Quiz will be held on _______________ at _______________ in _______________." },
					{ number: 6, text: "Interested participants may register with the undersigned by _______________." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Complete the letter by supplying the missing conventional closing: you are Ananya Sharma of Class XI-A, writing to the Principal to request three days’ leave for a family function.",
		topicKeywords: ["letter writing formal", "application leave", "class 11 english"],
		visual: {
			caption: "Formal letter — leave application (numbered layout).",
			altText:
				"Twelve numbered lines from sender block through subject, salutation, short body, complimentary close, and typed signature — conventional formal letter layout.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Ananya Sharma" },
					{ number: 2, text: "Class XI-A, Roll No. _______________" },
					{ number: 3, text: "Greenfield Senior Secondary School" },
					{ number: 4, text: "Date: _______________" },
					{ number: 5, text: "To" },
					{ number: 6, text: "The Principal, Greenfield Senior Secondary School" },
					{ number: 7, text: "Subject: Application for leave of absence (family function)" },
					{ number: 8, text: "Dear Sir/Madam," },
					{ number: 9, text: "I respectfully request leave for three days beginning _______________ for a family function at _______________." },
					{ number: 10, text: "Thank you." },
					{ number: 11, text: "Yours faithfully," },
					{ number: 12, text: "Ananya Sharma" },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Read the dialogue and state what Rohan agrees to do by the end of line 6.",
		topicKeywords: ["spoken english", "dialogue comprehension", "reading comprehension"],
		visual: {
			caption: "Numbered dialogue — club meeting arrangements.",
			altText:
				"Six alternating spoken lines prefixed by speaker initials R or P about fixing a venue and time for a debate practice.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Rohan: We still haven’t locked the hall for Friday’s debate practice." },
					{ number: 2, text: "Priya: Main auditorium is booked. Could we use the seminar room instead?" },
					{ number: 3, text: "Rohan: Only if we finish by five — the robotics club needs it after." },
					{ number: 4, text: "Priya: Five works. I’ll ask Mrs. Nair for the key and the projector." },
					{ number: 5, text: "Rohan: I’ll print the motion briefs and bring spare markers." },
					{ number: 6, text: "Priya: Perfect — see you ten minutes early to set the chairs." },
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Complete the email by filling in the conventional subject line and closing requested in lines 4 and 9.",
		topicKeywords: ["email writing", "professional communication", "formal english"],
		visual: {
			caption: "Email skeleton — formal request to the librarian.",
			altText:
				"Nine numbered lines from recipient through subject, greeting, short body about borrowing references, sign-off, and sender block with placeholders.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "To: librarian@greenfieldschool.edu.in" },
					{ number: 2, text: "Cc:" },
					{ number: 3, text: "Dear Sir/Madam," },
					{ number: 4, text: "Subject: _______________________________________________" },
					{
						number: 5,
						text: "I am a student of Class XI-A preparing a project on renewable energy policy. Kindly allow me to borrow two reference titles from the stacks for one week beginning _______________.",
					},
					{ number: 6, text: "The books I require are: (i) _______________ (ii) _______________" },
					{ number: 7, text: "I will abide by all library rules regarding issue and return." },
					{ number: 8, text: "Thank you for your assistance." },
					{ number: 9, text: "_______________________________________________" },
					{ number: 10, text: "Arjun Mehta" },
					{ number: 11, text: "Class XI-A | Roll No. _______________" },
				],
			},
		},
		subjects: ["english"],
	},

	// ───────────────────────────────────────────────────────────────────────
	// SCIENCE (Grades 6-10)
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Name the process by which green plants prepare their own food using sunlight.",
		topicKeywords: ["photosynthesis", "nutrition in plants", "plant nutrition"],
		visual: null,
		subjects: ["science"],
	},
	{
		stem: "The table compares three types of microorganisms. Which type is used to make bread rise?",
		topicKeywords: ["microorganisms yeast", "fermentation basics", "table reading"],
		visual: {
			caption: "Comparison of bacteria, fungi, and viruses.",
			altText:
				"Four-column table with rows for Bacteria, Fungi, and Virus; columns show cell type, approximate size, and one example for each.",
			spec: {
				kind: "data_table",
				caption: "Microorganism comparison",
				headers: ["Type", "Cell Type", "Size (approx.)", "Example"],
				rows: [
					[
						{ value: "Bacteria", bold: false, align: "left" },
						{ value: "Prokaryote", bold: false, align: "left" },
						{ value: "1-10 µm", bold: false, align: "right" },
						{ value: "Lactobacillus", bold: false, align: "left" },
					],
					[
						{ value: "Fungi", bold: false, align: "left" },
						{ value: "Eukaryote", bold: false, align: "left" },
						{ value: "2-200 µm", bold: false, align: "right" },
						{ value: "Yeast", bold: false, align: "left" },
					],
					[
						{ value: "Virus", bold: false, align: "left" },
						{ value: "Acellular", bold: false, align: "left" },
						{ value: "20-300 nm", bold: false, align: "right" },
						{ value: "Influenza", bold: false, align: "left" },
					],
				],
			},
		},
		subjects: ["science"],
	},
];

const ADDED_VISUAL_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	{
		stem: "In the figure, PA and PB are tangents to a circle with centre O. Which radius is perpendicular to tangent PA at A?",
		topicKeywords: ["circle theorem", "tangent radius", "perpendicular"],
		visual: {
			caption: "Tangents from external point P touch the circle at A and B.",
			altText:
				"Circle with centre O, external point P, and two tangents touching at A and B. Radii OA and OB join the centre to points of contact, with a right-angle marker at A between OA and PA.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -7, xMax: 7, yMin: -6, yMax: 8, showGrid: false, showAxes: false },
				primitives: [
					{ type: "circle", center: { x: 0, y: 0 }, radius: 3.5, label: null },
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
					{ type: "point", at: { x: -2.2, y: 2.7 }, label: "A" },
					{ type: "point", at: { x: 2.2, y: 2.7 }, label: "B" },
					{ type: "point", at: { x: 0, y: 6.2 }, label: "P" },
					{ type: "segment", from: { x: 0, y: 6.2 }, to: { x: -2.2, y: 2.7 }, label: "PA", dashed: false },
					{ type: "segment", from: { x: 0, y: 6.2 }, to: { x: 2.2, y: 2.7 }, label: "PB", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: -2.2, y: 2.7 }, label: "OA", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 2.2, y: 2.7 }, label: "OB", dashed: false },
					{
						type: "angle_marker",
						vertex: { x: -2.2, y: 2.7 },
						fromRayPoint: { x: -1.2, y: 1.5 },
						toRayPoint: { x: -1.1, y: 4.1 },
						label: "90°",
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "A 20 m pole casts a 15 m shadow as shown. Find the angle of elevation of the Sun.",
		topicKeywords: ["height and distance", "trigonometry", "angle of elevation"],
		visual: {
			caption: "Right triangle model for height and shadow.",
			altText:
				"Vertical pole of 20 m at one end of a 15 m horizontal shadow forms a right triangle. The angle of elevation is marked at the shadow tip.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 18, yMin: -1, yMax: 23, showGrid: true, showAxes: false },
				primitives: [
					{ type: "point", at: { x: 0, y: 0 }, label: "B" },
					{ type: "point", at: { x: 0, y: 20 }, label: "A" },
					{ type: "point", at: { x: 15, y: 0 }, label: "C" },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 0, y: 20 }, label: "20 m", dashed: false },
					{ type: "segment", from: { x: 0, y: 0 }, to: { x: 15, y: 0 }, label: "15 m", dashed: false },
					{ type: "segment", from: { x: 15, y: 0 }, to: { x: 0, y: 20 }, label: null, dashed: false },
					{
						type: "angle_marker",
						vertex: { x: 15, y: 0 },
						fromRayPoint: { x: 0, y: 0 },
						toRayPoint: { x: 0, y: 20 },
						label: "θ",
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "From the feasible region shown, identify the corner point where objective Z = 3x + 2y is maximised.",
		topicKeywords: ["linear programming", "feasible region", "corner point"],
		visual: {
			caption: "Feasible region for a two-variable LPP.",
			altText:
				"Coordinate plane with three boundary lines and a shaded polygonal feasible region in first quadrant. Corner points are labelled for objective evaluation.",
			spec: {
				kind: "math_geometry",
				view: { xMin: -1, xMax: 10, yMin: -1, yMax: 10, showGrid: true, showAxes: true },
				primitives: [
					{ type: "segment", from: { x: 0, y: 8 }, to: { x: 8, y: 0 }, label: "x + y = 8", dashed: false },
					{ type: "segment", from: { x: 0, y: 6 }, to: { x: 9, y: 0 }, label: "2x + 3y = 18", dashed: false },
					{ type: "segment", from: { x: 2, y: 0 }, to: { x: 2, y: 8 }, label: "x = 2", dashed: true },
					{
						type: "polygon",
						vertices: [
							{ x: 2, y: 0 },
							{ x: 8, y: 0 },
							{ x: 5.4, y: 2.6 },
							{ x: 2, y: 4.6 },
						],
						label: "Feasible region",
						filled: true,
					},
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "In the inclined pulley setup, compare the magnitudes of tension T and component mg sinθ along the slope.",
		topicKeywords: ["inclined plane", "tension", "free body diagram"],
		visual: {
			caption: "Block on incline with tension and weight components.",
			altText:
				"Free-body diagram of a block on a rough incline showing tension up the plane, normal reaction perpendicular to plane, and weight downward with component decomposition.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "m",
				inclineDeg: 30,
				forces: [
					{ name: "T", magnitude: 12, angleDeg: 30 },
					{ name: "N", magnitude: 17, angleDeg: 120 },
					{ name: "mg", magnitude: 20, angleDeg: -90 },
				],
			},
		},
		subjects: ["physics"],
	},
	{
		stem: "Use the RC discharge graph to estimate the time constant τ from the decay pattern.",
		topicKeywords: ["rc circuit", "discharge", "time constant", "exponential decay"],
		visual: {
			caption: "Capacitor voltage during RC discharge.",
			altText:
				"Voltage-time plot with exponential decay from initial V0 toward zero; horizontal axis in seconds and vertical axis in volts.",
			spec: {
				kind: "math_function_plot",
				xMin: 0,
				xMax: 10,
				yMin: 0,
				yMax: 12,
				xLabel: "Time (s)",
				yLabel: "Voltage (V)",
				items: [{ expr: "10 * exp(-x / 2)", color: "primary", label: "V(t)" }],
			},
		},
		subjects: ["physics"],
	},
	{
		stem: "In the reversible reaction shown, predict the direction of shift when pressure is increased.",
		topicKeywords: ["chemical equilibrium", "le chatelier", "reaction conditions"],
		visual: {
			caption: "Equilibrium reaction with catalyst and pressure condition.",
			altText:
				"Chemical equation with reversible arrow, catalyst note, and pressure/temperature condition written above the arrow.",
			spec: {
				kind: "chemistry_reaction",
				ce: "N2(g) + 3H2(g) <=>[\\text{Fe catalyst}][450^\\circ\\text{C},\\ 200\\ \\text{atm}] 2NH3(g)",
				label: "Haber process equilibrium",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Identify oxidizing and reducing agents in the reaction shown.",
		topicKeywords: ["redox reaction", "oxidation state", "agent identification"],
		visual: {
			caption: "Redox equation with ionic states.",
			altText:
				"Balanced ionic equation with aqueous and solid states shown to support oxidation-number analysis.",
			spec: {
				kind: "chemistry_reaction",
				ce: "Zn(s) + CuSO4(aq) -> ZnSO4(aq) + Cu(s)",
				label: "Single-displacement redox",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The molecule shown has one stereogenic center. Determine whether the shown form is one enantiomer of lactic acid.",
		topicKeywords: ["stereochemistry", "wedge dash", "enantiomer"],
		visual: {
			caption: "2D wedge-dash representation of lactic acid.",
			altText:
				"Lactic-acid skeleton with one chiral carbon represented using stereochemical wedge notation in the SMILES mapping.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "C[C@H](O)C(=O)O",
				display: "2d",
				label: "Lactic acid stereocentre",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Record the journal entry for share forfeiture where allotment and first call remain unpaid.",
		topicKeywords: ["share forfeiture", "journal entry", "company accounts"],
		visual: {
			caption: "Journal entry format for share forfeiture.",
			altText:
				"Journal table with debit and credit lines for Share Capital, Share Forfeiture, and Calls in Arrears in a forfeiture case.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-03-31",
						particulars: "Share Capital A/c Dr.\n  To Share Forfeiture A/c\n  To Share Allotment A/c\n  To Share First Call A/c",
						debit: 100000,
						credit: 100000,
						narration: "Being shares forfeited on non-payment of allotment and first call.",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Which side of the revaluation account records the increase in value of machinery?",
		topicKeywords: ["revaluation account", "partnership accounts", "ledger treatment"],
		visual: {
			caption: "Revaluation account ledger format.",
			altText:
				"T-account style ledger with debit and credit columns for revaluation adjustments during partner admission.",
			spec: {
				kind: "accountancy_table",
				subKind: "ledger",
				ledger: {
					accountName: "Revaluation A/c",
					debitSide: [
						{
							date: "2026-03-31",
							particulars: "To Machinery A/c",
							amount: 40000,
						},
					],
					creditSide: [
						{
							date: "2026-03-31",
							particulars: "By General Reserve A/c",
							amount: 25000,
						},
					],
				},
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "In the market diagram, identify the segment representing excess supply at the imposed price floor.",
		topicKeywords: ["price floor", "market intervention", "excess supply"],
		visual: {
			caption: "Demand-supply diagram with a binding price floor.",
			altText:
				"Demand and supply curves with a horizontal price-floor line above equilibrium, creating a gap between quantity supplied and quantity demanded.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity",
				yLabel: "Price (₹)",
				xMin: 0,
				xMax: 120,
				yMin: 0,
				yMax: 100,
				curves: [
					{ expr: "90 - 0.5 * p", color: "primary", label: "Demand" },
					{ expr: "0.6 * p + 5", color: "secondary", label: "Supply" },
					{ expr: "65", color: "muted", label: "Price floor" },
				],
				marks: [{ x: 58, y: 65, label: "Excess supply" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the budget line shown to identify one affordable consumption bundle.",
		topicKeywords: ["budget line", "consumer choice", "microeconomics"],
		visual: {
			caption: "Budget line between two goods with intercepts on both axes.",
			altText:
				"Straight downward budget line joining maximum quantities of two goods purchasable with fixed income; axis intercepts marked.",
			spec: {
				kind: "economics_curve",
				xLabel: "Good X (units)",
				yLabel: "Good Y (units)",
				xMin: 0,
				xMax: 60,
				yMin: 0,
				yMax: 80,
				curves: [{ expr: "72 - 1.2 * p", color: "primary", label: "Budget line" }],
				marks: [{ x: 20, y: 48, label: "Bundle A" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Read the factual passage and choose the statement best supported by the data in it.",
		topicKeywords: ["reading comprehension", "factual passage", "english prose"],
		visual: {
			caption: "Factual passage with two short paragraphs.",
			altText:
				"Informational prose passage describing urban water usage trends and conservation measures in concise academic style.",
			spec: {
				kind: "english_passage",
				title: "Urban Water Use Snapshot",
				source: null,
				lines: [
					{
						number: 1,
						text: "City records show domestic water demand rose by 8% over five years.",
					},
					{
						number: 2,
						text: "Leakage losses fell after pipeline audits in the same period.",
					},
					{
						number: 3,
						text: "Households using low-flow fixtures consumed less water per person.",
					},
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "From the dialogue excerpt, infer the speaker’s attitude in line 3.",
		topicKeywords: ["dialogue", "tone", "english language"],
		visual: {
			caption: "Short dialogue excerpt for tone inference.",
			altText:
				"Conversation between two speakers with stage-like line breaks, suitable for tone and intent analysis questions.",
			spec: {
				kind: "english_passage",
				title: "After the Announcement",
				source: null,
				lines: [
					{ number: 1, text: "Riya: You sounded certain this plan would fail." },
					{
						number: 2,
						text: "Kabir: I did, but the numbers changed after the trial run.",
					},
					{
						number: 3,
						text: "Riya: So now you're cautiously optimistic?",
					},
					{
						number: 4,
						text: "Kabir: Optimistic, yes—cautious, definitely.",
					},
				],
			},
		},
		subjects: ["english"],
	},
	{
		stem: "Classify each organism in the table into vertebrate or invertebrate.",
		topicKeywords: ["classification", "biology basics", "science table"],
		visual: {
			caption: "Classification table for selected organisms.",
			altText:
				"Three-column table listing organism name, key trait, and body organization to support vertebrate-invertebrate classification.",
			spec: {
				kind: "data_table",
				caption: "Organism classification",
				headers: ["Organism", "Key trait", "Group hint"],
				rows: [
					[
						{ value: "Earthworm", bold: false, align: "left" },
						{ value: "No backbone", bold: false, align: "left" },
						{ value: "Segmented body", bold: false, align: "left" },
					],
					[
						{ value: "Frog", bold: false, align: "left" },
						{ value: "Backbone present", bold: false, align: "left" },
						{ value: "Amphibian", bold: false, align: "left" },
					],
					[
						{ value: "Octopus", bold: false, align: "left" },
						{ value: "Soft body", bold: false, align: "left" },
						{ value: "Mollusc", bold: false, align: "left" },
					],
				],
			},
		},
		subjects: ["science", "biology"],
	},
];

export const VISUAL_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	...BASE_VISUAL_EXEMPLARS,
	...ADDED_VISUAL_EXEMPLARS,
].map(enrichVisualExemplar);

function enrichVisualExemplar(exemplar: VisualExemplar): VisualExemplar {
	const visual = exemplar.visual;
	if (visual == null) return exemplar;

	const tightened = tightenCaption(visual.caption);
	const spec = enrichSpec(exemplar, visual.spec);
	return {
		...exemplar,
		visual: {
			...visual,
			caption: tightened,
			spec,
		},
	};
}

function enrichSpec(
	exemplar: VisualExemplar,
	spec: NonNullable<VisualExemplar["visual"]>["spec"],
): NonNullable<VisualExemplar["visual"]>["spec"] {
	switch (spec.kind) {
		case "math_geometry": {
			const pointLabelMap = new Map<string, string>();
			for (const primitive of spec.primitives) {
				if (primitive.type === "point" && primitive.label) {
					pointLabelMap.set(coordKey(primitive.at), primitive.label);
				}
			}
			return {
				...spec,
				primitives: spec.primitives.map((primitive) => {
					switch (primitive.type) {
						case "point":
							return {
								...primitive,
								labelPosition:
									primitive.labelPosition ?? inferPointLabelPosition(primitive.at, spec.view),
							};
						case "segment":
							return {
								...primitive,
								tickMarks: primitive.tickMarks ?? null,
								arrowEnd: primitive.arrowEnd ?? false,
							};
						case "polygon":
							return {
								...primitive,
								vertexLabels:
									primitive.vertexLabels ??
									primitive.vertices.map((v) => pointLabelMap.get(coordKey(v)) ?? null),
							};
						case "arc":
							return {
								...primitive,
								radiusFraction: primitive.radiusFraction ?? null,
							};
						default:
							return primitive;
					}
				}),
			};
		}
		case "math_function_plot":
			return {
				...spec,
				xTickStep: spec.xTickStep ?? autoTickStep(spec.xMin, spec.xMax),
				yTickStep:
					spec.yTickStep ??
					(spec.yMin != null && spec.yMax != null
						? autoTickStep(spec.yMin, spec.yMax)
						: null),
				items: spec.items.map((item) => ({
					...item,
					label: item.label ?? humanizeExpr(item.expr),
				})),
			};
		case "number_line":
			return {
				...spec,
				axisLabel: spec.axisLabel ?? "x",
				minorTickStep:
					spec.minorTickStep ??
					(spec.tickStep >= 1 ? spec.tickStep / 2 : null),
			};
		case "physics_diagram": {
			switch (spec.subKind) {
				case "free_body":
					return {
						...spec,
						inclineLabel:
							spec.inclineLabel ??
							(spec.inclineDeg != null ? `${pretty(spec.inclineDeg)}°` : null),
						surfaceHatched: spec.surfaceHatched ?? (spec.inclineDeg != null),
						axisLegend: spec.axisLegend ?? true,
						forces: spec.forces.map((force) => ({
							...force,
							unit: force.unit ?? "N",
							showMagnitude: force.showMagnitude ?? true,
							componentArrows: force.componentArrows ?? false,
						})),
					};
				case "ray_optics":
					return {
						...spec,
						axisUnit: spec.axisUnit ?? "cm",
						axisTickStep: spec.axisTickStep ?? autoTickStep(spec.axisMin, spec.axisMax),
						axisMajorTickStep:
							spec.axisMajorTickStep ??
							autoTickStep(spec.axisMin, spec.axisMax) * 2,
						drawRays: spec.drawRays ?? true,
						objects: spec.objects.map((obj, idx) => ({
							...obj,
							label:
								obj.label ??
								(obj.kind === "object" ? `O${idx + 1}` : `I${idx + 1}`),
						})),
						lenses: spec.lenses.map((lens) => ({
							...lens,
							label: lens.label ?? lensLabel(lens.type),
						})),
					};
				case "circuit":
					return {
						...spec,
						components: spec.components.map((component) => {
							if (component.type === "battery") {
								return {
									...component,
									polarityMarks: component.polarityMarks ?? true,
									currentArrow: component.currentArrow ?? false,
								};
							}
							return {
								...component,
								currentArrow: component.currentArrow ?? false,
							};
						}),
					};
				default:
					return spec;
			}
		}
		case "economics_curve":
			return {
				...spec,
				marks: spec.marks.map((mark) => ({
					...mark,
					kind: inferEconomicsMarkKind(exemplar.stem, mark.label),
				})),
			};
		case "chemistry_molecule":
			return {
				...spec,
				display: "2d",
				label:
					exemplar.stem.includes("methane") && !spec.label
						? "Methane (2D structural view)"
						: spec.label,
			};
		default:
			return spec;
	}
}

function tightenCaption(caption: string): string {
	return caption
		.replace(/;\s*vertex at[^.]*\./i, ".")
		.replace(/;\s*root at[^.]*\./i, ".")
		.replace(/\s+/g, " ")
		.trim();
}

function coordKey(point: { x: number; y: number }): string {
	return `${point.x},${point.y}`;
}

function inferPointLabelPosition(
	point: { x: number; y: number },
	view: { xMin: number; xMax: number; yMin: number; yMax: number },
): "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" {
	const xMid = (view.xMin + view.xMax) / 2;
	const yMid = (view.yMin + view.yMax) / 2;
	if (point.x >= xMid && point.y >= yMid) return "ne";
	if (point.x < xMid && point.y >= yMid) return "nw";
	if (point.x >= xMid && point.y < yMid) return "se";
	return "sw";
}

function autoTickStep(min: number, max: number): number {
	const span = Math.abs(max - min);
	if (span <= 4) return 0.5;
	if (span <= 10) return 1;
	if (span <= 25) return 2;
	if (span <= 60) return 5;
	if (span <= 120) return 10;
	return 20;
}

function humanizeExpr(expr: string): string {
	const clean = expr.replace(/\s+/g, " ").trim();
	return clean.length > 40 ? `${clean.slice(0, 37)}...` : clean;
}

function lensLabel(
	type: "concave_mirror" | "convex_mirror" | "concave_lens" | "convex_lens",
): string {
	switch (type) {
		case "convex_lens":
			return "Convex lens";
		case "concave_lens":
			return "Concave lens";
		case "concave_mirror":
			return "Concave mirror";
		case "convex_mirror":
			return "Convex mirror";
		default:
			return type;
	}
}

function inferEconomicsMarkKind(
	stem: string,
	label: string,
): "point" | "vertical_line" {
	const lowerStem = stem.toLowerCase();
	const lowerLabel = label.toLowerCase();
	if (
		lowerStem.includes("quantity") ||
		lowerStem.includes("where mr intersects mc") ||
		lowerLabel.includes("q*")
	) {
		return "vertical_line";
	}
	return "point";
}

function pretty(n: number): string {
	if (Number.isInteger(n)) return String(n);
	return Number(n.toFixed(2)).toString();
}

function exemplarKindKey(ex: VisualExemplar): string {
	if (ex.visual === null) return "__null__";
	const s = ex.visual.spec;
	if (s.kind === "physics_diagram") {
		switch (s.subKind) {
			case "circuit": {
				const topo = [...s.components.map((c) => c.type)].sort().join(",");
				return `physics_diagram:circuit:${topo}`;
			}
			case "free_body": {
				const incline = s.inclineDeg == null ? "level" : `inc${s.inclineDeg}`;
				const forceSig = [...s.forces.map((f) => f.name)].sort().join("+");
				return `physics_diagram:free_body:${incline}:${forceSig}`;
			}
			case "ray_optics": {
				const lt = [...s.lenses.map((l) => l.type)].sort().join(",");
				const objSig = s.objects.map((o) => `${o.kind}@${o.x}@${o.height}`).join(";");
				return `physics_diagram:ray_optics:${lt}:${objSig}`;
			}
			default: {
				const _n: never = s;
				return `physics_diagram:${String(_n)}`;
			}
		}
	}
	if (s.kind === "math_function_plot") {
		return `math_function_plot:${s.items.map((i) => i.expr).join("|")}`;
	}
	if (s.kind === "math_geometry") {
		const brief = s.primitives
			.map((p) => {
				switch (p.type) {
					case "point":
						return `pt:${p.at.x},${p.at.y}`;
					case "segment":
						return `seg:${p.from.x},${p.from.y}-${p.to.x},${p.to.y}`;
					case "polygon":
						return `poly:${p.vertices.length}:${p.vertices.map((v) => `${v.x},${v.y}`).join(";")}`;
					case "vector":
						return `vec:${p.from.x},${p.from.y}-${p.to.x},${p.to.y}`;
					case "angle_marker":
						return `am:${p.vertex.x},${p.vertex.y}`;
					case "circle":
						return `circ:${p.center.x},${p.center.y}r${p.radius}`;
					case "arc":
						return `arc:${p.center.x},${p.center.y}r${p.radius}:${p.startAngleDeg}-${p.endAngleDeg}:m${p.minorArc === false ? "0" : "1"}`;
					default: {
						const _u: never = p;
						return String(_u);
					}
				}
			})
			.join("|");
		return `math_geometry:${brief}`;
	}
	if (s.kind === "number_line") {
		const pts = s.points.map((p) => `${p.value}`).join(",");
		const intv = s.intervals
			.map(
				(i) =>
					`${i.from}-${i.to}:${i.leftOpen ? "o" : "c"}${i.rightOpen ? "o" : "c"}`,
			)
			.join("|");
		return `number_line:${s.min}-${s.max}:${pts}:${intv}`;
	}
	if (s.kind === "data_table") {
		return `data_table:${s.headers.join("~")}`;
	}
	if (s.kind === "india_map") {
		const hs = [...(s.highlightedStates ?? [])].sort().join("+");
		const ms = s.mapStyle ?? "null";
		return `india_map:${ms}:${hs}`;
	}
	if (s.kind === "statistics_chart") {
		switch (s.subKind) {
			case "histogram":
				return `statistics_chart:histogram:${s.xLabel}`;
			case "bar":
				return `statistics_chart:bar:${s.xLabel}`;
			case "line":
				return `statistics_chart:line:${s.series.map((se) => se.name).join("+")}`;
			case "scatter":
				return `statistics_chart:scatter:${s.xLabel}`;
			case "pie":
				return `statistics_chart:pie:${[...s.slices.map((sl) => sl.label)].sort().join("+")}`;
			case "frequency_polygon":
				return `statistics_chart:frequency_polygon:${s.xLabel}`;
			case "ogive":
				return `statistics_chart:ogive:${s.cumulative}:${s.xLabel}`;
			case "box":
				return `statistics_chart:box:${s.groups.map((g) => g.name).join("+")}`;
			default: {
				const _e: never = s;
				void _e;
				return "statistics_chart:unknown";
			}
		}
	}
	if (s.kind === "accountancy_table") {
		switch (s.subKind) {
			case "journal_entry":
			case "rectification":
			case "cash_book":
				return `accountancy_table:${s.subKind}:${s.rows.map((r) => r.particulars).join("|")}`;
			case "ledger":
				return `accountancy_table:ledger:${s.ledger.accountName}:${s.ledger.debitSide.map((e) => e.particulars).join("|")}|${s.ledger.creditSide.map((e) => e.particulars).join("|")}`;
			case "trial_balance":
				return `accountancy_table:trial_balance:${s.rows.map((r) => r.particulars).join("|")}`;
			case "balance_sheet":
				return `accountancy_table:balance_sheet:${s.assetsSide.map((r) => r.particulars).join("|")}‖${s.equityAndLiabilitiesSide.map((r) => r.particulars).join("|")}`;
			case "p_and_l":
				return `accountancy_table:p_and_l:${s.rows.map((r) => r.particulars).join("|")}`;
			default: {
				const _a: never = s;
				void _a;
				return "accountancy_table:unknown";
			}
		}
	}
	return s.kind;
}

function exemplarPrimaryKind(ex: VisualExemplar): string {
	return ex.visual?.spec.kind ?? "__null__";
}

function exemplarMatchesTopicHint(ex: VisualExemplar, hintNorm: string): boolean {
	const kw = ex.topicKeywords;
	if (!kw || kw.length === 0 || !hintNorm.trim()) return false;
	const h = hintNorm.toLowerCase();
	return kw.some((k) => h.includes(k.toLowerCase()));
}

/** Prioritize exemplars whose keywords overlap the normalized hint (substring match). */
function orderPoolForTopicHints(items: VisualExemplar[], hintNorm?: string): VisualExemplar[] {
	const h = hintNorm?.trim().toLowerCase() ?? "";
	if (!h) return items;
	const hit: VisualExemplar[] = [];
	const miss: VisualExemplar[] = [];
	for (const ex of items) {
		(exemplarMatchesTopicHint(ex, h) ? hit : miss).push(ex);
	}
	return [...hit, ...miss];
}

export type PickExemplarsOptions = {
	/** Lowercase blob from selected topic names + unit/chapter titles (server-built). */
	topicHintNorm?: string;
};

/**
 * Subject-scoped subset selection: anchor with a null-visual example, then greedily
 * add exemplars that maximize visual-kind diversity first (`spec.kind`), followed by
 * finer variant diversity (`exemplarKindKey`). Matching-topic hints break ties so
 * chapter-aligned exemplars surface sooner without leaking cross-subject examples.
 */
export function pickExemplarsForSubject(
	subjectKey: VisualExemplar["subjects"][number],
	limit = 6,
	options?: PickExemplarsOptions,
): ReadonlyArray<VisualExemplar> {
	const hintNorm = options?.topicHintNorm;
	const matching = VISUAL_EXEMPLARS.filter((ex) => ex.subjects.includes(subjectKey));
	const maxPickCount = Math.max(1, limit);
	const anchor = matching.find((ex) => ex.visual === null) ?? matching[0];
	if (!anchor) return [];

	// Keep few-shots subject-locked to avoid cross-discipline leakage in prompts.
	const orderedPool = orderPoolForTopicHints(
		matching.filter((ex) => ex !== anchor),
		hintNorm,
	);

	const picked: VisualExemplar[] = [anchor];
	const seenPrimaryKinds = new Set<string>([exemplarPrimaryKind(anchor)]);
	const seenVariants = new Set<string>([exemplarKindKey(anchor)]);

	while (picked.length < maxPickCount && orderedPool.length > 0) {
		let bestIdx = 0;
		let bestComposite = -1;
		const h = hintNorm?.trim().toLowerCase() ?? "";
		for (let i = 0; i < orderedPool.length; i++) {
			const ex = orderedPool[i]!;
			const primaryKind = exemplarPrimaryKind(ex);
			const variantKey = exemplarKindKey(ex);
			const primaryKindDiversity = seenPrimaryKinds.has(primaryKind) ? 0 : 1;
			const variantDiversity = seenVariants.has(variantKey) ? 0 : 1;
			const topicBonus = h && exemplarMatchesTopicHint(ex, h) ? 1 : 0;
			const composite = primaryKindDiversity * 100 + topicBonus * 10 + variantDiversity * 3;
			if (composite > bestComposite) {
				bestComposite = composite;
				bestIdx = i;
			}
		}
		const next = orderedPool.splice(bestIdx, 1)[0]!;
		picked.push(next);
		seenPrimaryKinds.add(exemplarPrimaryKind(next));
		seenVariants.add(exemplarKindKey(next));
	}

	return picked.slice(0, maxPickCount);
}
