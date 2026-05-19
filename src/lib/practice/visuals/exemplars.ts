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

import type { VisualExemplar } from "./exemplars-type";
export type { VisualExemplar };

import { ALL_EXEMPLARS } from "./exemplars/index";

export const VISUAL_EXEMPLARS: ReadonlyArray<VisualExemplar> = ALL_EXEMPLARS.map(enrichVisualExemplar);

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
