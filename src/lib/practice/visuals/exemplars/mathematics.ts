import type { VisualExemplar } from "../exemplars-type";

export const MATHEMATICS_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
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

];
