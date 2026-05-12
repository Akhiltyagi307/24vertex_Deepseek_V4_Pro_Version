import { describe, expect, it } from "vitest";

import { buildDeterministicFallbackVisual } from "../fallback-visual";

describe("buildDeterministicFallbackVisual", () => {
	it("builds a schema-valid data table fallback when available", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "A car moves 20 m in 4 s. Find the speed.",
			preferredKind: "data_table",
			allowedKinds: ["physics_diagram", "data_table", "math_function_plot"],
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("data_table");
	});

	it("uses preferred kind ordering when the preferred kind is allowed", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "Plot the relation between x and y.",
			preferredKind: "math_function_plot",
			allowedKinds: ["data_table", "math_function_plot"],
			visualIdea: "Cartesian axes with a straight-line graph showing y growing linearly with x for qualitative reading.",
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("math_function_plot");
	});

	it("returns null when no allowed kind can be synthesized", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "Explain osmosis in your own words.",
			preferredKind: null,
			allowedKinds: [],
		});
		expect(visual).toBeNull();
	});

	it("uses grounded-only fallback synthesis when strict grounding is enabled", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "A body has masses 2 kg and 5 kg connected by a string.",
			preferredKind: "number_line",
			allowedKinds: ["number_line", "math_function_plot"],
			strictGrounding: true,
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("number_line");
	});

	it("uses a mechanics diagram informed by blueprint visual_idea when enrichment did not run", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText:
				"State the free-body-diagram method for a mechanics problem involving connected bodies. Keep your answer brief.",
			preferredKind: "physics_diagram",
			allowedKinds: ["physics_diagram", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea:
				"Two blocks on a smooth table linked by a light string over a pulley edge; separate FBD sketches implied (tensions, weights, normals).",
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("physics_diagram");
		if (visual?.spec.kind === "physics_diagram") {
			expect(visual.spec.subKind).toBe("free_body");
		}
		expect(visual?.caption).toContain("Two blocks");
	});

	it("routes circuit briefs to a circuit fallback, not a generic FBD", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "Calculate the equivalent resistance between terminals A and B.",
			preferredKind: "physics_diagram",
			allowedKinds: ["physics_diagram", "data_table"],
			strictGrounding: true,
			visualIdea: "Parallel resistor pair connected across a 6 V battery with clear branch nodes.",
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("physics_diagram");
		if (visual?.spec.kind === "physics_diagram") {
			expect(visual.spec.subKind).toBe("circuit");
		}
	});

	it("builds kinematics component visuals instead of generic free-body diagrams", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText:
				"A projectile is launched with initial velocity components v0x and v0y. Which statement is correct for ideal projectile motion?",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea:
				"Projectile path with initial velocity vector split into horizontal v0x and vertical v0y components.",
		});

		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("math_geometry");
		expect(visual?.caption).toMatch(/component|projectile|velocity/i);
		if (visual?.spec.kind === "math_geometry") {
			const labels = JSON.stringify(visual.spec.primitives);
			expect(labels).toMatch(/v_?0?x|v_x/i);
			expect(labels).toMatch(/v_?0?y|v_y/i);
		}
	});

	it("builds work/friction force-displacement visuals with the named forces", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText:
				"A 2 kg block starts from rest on a table. A horizontal force of 7 N acts on it, and the coefficient of kinetic friction is 0.1.",
			preferredKind: "physics_diagram",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea:
				"Block moving right on a horizontal table with applied force to the right, kinetic friction to the left, normal up, and weight down.",
		});

		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("physics_diagram");
		if (visual?.spec.kind === "physics_diagram" && visual.spec.subKind === "free_body") {
			const forceNames = visual.spec.forces.map((force) => force.name.toLowerCase()).join(" ");
			expect(forceNames).toMatch(/f|applied/);
			expect(forceNames).toMatch(/friction|f_k/);
			expect(forceNames).toMatch(/n/);
			expect(forceNames).toMatch(/w|mg/);
		}
	});

	it("builds chemistry equilibrium reaction visuals from the actual stem", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText:
				"For BaSO4(s) ⇌ Ba2+(aq) + SO4 2-(aq), the solubility product expression is ______.",
			preferredKind: "chemistry_reaction",
			allowedKinds: ["chemistry_reaction", "chemistry_molecule", "data_table"],
			strictGrounding: true,
			visualIdea: "Dissolution equilibrium equation for BaSO4 and its ions.",
		});

		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("chemistry_reaction");
		if (visual?.spec.kind === "chemistry_reaction") {
			expect(visual.spec.ce).toContain("BaSO4");
			expect(visual.spec.ce).toMatch(/<=>|⇌/);
		}
	});

	it("does not invent molecule scaffolds for equilibrium-expression stems", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "For H2(g) + I2(g) ⇌ 2HI(g), complete the equilibrium expression Kc = ______.",
			preferredKind: "chemistry_molecule",
			allowedKinds: ["chemistry_molecule"],
			strictGrounding: true,
			visualIdea: "Equilibrium expression for hydrogen iodide formation.",
		});

		expect(visual).toBeNull();
	});

	it("routes gravitation briefs to geometry visuals, not generic free-body diagrams", () => {
		const depthVisual = buildDeterministicFallbackVisual({
			questionText:
				"A point is at a depth d = R_E/2 below Earth's surface. What fraction of surface gravity acts there?",
			preferredKind: "physics_diagram",
			allowedKinds: ["physics_diagram", "math_geometry", "data_table"],
			strictGrounding: true,
			visualIdea:
				"Cutaway Earth diagram with center C, surface radius R_E, and a point halfway toward the center at depth d.",
		});
		expect(depthVisual).not.toBeNull();
		expect(depthVisual?.spec.kind).toBe("math_geometry");
		expect(depthVisual?.caption).toMatch(/Earth|depth|radius/i);

		const neutralPointVisual = buildDeterministicFallbackVisual({
			questionText: "In the two-sphere example, why is it enough for the projectile to reach the neutral point N?",
			preferredKind: "physics_diagram",
			allowedKinds: ["physics_diagram", "math_geometry", "data_table"],
			strictGrounding: true,
			visualIdea: "Two spheres on a line with a marked neutral point N between them.",
		});
		expect(neutralPointVisual).not.toBeNull();
		expect(neutralPointVisual?.spec.kind).toBe("math_geometry");
		if (neutralPointVisual?.spec.kind === "math_geometry") {
			expect(
				neutralPointVisual.spec.primitives.some(
					(primitive) => "label" in primitive && primitive.label === "N",
				),
			).toBe(true);
		}
	});

	it("prioritizes depth cues in the question over an incorrect escape visual idea", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText:
				"A body weighs 250 N on the surface of Earth. Halfway down to the centre, its weight is ______ N.",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Escape-path sketch from a planet surface toward a far point.",
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("math_geometry");
		expect(visual?.caption).toMatch(/depth|cutaway|enclosed|Earth/i);
		expect(visual?.caption).not.toMatch(/escape/i);
	});

	it("prioritizes gravitation stem category over an incorrect blueprint visual idea", () => {
		const depthVisual = buildDeterministicFallbackVisual({
			questionText: "Inside a uniform Earth model, at what factor of surface gravity is g at depth d below the surface?",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Two spheres on a line with a marked neutral point N between them.",
		});
		expect(depthVisual).not.toBeNull();
		expect(depthVisual?.caption).toMatch(/cutaway|depth/i);
		expect(depthVisual?.caption).not.toMatch(/neutral/i);

		const escapeVisual = buildDeterministicFallbackVisual({
			questionText: "Explain why an object launched with exactly escape speed reaches infinity with zero speed.",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Earth cutaway showing surface, centre, and an interior point at depth d.",
		});
		expect(escapeVisual).not.toBeNull();
		expect(escapeVisual?.caption).toMatch(/escape/i);
		expect(escapeVisual?.caption).not.toMatch(/depth/i);
	});

	it("keeps height and v_esc stems from falling back to stale depth ideas", () => {
		const heightVisual = buildDeterministicFallbackVisual({
			questionText: "For a small height h above Earth, the first-order relation is g(h) = g(______).",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Nested Earth cross-section showing the enclosed region at depth d.",
		});
		expect(heightVisual).not.toBeNull();
		expect(heightVisual?.caption).toMatch(/altitude|above/i);
		expect(heightVisual?.caption).not.toMatch(/depth|enclosed/i);

		const escapeFormulaVisual = buildDeterministicFallbackVisual({
			questionText: "The escape-speed formula from a body of mass M and radius R is v_esc = ______.",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Earth cutaway showing surface, centre, and an interior point at depth d.",
		});
		expect(escapeFormulaVisual).not.toBeNull();
		expect(escapeFormulaVisual?.caption).toMatch(/escape/i);
		expect(escapeFormulaVisual?.caption).not.toMatch(/depth/i);

		const surfaceGravityFormulaVisual = buildDeterministicFallbackVisual({
			questionText: "Which relation gives the escape speed from the surface of a planet of radius R and surface gravity g?",
			preferredKind: "math_geometry",
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
			strictGrounding: true,
			visualIdea: "Earth cutaway showing surface, centre, and an interior point at depth d.",
		});
		expect(surfaceGravityFormulaVisual).not.toBeNull();
		expect(surfaceGravityFormulaVisual?.caption).toMatch(/escape/i);
		expect(surfaceGravityFormulaVisual?.caption).not.toMatch(/depth/i);
	});

	it("synthesizes schema-valid template family fallbacks when explicitly preferred", () => {
		const cell = buildDeterministicFallbackVisual({
			questionText: "In the galvanic cell shown below, identify the anode.",
			preferredKind: "chemistry_cell_diagram",
			allowedKinds: ["chemistry_cell_diagram"],
			strictGrounding: false,
			visualIdea: "Zn-Cu galvanic cell with salt bridge and electron flow from zinc anode to copper cathode.",
		});
		expect(cell).not.toBeNull();
		expect(cell?.spec.kind).toBe("chemistry_cell_diagram");

		const source = buildDeterministicFallbackVisual({
			questionText: "Read the source extract and identify the civic principle.",
			preferredKind: "source_extract",
			allowedKinds: ["source_extract"],
			strictGrounding: false,
			visualIdea: "Short line-numbered constitutional source extract about equality before law.",
		});
		expect(source).not.toBeNull();
		expect(source?.spec.kind).toBe("source_extract");
	});

	it("falls through to physics when data_table has no numeric givens and blueprint asks mechanics", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "Explain why convection transfers heat in a fluid.",
			preferredKind: "data_table",
			allowedKinds: ["data_table", "physics_diagram", "math_function_plot"],
			strictGrounding: true,
			visualIdea: "Fluid parcel with weight and buoyant force arrows for vertical equilibrium discussion.",
		});
		expect(visual).not.toBeNull();
		expect(visual?.spec.kind).toBe("physics_diagram");
		expect(visual?.caption).toContain("Fluid");
	});

	it("does not embed prose stems in data_table fallback", () => {
		const visual = buildDeterministicFallbackVisual({
			questionText: "Define terminal velocity in one sentence.",
			preferredKind: "data_table",
			allowedKinds: ["data_table"],
			strictGrounding: false,
		});
		expect(visual).toBeNull();
	});
});
