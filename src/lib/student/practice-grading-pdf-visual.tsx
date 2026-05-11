import {
	Circle,
	G,
	Line,
	Path,
	Polygon,
	Polyline,
	Rect,
	StyleSheet,
	Svg,
	Text,
	View,
} from "@react-pdf/renderer";
import india from "@svg-maps/india";
import type { ReactElement, ReactNode } from "react";

import { parseSvgViewBox, type IndiaMapLocationId } from "@/lib/practice/visuals/india-map-regions";
import {
	INDIA_MAP_ATTRIBUTION,
	indiaMapOceanFill,
	indiaRegionPaint,
	normalizeIndiaMapStyle,
} from "@/lib/practice/visuals/india-map-paint";
import { sampleArcPolyline } from "@/lib/practice/visuals/math-geometry-arc";

import type {
	AccountancyTableSpec,
	ChemistryMoleculeSpec,
	ChemistryReactionSpec,
	DataTableSpec,
	EconomicsCurveSpec,
	EnglishPassageSpec,
	IndiaMapSpec,
	MathFunctionPlotSpec,
	MathGeometrySpec,
	NumberLineSpec,
	PhysicsDiagramSpec,
	QuestionVisualEnvelope,
	StatisticsChartSpec,
} from "@/lib/practice/visuals/types";

/**
 * PDF-side visual dispatcher. Mirrors the on-screen `<QuestionVisual />`
 * but maps the QuestionVisualEnvelope onto @react-pdf primitives instead
 * of the React-DOM renderers (Mafs / function-plot / smiles-drawer / etc.).
 *
 * Coverage in v1:
 *   - HIGH fidelity (native SVG/View): math_geometry, number_line,
 *     physics_diagram (all subKinds), accountancy_table, data_table,
 *     english_passage, india_map, statistics_chart (histogram, bar, line, scatter,
 *     frequency_polygon, ogive).
 *   - TEXT fallback (caption + altText + raw spec string): chemistry_molecule
 *     (no SMILES parser in PDF), chemistry_reaction (no KaTeX/mhchem in
 *     PDF), math_function_plot, economics_curve (no expression evaluator
 *     in PDF), statistics_chart (pie, box).
 *
 * Every kind always produces SOMETHING for the PDF — students never see a
 * blank "visual referenced but missing" gap. Bad/legacy specs are caught
 * by `parseStoredQuestionVisualFromMetadata` upstream and arrive here as
 * `null`, which collapses to no rendering.
 */

const PDF_VISUAL_WIDTH = 360;
const PDF_VISUAL_HEIGHT = 220;

/** Height scales with @svg-maps/india aspect ratio when rendered at PDF_VISUAL_WIDTH. */
function indiaMapPdfHeight(): number {
	const { vw, vh } = parseSvgViewBox(india.viewBox);
	return vw > 0 ? Math.round((vh / vw) * PDF_VISUAL_WIDTH) : 410;
}

// Design-token hex literals. Matches the on-screen palette closely enough
// for visual recognition; the PDF stays consistent across light/dark since
// Adobe Reader has no theme.
const TOKEN = {
	foreground: "#0f172a",
	muted: "#64748b",
	border: "#cbd5e1",
	primary: "#3b82f6",
	secondary: "#10b981",
	accent: "#f59e0b",
	red: "#ef4444",
	cardBg: "#f8fafc",
} as const;

const styles = StyleSheet.create({
	wrapper: {
		marginTop: 6,
		padding: 8,
		borderWidth: 1,
		borderColor: TOKEN.border,
		borderRadius: 4,
		backgroundColor: TOKEN.cardBg,
	},
	caption: {
		fontSize: 9,
		color: TOKEN.muted,
		marginTop: 6,
		textAlign: "center",
	},
	fallbackTitle: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: TOKEN.foreground,
		marginBottom: 4,
	},
	fallbackBody: {
		fontSize: 9,
		color: TOKEN.foreground,
	},
	fallbackCode: {
		marginTop: 4,
		padding: 4,
		fontSize: 8,
		fontFamily: "Courier",
		color: TOKEN.foreground,
		backgroundColor: "#e2e8f0",
		borderRadius: 2,
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: TOKEN.border,
		paddingTop: 3,
		paddingBottom: 3,
	},
	tableHeader: {
		fontFamily: "Helvetica-Bold",
		fontSize: 9,
		color: TOKEN.foreground,
	},
	tableCell: {
		fontSize: 9,
		color: TOKEN.foreground,
		paddingHorizontal: 4,
	},
	passageLine: {
		flexDirection: "row",
		marginTop: 2,
	},
	passageNumber: {
		width: 22,
		fontSize: 9,
		color: TOKEN.muted,
		fontFamily: "Courier",
		textAlign: "right",
		paddingRight: 6,
	},
	passageText: {
		flex: 1,
		fontSize: 9,
		color: TOKEN.foreground,
	},
});

export function QuestionVisualPdf({
	visual,
}: {
	visual: QuestionVisualEnvelope | null;
}): ReactElement | null {
	if (!visual) return null;
	return (
		<View style={styles.wrapper} wrap={false}>
			<RenderSpec visual={visual} />
			<Text style={styles.caption}>{visual.caption}</Text>
		</View>
	);
}

function RenderSpec({ visual }: { visual: QuestionVisualEnvelope }): ReactElement {
	const spec = visual.spec;
	switch (spec.kind) {
		case "math_geometry":
			return <MathGeometryPdf spec={spec} />;
		case "math_function_plot":
			return <FallbackBlock title="Function plot" altText={visual.altText} bodyLines={spec.items.map((i) => i.expr)} />;
		case "number_line":
			return <NumberLinePdf spec={spec} />;
		case "physics_diagram":
			return <PhysicsDiagramPdf spec={spec} />;
		case "chemistry_molecule":
			return <ChemistryMoleculePdf spec={spec} altText={visual.altText} />;
		case "chemistry_reaction":
			return <ChemistryReactionPdf spec={spec} altText={visual.altText} />;
		case "accountancy_table":
			return <AccountancyTablePdf spec={spec} />;
		case "economics_curve":
			return <EconomicsCurvePdf spec={spec} altText={visual.altText} />;
		case "statistics_chart":
			return <StatisticsChartPdf spec={spec} altText={visual.altText} />;
		case "data_table":
			return <DataTablePdf spec={spec} />;
		case "india_map":
			return <IndiaMapPdf spec={spec} />;
		case "english_passage":
			return <EnglishPassagePdf spec={spec} />;
	}
}

// ───────────────────────────────────────────────────────────────────────
// math_geometry
// ───────────────────────────────────────────────────────────────────────

function MathGeometryPdf({ spec }: { spec: MathGeometrySpec }): ReactElement {
	const { view, primitives } = spec;
	const range = {
		x: view.xMax - view.xMin,
		y: view.yMax - view.yMin,
	};
	if (range.x <= 0 || range.y <= 0) {
		return <FallbackBlock title="Geometry" altText="Range invalid; visual omitted." />;
	}
	const padding = 16;
	const innerW = PDF_VISUAL_WIDTH - 2 * padding;
	const innerH = PDF_VISUAL_HEIGHT - 2 * padding;
	const xToScreen = (x: number): number => padding + ((x - view.xMin) / range.x) * innerW;
	const yToScreen = (y: number): number => padding + (1 - (y - view.yMin) / range.y) * innerH;

	return (
		<Svg width={PDF_VISUAL_WIDTH} height={PDF_VISUAL_HEIGHT}>
			{view.showGrid ? <Grid view={view} xToScreen={xToScreen} yToScreen={yToScreen} /> : null}
			{view.showAxes ? <Axes view={view} xToScreen={xToScreen} yToScreen={yToScreen} /> : null}
			{primitives.map((p, idx) => renderGeometryPrimitive(p, idx, xToScreen, yToScreen))}
		</Svg>
	);
}

function Grid({
	view,
	xToScreen,
	yToScreen,
}: {
	view: MathGeometrySpec["view"];
	xToScreen: (x: number) => number;
	yToScreen: (y: number) => number;
}): ReactElement {
	const lines: ReactElement[] = [];
	const step = 1;
	for (let x = Math.ceil(view.xMin); x <= view.xMax; x += step) {
		lines.push(
			<Line
				key={`gx-${x}`}
				x1={xToScreen(x)}
				y1={yToScreen(view.yMin)}
				x2={xToScreen(x)}
				y2={yToScreen(view.yMax)}
				stroke={TOKEN.border}
				strokeWidth={0.3}
			/>,
		);
	}
	for (let y = Math.ceil(view.yMin); y <= view.yMax; y += step) {
		lines.push(
			<Line
				key={`gy-${y}`}
				x1={xToScreen(view.xMin)}
				y1={yToScreen(y)}
				x2={xToScreen(view.xMax)}
				y2={yToScreen(y)}
				stroke={TOKEN.border}
				strokeWidth={0.3}
			/>,
		);
	}
	return <G>{lines}</G>;
}

function Axes({
	view,
	xToScreen,
	yToScreen,
}: {
	view: MathGeometrySpec["view"];
	xToScreen: (x: number) => number;
	yToScreen: (y: number) => number;
}): ReactElement {
	const x0 = Math.max(view.xMin, Math.min(view.xMax, 0));
	const y0 = Math.max(view.yMin, Math.min(view.yMax, 0));
	return (
		<G>
			<Line
				x1={xToScreen(view.xMin)}
				y1={yToScreen(y0)}
				x2={xToScreen(view.xMax)}
				y2={yToScreen(y0)}
				stroke={TOKEN.muted}
				strokeWidth={0.6}
			/>
			<Line
				x1={xToScreen(x0)}
				y1={yToScreen(view.yMin)}
				x2={xToScreen(x0)}
				y2={yToScreen(view.yMax)}
				stroke={TOKEN.muted}
				strokeWidth={0.6}
			/>
		</G>
	);
}

function renderGeometryPrimitive(
	p: MathGeometrySpec["primitives"][number],
	idx: number,
	xToScreen: (x: number) => number,
	yToScreen: (y: number) => number,
): ReactElement | null {
	switch (p.type) {
		case "point":
			return (
				<G key={`p-${idx}`}>
					<Circle
						cx={xToScreen(p.at.x)}
						cy={yToScreen(p.at.y)}
						r={3}
						fill={TOKEN.primary}
					/>
					{p.label ? (
						<Text
							x={xToScreen(p.at.x) + 5}
							y={yToScreen(p.at.y) - 5}
							style={{ fontSize: 9, fill: TOKEN.foreground }}
						>
							{p.label}
						</Text>
					) : null}
				</G>
			);
		case "segment":
			return (
				<Line
					key={`s-${idx}`}
					x1={xToScreen(p.from.x)}
					y1={yToScreen(p.from.y)}
					x2={xToScreen(p.to.x)}
					y2={yToScreen(p.to.y)}
					stroke={TOKEN.foreground}
					strokeWidth={1.2}
					strokeDasharray={p.dashed ? "3 2" : undefined}
				/>
			);
		case "polygon":
			return (
				<Polygon
					key={`g-${idx}`}
					points={p.vertices
						.map((v) => `${xToScreen(v.x)},${yToScreen(v.y)}`)
						.join(" ")}
					stroke={TOKEN.secondary}
					strokeWidth={1.2}
					fill={p.filled ? TOKEN.secondary : "none"}
					fillOpacity={p.filled ? 0.18 : 0}
				/>
			);
		case "vector":
			return (
				<Arrow
					key={`v-${idx}`}
					x1={xToScreen(p.from.x)}
					y1={yToScreen(p.from.y)}
					x2={xToScreen(p.to.x)}
					y2={yToScreen(p.to.y)}
					color={TOKEN.red}
				/>
			);
		case "angle_marker":
			return (
				<G key={`a-${idx}`}>
					<Line
						x1={xToScreen(p.vertex.x)}
						y1={yToScreen(p.vertex.y)}
						x2={xToScreen(p.fromRayPoint.x)}
						y2={yToScreen(p.fromRayPoint.y)}
						stroke={TOKEN.foreground}
						strokeWidth={1}
					/>
					<Line
						x1={xToScreen(p.vertex.x)}
						y1={yToScreen(p.vertex.y)}
						x2={xToScreen(p.toRayPoint.x)}
						y2={yToScreen(p.toRayPoint.y)}
						stroke={TOKEN.foreground}
						strokeWidth={1}
					/>
				</G>
			);
		case "circle":
			return (
				<Circle
					key={`c-${idx}`}
					cx={xToScreen(p.center.x)}
					cy={yToScreen(p.center.y)}
					r={Math.abs(xToScreen(p.center.x + p.radius) - xToScreen(p.center.x))}
					stroke={TOKEN.primary}
					strokeWidth={1.2}
					fill="none"
				/>
			);
		case "arc": {
			const minor = p.minorArc ?? true;
			const pts = sampleArcPolyline(
				p.center,
				p.radius,
				p.startAngleDeg,
				p.endAngleDeg,
				minor,
			);
			const mid = pts[Math.floor(pts.length / 2)]!;
			return (
				<G key={`arc-${idx}`}>
					<Polyline
						points={pts.map((pt) => `${xToScreen(pt.x)},${yToScreen(pt.y)}`).join(" ")}
						stroke={TOKEN.foreground}
						strokeWidth={1.2}
						fill="none"
						strokeDasharray={p.dashed ? "3 2" : undefined}
					/>
					{p.label ? (
						<Text
							x={xToScreen(mid.x) + 4}
							y={yToScreen(mid.y) - 4}
							style={{ fontSize: 9, fill: TOKEN.foreground }}
						>
							{p.label}
						</Text>
					) : null}
				</G>
			);
		}
		default:
			return null;
	}
}

/**
 * Arrow primitive — line + filled triangle at the tip. @react-pdf does
 * not support `marker-end`, so the arrowhead is a Polygon computed from
 * the segment direction.
 */
function Arrow({
	x1,
	y1,
	x2,
	y2,
	color,
	weight = 1.2,
}: {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
	weight?: number;
}): ReactElement {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.max(Math.hypot(dx, dy), 0.001);
	const ux = dx / len;
	const uy = dy / len;
	const headLen = 7;
	const headHalfW = 3.5;
	const baseX = x2 - ux * headLen;
	const baseY = y2 - uy * headLen;
	const px = -uy;
	const py = ux;
	const lineEndX = baseX + ux * 0.5;
	const lineEndY = baseY + uy * 0.5;
	return (
		<G>
			<Line x1={x1} y1={y1} x2={lineEndX} y2={lineEndY} stroke={color} strokeWidth={weight} />
			<Polygon
				points={`${x2},${y2} ${baseX + px * headHalfW},${baseY + py * headHalfW} ${baseX - px * headHalfW},${baseY - py * headHalfW}`}
				fill={color}
				stroke={color}
			/>
		</G>
	);
}

// ───────────────────────────────────────────────────────────────────────
// number_line
// ───────────────────────────────────────────────────────────────────────

function NumberLinePdf({ spec }: { spec: NumberLineSpec }): ReactElement {
	const range = spec.max - spec.min;
	if (range <= 0 || spec.tickStep <= 0) {
		return <FallbackBlock title="Number line" altText="Invalid range." />;
	}
	const W = PDF_VISUAL_WIDTH;
	const H = 80;
	const padding = 24;
	const axisY = 40;
	const innerW = W - 2 * padding;
	const xToScreen = (x: number): number => padding + ((x - spec.min) / range) * innerW;

	const ticks: number[] = [];
	for (let v = spec.min; v <= spec.max + 1e-9 && ticks.length < 200; v += spec.tickStep) {
		ticks.push(v);
	}

	return (
		<Svg width={W} height={H}>
			<Line
				x1={padding - 10}
				y1={axisY}
				x2={W - padding + 10}
				y2={axisY}
				stroke={TOKEN.foreground}
				strokeWidth={1}
			/>
			{ticks.map((t, i) => (
				<G key={`tick-${i}`}>
					<Line
						x1={xToScreen(t)}
						y1={axisY - 4}
						x2={xToScreen(t)}
						y2={axisY + 4}
						stroke={TOKEN.foreground}
						strokeWidth={0.8}
					/>
					<Text
						x={xToScreen(t) - 5}
						y={axisY + 16}
						style={{ fontSize: 8, fill: TOKEN.muted }}
					>
						{prettyTick(t)}
					</Text>
				</G>
			))}
			{spec.intervals.map((interval, i) => {
				const x1 = xToScreen(interval.from);
				const x2 = xToScreen(interval.to);
				return (
					<G key={`int-${i}`}>
						<Line
							x1={x1}
							y1={axisY}
							x2={x2}
							y2={axisY}
							stroke={TOKEN.primary}
							strokeWidth={3}
							strokeOpacity={0.5}
						/>
						<Circle
							cx={x1}
							cy={axisY}
							r={3.5}
							fill={interval.leftOpen ? "#ffffff" : TOKEN.primary}
							stroke={TOKEN.primary}
							strokeWidth={1.2}
						/>
						<Circle
							cx={x2}
							cy={axisY}
							r={3.5}
							fill={interval.rightOpen ? "#ffffff" : TOKEN.primary}
							stroke={TOKEN.primary}
							strokeWidth={1.2}
						/>
					</G>
				);
			})}
			{spec.points.map((point, i) => (
				<G key={`pt-${i}`}>
					<Circle
						cx={xToScreen(point.value)}
						cy={axisY}
						r={3.5}
						fill={point.openCircle ? "#ffffff" : TOKEN.foreground}
						stroke={TOKEN.foreground}
						strokeWidth={1.2}
					/>
					{point.label ? (
						<Text
							x={xToScreen(point.value) - 4}
							y={axisY - 8}
							style={{ fontSize: 8, fill: TOKEN.foreground }}
						>
							{point.label}
						</Text>
					) : null}
				</G>
			))}
		</Svg>
	);
}

function prettyTick(t: number): string {
	if (Number.isInteger(t)) return t.toString();
	return Number(t.toFixed(2)).toString();
}

// ───────────────────────────────────────────────────────────────────────
// physics_diagram
// ───────────────────────────────────────────────────────────────────────

function PhysicsDiagramPdf({ spec }: { spec: PhysicsDiagramSpec }): ReactElement {
	switch (spec.subKind) {
		case "free_body":
			return <FreeBodyPdf spec={spec} />;
		case "ray_optics":
			return <RayOpticsPdf spec={spec} />;
		case "circuit":
			return <CircuitPdf spec={spec} />;
	}
}

function FreeBodyPdf({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "free_body" }>;
}): ReactElement {
	const W = 240;
	const H = 200;
	const cx = W / 2;
	const cy = H / 2;
	const maxMag = Math.max(...spec.forces.map((f) => f.magnitude), 1);
	const arrowMaxPx = 70;
	return (
		<Svg width={W} height={H}>
			{spec.inclineDeg != null ? (
				<Line
					x1={20}
					y1={H - 20}
					x2={W - 20}
					y2={H - 20 - Math.tan((spec.inclineDeg * Math.PI) / 180) * (W - 40)}
					stroke={TOKEN.muted}
					strokeWidth={1}
				/>
			) : null}
			<Rect
				x={cx - 18}
				y={cy - 14}
				width={36}
				height={28}
				rx={2}
				fill="#ffffff"
				stroke={TOKEN.foreground}
				strokeWidth={1.2}
			/>
			<Text
				x={cx - 16}
				y={cy + 4}
				style={{ fontSize: 8, fill: TOKEN.foreground }}
			>
				{truncate(spec.bodyLabel, 8)}
			</Text>
			{spec.forces.map((force, i) => {
				const lengthPx = (force.magnitude / maxMag) * arrowMaxPx;
				const rad = (force.angleDeg * Math.PI) / 180;
				const tipX = cx + Math.cos(rad) * lengthPx;
				const tipY = cy - Math.sin(rad) * lengthPx;
				return (
					<G key={`f-${i}`}>
						<Arrow x1={cx} y1={cy} x2={tipX} y2={tipY} color={TOKEN.red} />
						<Text
							x={cx + Math.cos(rad) * (lengthPx + 8) - 4}
							y={cy - Math.sin(rad) * (lengthPx + 8) + 3}
							style={{ fontSize: 9, fill: TOKEN.foreground }}
						>
							{force.name}
						</Text>
					</G>
				);
			})}
		</Svg>
	);
}

function RayOpticsPdf({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>;
}): ReactElement {
	const W = PDF_VISUAL_WIDTH;
	const H = 160;
	const padding = 20;
	const axisY = H / 2;
	const xRange = spec.axisMax - spec.axisMin;
	if (xRange <= 0) {
		return <FallbackBlock title="Ray optics" altText="Invalid axis range." />;
	}
	const innerW = W - 2 * padding;
	const innerH = H - 2 * padding;
	const xToScreen = (x: number): number => padding + ((x - spec.axisMin) / xRange) * innerW;
	const heightToScreen = (h: number): number => -((h / 5) * (innerH / 2));

	return (
		<Svg width={W} height={H}>
			<Line
				x1={padding}
				y1={axisY}
				x2={W - padding}
				y2={axisY}
				stroke={TOKEN.muted}
				strokeWidth={0.8}
			/>
			{spec.lenses.map((lens, i) => {
				const x = xToScreen(lens.x);
				const fLeft = xToScreen(lens.x - lens.focalLength);
				const fRight = xToScreen(lens.x + lens.focalLength);
				return (
					<G key={`l-${i}`}>
						<Line x1={x} y1={padding} x2={x} y2={H - padding} stroke={TOKEN.foreground} strokeWidth={1.2} />
						<Circle cx={fLeft} cy={axisY} r={2} fill={TOKEN.foreground} />
						<Circle cx={fRight} cy={axisY} r={2} fill={TOKEN.foreground} />
						<Text x={fLeft - 3} y={axisY + 12} style={{ fontSize: 8, fill: TOKEN.foreground }}>
							F
						</Text>
						<Text x={fRight - 3} y={axisY + 12} style={{ fontSize: 8, fill: TOKEN.foreground }}>
							F
						</Text>
					</G>
				);
			})}
			{spec.objects.map((obj, i) => {
				const x = xToScreen(obj.x);
				const tipY = axisY + heightToScreen(obj.height);
				return (
					<G key={`o-${i}`}>
						<Arrow
							x1={x}
							y1={axisY}
							x2={x}
							y2={tipY}
							color={TOKEN.foreground}
						/>
					</G>
				);
			})}
		</Svg>
	);
}

function CircuitPdf({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>;
}): ReactElement {
	const W = PDF_VISUAL_WIDTH;
	const H = 200;
	const padding = 24;
	const nodeMap = new Map(spec.nodes.map((n) => [n.id, n] as const));
	const xs = spec.nodes.map((n) => n.x);
	const ys = spec.nodes.map((n) => n.y);
	const xMin = Math.min(...xs);
	const xMax = Math.max(...xs);
	const yMin = Math.min(...ys);
	const yMax = Math.max(...ys);
	const xRange = Math.max(xMax - xMin, 1);
	const yRange = Math.max(yMax - yMin, 1);
	const innerW = W - 2 * padding;
	const innerH = H - 2 * padding;
	const project = (x: number, y: number): { x: number; y: number } => ({
		x: padding + ((x - xMin) / xRange) * innerW,
		y: padding + ((y - yMin) / yRange) * innerH,
	});

	return (
		<Svg width={W} height={H}>
			{spec.components.map((comp, i) => {
				const fromN = nodeMap.get(comp.from);
				const toN = nodeMap.get(comp.to);
				if (!fromN || !toN) return null;
				const a = project(fromN.x, fromN.y);
				const b = project(toN.x, toN.y);
				return <CircuitComponent key={`c-${i}`} component={comp} a={a} b={b} />;
			})}
			{spec.nodes.map((n) => {
				const p = project(n.x, n.y);
				return (
					<Circle key={`n-${n.id}`} cx={p.x} cy={p.y} r={2} fill={TOKEN.foreground} />
				);
			})}
		</Svg>
	);
}

function CircuitComponent({
	component,
	a,
	b,
}: {
	component: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>["components"][number];
	a: { x: number; y: number };
	b: { x: number; y: number };
}): ReactElement {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.max(Math.hypot(dx, dy), 1);
	const ux = dx / len;
	const uy = dy / len;
	const px = -uy;
	const py = ux;
	const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	const half = 14;
	const start = { x: mid.x - ux * half, y: mid.y - uy * half };
	const end = { x: mid.x + ux * half, y: mid.y + uy * half };
	const wireBefore = (
		<Line x1={a.x} y1={a.y} x2={start.x} y2={start.y} stroke={TOKEN.foreground} strokeWidth={1} />
	);
	const wireAfter = (
		<Line x1={end.x} y1={end.y} x2={b.x} y2={b.y} stroke={TOKEN.foreground} strokeWidth={1} />
	);

	switch (component.type) {
		case "wire":
			return <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={TOKEN.foreground} strokeWidth={1} />;
		case "battery":
			return (
				<G>
					{wireBefore}
					{wireAfter}
					<Line
						x1={mid.x - ux * 3 + px * 6}
						y1={mid.y - uy * 3 + py * 6}
						x2={mid.x - ux * 3 - px * 6}
						y2={mid.y - uy * 3 - py * 6}
						stroke={TOKEN.foreground}
						strokeWidth={1.5}
					/>
					<Line
						x1={mid.x + ux * 3 + px * 4}
						y1={mid.y + uy * 3 + py * 4}
						x2={mid.x + ux * 3 - px * 4}
						y2={mid.y + uy * 3 - py * 4}
						stroke={TOKEN.foreground}
						strokeWidth={1.5}
					/>
				</G>
			);
		case "resistor": {
			const teeth = 4;
			const teethSpacing = (2 * half) / teeth;
			const points: string[] = [];
			points.push(`${start.x},${start.y}`);
			for (let i = 0; i < teeth; i++) {
				const tx = start.x + ux * teethSpacing * (i + 0.5);
				const ty = start.y + uy * teethSpacing * (i + 0.5);
				const off = i % 2 === 0 ? 4 : -4;
				points.push(`${tx + px * off},${ty + py * off}`);
			}
			points.push(`${end.x},${end.y}`);
			return (
				<G>
					{wireBefore}
					{wireAfter}
					<Polyline points={points.join(" ")} stroke={TOKEN.foreground} strokeWidth={1} fill="none" />
				</G>
			);
		}
		case "bulb":
			return (
				<G>
					{wireBefore}
					{wireAfter}
					<Circle cx={mid.x} cy={mid.y} r={half - 4} fill="#ffffff" stroke={TOKEN.foreground} strokeWidth={1} />
					<Line x1={mid.x - 5} y1={mid.y - 5} x2={mid.x + 5} y2={mid.y + 5} stroke={TOKEN.foreground} strokeWidth={1} />
					<Line x1={mid.x + 5} y1={mid.y - 5} x2={mid.x - 5} y2={mid.y + 5} stroke={TOKEN.foreground} strokeWidth={1} />
				</G>
			);
		case "switch":
			return (
				<G>
					{wireBefore}
					{wireAfter}
					<Circle cx={start.x} cy={start.y} r={1.5} fill={TOKEN.foreground} />
					<Circle cx={end.x} cy={end.y} r={1.5} fill={TOKEN.foreground} />
					<Line
						x1={start.x}
						y1={start.y}
						x2={component.closed ? end.x : start.x + ux * 18 + px * -6}
						y2={component.closed ? end.y : start.y + uy * 18 + py * -6}
						stroke={TOKEN.foreground}
						strokeWidth={1}
					/>
				</G>
			);
		case "ammeter":
		case "voltmeter":
			return (
				<G>
					{wireBefore}
					{wireAfter}
					<Circle cx={mid.x} cy={mid.y} r={half - 4} fill="#ffffff" stroke={TOKEN.foreground} strokeWidth={1} />
					<Text
						x={mid.x - 3}
						y={mid.y + 3}
						style={{ fontSize: 9, fontFamily: "Helvetica-Bold", fill: TOKEN.foreground }}
					>
						{component.type === "ammeter" ? "A" : "V"}
					</Text>
				</G>
			);
	}
}

// ───────────────────────────────────────────────────────────────────────
// chemistry_molecule + chemistry_reaction (text fallback)
// ───────────────────────────────────────────────────────────────────────

function ChemistryMoleculePdf({
	spec,
	altText,
}: {
	spec: ChemistryMoleculeSpec;
	altText: string;
}): ReactElement {
	return (
		<View>
			<Text style={styles.fallbackTitle}>Molecule</Text>
			<Text style={styles.fallbackBody}>{altText}</Text>
			<Text style={styles.fallbackCode}>SMILES: {spec.smiles}</Text>
			{spec.label ? <Text style={styles.fallbackBody}>{spec.label}</Text> : null}
		</View>
	);
}

function ChemistryReactionPdf({
	spec,
	altText,
}: {
	spec: ChemistryReactionSpec;
	altText: string;
}): ReactElement {
	return (
		<View>
			<Text style={styles.fallbackTitle}>Reaction</Text>
			<Text style={styles.fallbackBody}>{altText}</Text>
			<Text style={styles.fallbackCode}>{spec.ce}</Text>
			{spec.label ? <Text style={styles.fallbackBody}>{spec.label}</Text> : null}
		</View>
	);
}

// ───────────────────────────────────────────────────────────────────────
// accountancy_table
// ───────────────────────────────────────────────────────────────────────

function AccountancyTablePdf({ spec }: { spec: AccountancyTableSpec }): ReactElement {
	switch (spec.subKind) {
		case "journal_entry":
		case "cash_book":
		case "rectification":
			return (
				<View>
					<TableHeader cells={[
						{ text: "Date", flex: 0.18 },
						{ text: "Particulars", flex: 0.5 },
						{ text: "Debit (₹)", flex: 0.16, align: "right" },
						{ text: "Credit (₹)", flex: 0.16, align: "right" },
					]} />
					{spec.rows.map((row, i) => (
						<View key={`r-${i}`}>
							<View style={styles.tableRow}>
								<TableCell text={row.date} flex={0.18} />
								<TableCell text={row.particulars} flex={0.5} />
								<TableCell text={formatRupee(row.debit)} flex={0.16} align="right" />
								<TableCell text={formatRupee(row.credit)} flex={0.16} align="right" />
							</View>
							{row.narration ? (
								<View style={styles.tableRow}>
									<TableCell text="" flex={0.18} />
									<TableCell text={row.narration} flex={0.82} italic />
								</View>
							) : null}
						</View>
					))}
				</View>
			);
		case "trial_balance": {
			const totalDebit = spec.rows.reduce((s, r) => s + (r.debit ?? 0), 0);
			const totalCredit = spec.rows.reduce((s, r) => s + (r.credit ?? 0), 0);
			return (
				<View>
					<TableHeader cells={[
						{ text: "Particulars", flex: 0.6 },
						{ text: "Debit (₹)", flex: 0.2, align: "right" },
						{ text: "Credit (₹)", flex: 0.2, align: "right" },
					]} />
					{spec.rows.map((row, i) => (
						<View key={`r-${i}`} style={styles.tableRow}>
							<TableCell text={row.particulars} flex={0.6} />
							<TableCell text={formatRupee(row.debit)} flex={0.2} align="right" />
							<TableCell text={formatRupee(row.credit)} flex={0.2} align="right" />
						</View>
					))}
					<View style={styles.tableRow}>
						<TableCell text="Total" flex={0.6} bold align="right" />
						<TableCell text={formatRupee(totalDebit)} flex={0.2} align="right" bold />
						<TableCell text={formatRupee(totalCredit)} flex={0.2} align="right" bold />
					</View>
				</View>
			);
		}
		case "ledger": {
			const { ledger } = spec;
			const rows = Math.max(ledger.debitSide.length, ledger.creditSide.length);
			return (
				<View>
					<Text style={[styles.fallbackTitle, { textAlign: "center" }]}>{ledger.accountName} A/c</Text>
					<TableHeader cells={[
						{ text: "Dr Date", flex: 0.12 },
						{ text: "Particulars", flex: 0.3 },
						{ text: "₹", flex: 0.08, align: "right" },
						{ text: "Cr Date", flex: 0.12 },
						{ text: "Particulars", flex: 0.3 },
						{ text: "₹", flex: 0.08, align: "right" },
					]} />
					{Array.from({ length: rows }, (_, i) => {
						const dr = ledger.debitSide[i];
						const cr = ledger.creditSide[i];
						return (
							<View key={`l-${i}`} style={styles.tableRow}>
								<TableCell text={dr?.date ?? ""} flex={0.12} />
								<TableCell text={dr?.particulars ?? ""} flex={0.3} />
								<TableCell text={dr ? formatRupee(dr.amount) : ""} flex={0.08} align="right" />
								<TableCell text={cr?.date ?? ""} flex={0.12} />
								<TableCell text={cr?.particulars ?? ""} flex={0.3} />
								<TableCell text={cr ? formatRupee(cr.amount) : ""} flex={0.08} align="right" />
							</View>
						);
					})}
				</View>
			);
		}
		case "balance_sheet":
			return (
				<View>
					<TableHeader cells={[
						{ text: "Equity & Liabilities", flex: 0.8 },
						{ text: "₹", flex: 0.2, align: "right" },
					]} />
					{spec.equityAndLiabilitiesSide.map((row, i) => (
						<BalanceSheetRowPdf key={`el-${i}`} row={row} />
					))}
					<TableHeader cells={[
						{ text: "Assets", flex: 0.8 },
						{ text: "₹", flex: 0.2, align: "right" },
					]} />
					{spec.assetsSide.map((row, i) => (
						<BalanceSheetRowPdf key={`a-${i}`} row={row} />
					))}
				</View>
			);
		case "p_and_l":
			return (
				<View>
					<TableHeader cells={[
						{ text: "Particulars", flex: 0.8 },
						{ text: "₹", flex: 0.2, align: "right" },
					]} />
					{spec.rows.map((row, i) => (
						<BalanceSheetRowPdf key={`pl-${i}`} row={row} />
					))}
				</View>
			);
	}
}

function BalanceSheetRowPdf({
	row,
}: {
	row: { particulars: string; amount: number | null; indent: number; bold: boolean };
}): ReactElement {
	const indent = Math.min(row.indent, 3) * 12;
	return (
		<View style={styles.tableRow}>
			<View style={{ flex: 0.8, paddingLeft: 4 + indent }}>
				<Text style={[styles.tableCell, row.bold ? { fontFamily: "Helvetica-Bold" } : {}]}>
					{row.particulars}
				</Text>
			</View>
			<View style={{ flex: 0.2 }}>
				<Text
					style={[
						styles.tableCell,
						{ textAlign: "right" },
						row.bold ? { fontFamily: "Helvetica-Bold" } : {},
					]}
				>
					{formatRupee(row.amount)}
				</Text>
			</View>
		</View>
	);
}

function formatRupee(value: number | null): string {
	if (value == null) return "";
	const abs = Math.abs(value);
	const formatted = formatIndianNumber(abs);
	return value < 0 ? `(₹${formatted})` : `₹${formatted}`;
}

function formatIndianNumber(n: number): string {
	const fixed = n.toFixed(n % 1 === 0 ? 0 : 2);
	const [intPart, fracPart] = fixed.split(".");
	const safe = intPart ?? "0";
	const last3 = safe.slice(-3);
	const rest = safe.slice(0, -3);
	const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
	return fracPart ? `${grouped}.${fracPart}` : grouped;
}

// ───────────────────────────────────────────────────────────────────────
// economics_curve (text fallback)
// ───────────────────────────────────────────────────────────────────────

function EconomicsCurvePdf({
	spec,
	altText,
}: {
	spec: EconomicsCurveSpec;
	altText: string;
}): ReactElement {
	const lines: string[] = [];
	for (const c of spec.curves) {
		lines.push(`${c.label}: ${c.expr}`);
	}
	for (const m of spec.marks) {
		lines.push(`${m.label}: (x=${m.x}, y=${m.y})`);
	}
	return (
		<FallbackBlock
			title={`Curves on (${spec.xLabel}, ${spec.yLabel})`}
			altText={altText}
			bodyLines={lines}
		/>
	);
}

// ───────────────────────────────────────────────────────────────────────
// statistics_chart
// ───────────────────────────────────────────────────────────────────────

function StatisticsChartPdf({
	spec,
	altText,
}: {
	spec: StatisticsChartSpec;
	altText: string;
}): ReactElement {
	const W = PDF_VISUAL_WIDTH;
	const H = 220;
	const padding = 28;
	const innerW = W - 2 * padding;
	const innerH = H - 2 * padding;
	const baseY = H - padding;

	switch (spec.subKind) {
		case "histogram":
		case "frequency_polygon":
		case "ogive": {
			const bins = spec.bins;
			if (bins.length === 0) return <FallbackBlock title="Statistics chart" altText={altText} />;
			const maxFreq = Math.max(
				...(spec.subKind === "ogive"
					? cumulativeFromBins(bins, (spec as Extract<StatisticsChartSpec, { subKind: "ogive" }>).cumulative)
					: bins.map((b) => b.frequency)),
				1,
			);
			const barWidth = innerW / bins.length;
			return (
				<Svg width={W} height={H}>
					<AxesXY axisColor={TOKEN.muted} padding={padding} W={W} H={H} xLabel={spec.xLabel} yLabel={spec.yLabel} />
					{spec.subKind === "histogram" ? (
						<>
							{bins.map((bin, i) => {
								const h = (bin.frequency / maxFreq) * innerH;
								return (
									<Rect
										key={`b-${i}`}
										x={padding + i * barWidth + 1}
										y={baseY - h}
										width={Math.max(barWidth - 2, 1)}
										height={h}
										fill={TOKEN.primary}
									/>
								);
							})}
							{bins.map((bin, i) => (
								<Text
									key={`bl-${i}`}
									x={padding + i * barWidth + 1}
									y={baseY + 10}
									style={{ fontSize: 7, fill: TOKEN.muted }}
								>
									{truncate(bin.label, 8)}
								</Text>
							))}
						</>
					) : (
						<Polyline
							points={(spec.subKind === "ogive"
								? cumulativeFromBins(
										bins,
										(spec as Extract<StatisticsChartSpec, { subKind: "ogive" }>).cumulative,
									)
								: bins.map((b) => b.frequency)
							)
								.map((v, i) => {
									const x = padding + i * barWidth + barWidth / 2;
									const y = baseY - (v / maxFreq) * innerH;
									return `${x},${y}`;
								})
								.join(" ")}
							stroke={TOKEN.primary}
							strokeWidth={1.5}
							fill="none"
						/>
					)}
				</Svg>
			);
		}
		case "bar": {
			const data = spec.data;
			if (data.length === 0) return <FallbackBlock title="Bar chart" altText={altText} />;
			const maxValue = Math.max(...data.map((d) => d.value), 1);
			const barWidth = innerW / data.length;
			return (
				<Svg width={W} height={H}>
					<AxesXY axisColor={TOKEN.muted} padding={padding} W={W} H={H} xLabel={spec.xLabel} yLabel={spec.yLabel} />
					{data.map((d, i) => {
						const h = (d.value / maxValue) * innerH;
						return (
							<Rect
								key={`b-${i}`}
								x={padding + i * barWidth + 1}
								y={baseY - h}
								width={Math.max(barWidth - 2, 1)}
								height={h}
								fill={TOKEN.secondary}
							/>
						);
					})}
				</Svg>
			);
		}
		case "line": {
			const series = spec.series;
			if (series.length === 0) return <FallbackBlock title="Line chart" altText={altText} />;
			const allPoints = series.flatMap((s) => s.points);
			const xMin = Math.min(...allPoints.map((p) => p.x));
			const xMax = Math.max(...allPoints.map((p) => p.x));
			const yMin = Math.min(...allPoints.map((p) => p.y));
			const yMax = Math.max(...allPoints.map((p) => p.y));
			const xRange = Math.max(xMax - xMin, 1);
			const yRange = Math.max(yMax - yMin, 1);
			const xToScreen = (x: number): number => padding + ((x - xMin) / xRange) * innerW;
			const yToScreen = (y: number): number => baseY - ((y - yMin) / yRange) * innerH;
			const colors = [TOKEN.primary, TOKEN.secondary, TOKEN.accent, TOKEN.red];
			return (
				<Svg width={W} height={H}>
					<AxesXY axisColor={TOKEN.muted} padding={padding} W={W} H={H} xLabel={spec.xLabel} yLabel={spec.yLabel} />
					{series.map((s, si) => (
						<Polyline
							key={`s-${si}`}
							points={s.points.map((p) => `${xToScreen(p.x)},${yToScreen(p.y)}`).join(" ")}
							stroke={colors[si % colors.length] ?? TOKEN.primary}
							strokeWidth={1.5}
							fill="none"
						/>
					))}
				</Svg>
			);
		}
		case "scatter": {
			const points = spec.points;
			if (points.length === 0) return <FallbackBlock title="Scatter plot" altText={altText} />;
			const xMin = Math.min(...points.map((p) => p.x));
			const xMax = Math.max(...points.map((p) => p.x));
			const yMin = Math.min(...points.map((p) => p.y));
			const yMax = Math.max(...points.map((p) => p.y));
			const xRange = Math.max(xMax - xMin, 1);
			const yRange = Math.max(yMax - yMin, 1);
			const xToScreen = (x: number): number => padding + ((x - xMin) / xRange) * innerW;
			const yToScreen = (y: number): number => baseY - ((y - yMin) / yRange) * innerH;
			return (
				<Svg width={W} height={H}>
					<AxesXY axisColor={TOKEN.muted} padding={padding} W={W} H={H} xLabel={spec.xLabel} yLabel={spec.yLabel} />
					{points.map((p, i) => (
						<Circle key={`p-${i}`} cx={xToScreen(p.x)} cy={yToScreen(p.y)} r={2} fill={TOKEN.primary} />
					))}
				</Svg>
			);
		}
		case "pie":
		case "box":
			return <FallbackBlock title={spec.subKind === "pie" ? "Pie chart" : "Box plot"} altText={altText} />;
	}
}

function cumulativeFromBins(
	bins: { frequency: number }[],
	mode: "less_than" | "more_than",
): number[] {
	if (mode === "less_than") {
		const out: number[] = [];
		let acc = 0;
		for (const bin of bins) {
			acc += bin.frequency;
			out.push(acc);
		}
		return out;
	}
	const total = bins.reduce((s, b) => s + b.frequency, 0);
	const out: number[] = [];
	let acc = 0;
	for (const bin of bins) {
		out.push(total - acc);
		acc += bin.frequency;
	}
	return out;
}

function AxesXY({
	padding,
	W,
	H,
	xLabel,
	yLabel,
	axisColor,
}: {
	padding: number;
	W: number;
	H: number;
	xLabel: string;
	yLabel: string;
	axisColor: string;
}): ReactElement {
	const baseY = H - padding;
	return (
		<G>
			<Line x1={padding} y1={baseY} x2={W - padding} y2={baseY} stroke={axisColor} strokeWidth={0.8} />
			<Line x1={padding} y1={padding} x2={padding} y2={baseY} stroke={axisColor} strokeWidth={0.8} />
			<Text x={W - padding - 30} y={baseY + 14} style={{ fontSize: 8, fill: TOKEN.muted }}>
				{truncate(xLabel, 12)}
			</Text>
			<Text x={padding - 18} y={padding + 4} style={{ fontSize: 8, fill: TOKEN.muted }}>
				{truncate(yLabel, 12)}
			</Text>
		</G>
	);
}

// ───────────────────────────────────────────────────────────────────────
// data_table
// ───────────────────────────────────────────────────────────────────────

function DataTablePdf({ spec }: { spec: DataTableSpec }): ReactElement {
	const colCount = spec.headers.length;
	if (colCount === 0) return <FallbackBlock title="Data table" altText="No headers." />;
	const flexEach = 1 / colCount;
	return (
		<View>
			{spec.caption ? (
				<Text style={[styles.fallbackTitle, { textAlign: "center" }]}>{spec.caption}</Text>
			) : null}
			<TableHeader cells={spec.headers.map((h) => ({ text: h, flex: flexEach }))} />
			{spec.rows.map((row, ri) => (
				<View key={`r-${ri}`} style={styles.tableRow}>
					{row.map((cell, ci) => (
						<TableCell
							key={`c-${ri}-${ci}`}
							text={cell.value}
							flex={flexEach}
							align={cell.align}
							bold={cell.bold}
						/>
					))}
				</View>
			))}
		</View>
	);
}

// ───────────────────────────────────────────────────────────────────────
// india_map
// ───────────────────────────────────────────────────────────────────────

function IndiaMapPdf({ spec }: { spec: IndiaMapSpec }): ReactElement {
	const mapStyle = normalizeIndiaMapStyle(spec.mapStyle);
	const highlighted = new Set(spec.highlightedStates ?? []);
	const vb = parseSvgViewBox(india.viewBox);
	const ocean = indiaMapOceanFill(mapStyle);
	const W = PDF_VISUAL_WIDTH;
	const H = indiaMapPdfHeight();
	const sorted = [...india.locations].sort((a, b) => {
		const ah = highlighted.has(a.id) ? 1 : 0;
		const bh = highlighted.has(b.id) ? 1 : 0;
		return ah - bh;
	});

	return (
		<View>
			<Svg width={W} height={H} viewBox={india.viewBox}>
				<Rect x={vb.vx} y={vb.vy} width={vb.vw} height={vb.vh} fill={ocean} />
				{sorted.map((loc) => {
					const paint = indiaRegionPaint(mapStyle, loc.id as IndiaMapLocationId, highlighted);
					return (
						<Path
							key={loc.id}
							d={loc.path}
							fill={paint.fill}
							stroke={paint.stroke}
							strokeWidth={paint.strokeWidth}
						/>
					);
				})}
			</Svg>
			<Text style={[styles.fallbackBody, { fontSize: 7, color: TOKEN.muted, marginTop: 4 }]}>
				{INDIA_MAP_ATTRIBUTION}
			</Text>
		</View>
	);
}

// ───────────────────────────────────────────────────────────────────────
// english_passage
// ───────────────────────────────────────────────────────────────────────

function EnglishPassagePdf({ spec }: { spec: EnglishPassageSpec }): ReactElement {
	return (
		<View>
			{spec.title ? (
				<Text style={[styles.fallbackTitle, { textAlign: "center" }]}>{spec.title}</Text>
			) : null}
			{spec.source ? (
				<Text style={[styles.caption, { marginTop: 0, marginBottom: 4 }]}>{spec.source}</Text>
			) : null}
			{spec.lines.map((line) => (
				<View key={`l-${line.number}`} style={styles.passageLine}>
					<Text style={styles.passageNumber}>{line.number}</Text>
					<Text style={styles.passageText}>{line.text}</Text>
				</View>
			))}
		</View>
	);
}

// ───────────────────────────────────────────────────────────────────────
// math_function_plot (text fallback) and shared helpers
// ───────────────────────────────────────────────────────────────────────

function FallbackBlock({
	title,
	altText,
	bodyLines,
}: {
	title: string;
	altText: string;
	bodyLines?: string[];
}): ReactElement {
	return (
		<View>
			<Text style={styles.fallbackTitle}>{title}</Text>
			<Text style={styles.fallbackBody}>{altText}</Text>
			{bodyLines && bodyLines.length > 0 ? (
				<View>
					{bodyLines.map((line, i) => (
						<Text key={i} style={styles.fallbackCode}>
							{line}
						</Text>
					))}
				</View>
			) : null}
		</View>
	);
}

function TableHeader({
	cells,
}: {
	cells: { text: string; flex: number; align?: "left" | "right" | "center" }[];
}): ReactElement {
	return (
		<View style={[styles.tableRow, { backgroundColor: "#e2e8f0" }]}>
			{cells.map((c, i) => (
				<View key={i} style={{ flex: c.flex }}>
					<Text style={[styles.tableHeader, { textAlign: c.align ?? "left", paddingHorizontal: 4 }]}>
						{c.text}
					</Text>
				</View>
			))}
		</View>
	);
}

function TableCell({
	text,
	flex,
	align,
	bold,
	italic,
}: {
	text: string;
	flex: number;
	align?: "left" | "right" | "center";
	bold?: boolean;
	italic?: boolean;
}): ReactElement {
	return (
		<View style={{ flex }}>
			<Text
				style={[
					styles.tableCell,
					{ textAlign: align ?? "left" },
					bold ? { fontFamily: "Helvetica-Bold" } : {},
					italic ? { fontFamily: "Helvetica-Oblique" } : {},
				]}
			>
				{text}
			</Text>
		</View>
	);
}

function truncate(s: string, n: number): string {
	if (typeof s !== "string") return "";
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}

// Force the imports of unused types to keep TS happy (centralised — they are
// referenced by the per-kind components above).
export type _PdfRendererTypes = {
	AccountancyTableSpec: AccountancyTableSpec;
	ChemistryMoleculeSpec: ChemistryMoleculeSpec;
	ChemistryReactionSpec: ChemistryReactionSpec;
	DataTableSpec: DataTableSpec;
	EconomicsCurveSpec: EconomicsCurveSpec;
	EnglishPassageSpec: EnglishPassageSpec;
	IndiaMapSpec: IndiaMapSpec;
	MathFunctionPlotSpec: MathFunctionPlotSpec;
	MathGeometrySpec: MathGeometrySpec;
	NumberLineSpec: NumberLineSpec;
	PhysicsDiagramSpec: PhysicsDiagramSpec;
	StatisticsChartSpec: StatisticsChartSpec;
};

export type _PdfRendererNodes = ReactNode;
