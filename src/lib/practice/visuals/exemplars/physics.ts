import type { VisualExemplar } from "../exemplars-type";

export const PHYSICS_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
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

];
