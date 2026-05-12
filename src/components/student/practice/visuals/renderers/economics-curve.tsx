"use client";

import * as React from "react";
import functionPlot from "function-plot";

import type { EconomicsCurveSpec } from "@/lib/practice/visuals/types";
import { LatexText } from "../../latex-text";
import {
	ChartAxisLatexLayout,
	SvgMixedTextLabel,
	visualMathNeedsKatex,
} from "../visual-math-text";

const COLOR_MAP: Record<NonNullable<EconomicsCurveSpec["curves"][number]["color"]>, string> = {
	primary: "#3b82f6",
	secondary: "#10b981",
	muted: "#6b7280",
	accent: "#f59e0b",
};

const PLOT_WIDTH = 480;
const PLOT_HEIGHT = 320;

/**
 * `economics_curve` renderer.
 *
 * Wraps function-plot, like `<MathFunctionPlot />`. Each \`curves[].expr\` is
 * written in terms of \`p\` (the horizontal-axis variable — see \`xLabel\`,
 * often Quantity); the renderer substitutes \`p\` → \`x\` before passing to
 * function-plot because that library always evaluates \`fn\` against \`x\`.
 *
 * `marks` are rendered as small annotations at (x, y) — useful for
 * "Equilibrium" / "Price ceiling" callouts. function-plot's annotation
 * API only supports x or y reference lines, so we layer raw SVG circles
 * + text on top of the chart for true point labels.
 */
export function EconomicsCurve({
	spec,
}: {
	spec: EconomicsCurveSpec;
}): React.ReactElement {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const yDomain: [number, number] | null =
		spec.yMin != null && spec.yMax != null && spec.yMax > spec.yMin
			? [spec.yMin, spec.yMax]
			: null;
	const pointMarks = spec.marks.filter((mark) => (mark.kind ?? "point") === "point");
	const verticalMarks = spec.marks.filter(
		(mark) => (mark.kind ?? "point") === "vertical_line",
	);

	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	const verticalKatexMarks = verticalMarks.filter((m) => visualMathNeedsKatex(m.label));
	const showPointOverlay = yDomain != null && pointMarks.length > 0;
	const showVerticalKatexOverlay = verticalKatexMarks.length > 0;

	React.useEffect(() => {
		const target = containerRef.current;
		if (!target) return undefined;
		target.innerHTML = "";
		try {
			const yDomainForPlot: [number, number] | undefined = yDomain ?? undefined;
			functionPlot({
				target,
				width: PLOT_WIDTH,
				height: PLOT_HEIGHT,
				grid: true,
				disableZoom: true,
				xAxis: {
					domain: [spec.xMin, spec.xMax],
					label: xMath ? "" : spec.xLabel,
				},
				yAxis: {
					domain: yDomainForPlot,
					label: yMath ? "" : spec.yLabel,
				},
				data: spec.curves.map((curve) => ({
					fn: substitutePForX(curve.expr),
					graphType: "polyline",
					color: curve.color != null ? COLOR_MAP[curve.color] : COLOR_MAP.primary,
					nSamples: 200,
				})),
				annotations: verticalMarks.map((mark) => ({
					x: mark.x,
					text: visualMathNeedsKatex(mark.label) ? "" : mark.label,
				})),
			});
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unable to plot curves.");
		}
		return () => {
			if (target) target.innerHTML = "";
		};
		// Derived marks/domains come from `spec`; listing filtered arrays would churn deps every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- imperative plot keyed on full spec snapshot
	}, [spec]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Unable to plot curves.</span>
				<code className="text-xs">{error}</code>
			</div>
		);
	}

	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<div className="relative h-[320px] w-[480px] max-w-full overflow-hidden">
				<div ref={containerRef} />
				{showPointOverlay || showVerticalKatexOverlay ? (
					<svg
						className="pointer-events-none absolute inset-0"
						width={PLOT_WIDTH}
						height={PLOT_HEIGHT}
						viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
						aria-hidden="true"
					>
						{showPointOverlay
							? pointMarks.map((mark, idx) => {
									const [yMin, yMax] = yDomain as [number, number];
									const px = toPlotX(mark.x, spec.xMin, spec.xMax);
									const py = toPlotY(mark.y, yMin, yMax);
									return (
										<g key={`mark-${idx}`}>
											<circle cx={px} cy={py} r={4} fill="#111827" />
											<rect
												x={px + 6}
												y={py - 16}
												width={Math.max(30, mark.label.length * 6.4)}
												height={14}
												rx={3}
												fill="#ffffff"
												stroke="#111827"
												strokeWidth={0.8}
											/>
											<SvgMixedTextLabel
												x={px + 10}
												y={py - 6}
												text={mark.label}
												fontSize={10}
												textAnchor="start"
											/>
										</g>
									);
								})
							: null}
						{showVerticalKatexOverlay
							? verticalKatexMarks.map((mark, idx) => (
									<SvgMixedTextLabel
										key={`vm-${idx}`}
										x={toPlotX(mark.x, spec.xMin, spec.xMax)}
										y={28}
										text={mark.label}
										fontSize={10}
										textAnchor="middle"
									/>
								))
							: null}
					</svg>
				) : null}
			</div>
			<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				{spec.curves.map((curve, idx) => {
					const color = curve.color != null ? COLOR_MAP[curve.color] : COLOR_MAP.primary;
					return (
						<div key={`legend-${idx}`} className="flex items-center gap-2 text-muted-foreground">
							<span
								aria-hidden="true"
								className="inline-block h-2.5 w-2.5 rounded-sm"
								style={{ backgroundColor: color }}
							/>
							<LatexText text={curve.label} />
						</div>
					);
				})}
			</div>
		</ChartAxisLatexLayout>
	);
}

/**
 * Replaces standalone `p` identifiers with `x` so function-plot can
 * evaluate the spec's expressions against its single free variable.
 * Conservative: only matches `p` not adjacent to alphanumerics or
 * underscores (so `pi`, `exp`, `temperature` etc. are untouched).
 */
function substitutePForX(expr: string): string {
	return expr.replace(/(^|[^A-Za-z0-9_])p(?=$|[^A-Za-z0-9_])/g, "$1x");
}

function toPlotX(x: number, xMin: number, xMax: number): number {
	const left = 44;
	const right = PLOT_WIDTH - 20;
	const span = Math.max(xMax - xMin, 1e-6);
	return left + ((x - xMin) / span) * (right - left);
}

function toPlotY(y: number, yMin: number, yMax: number): number {
	const top = 18;
	const bottom = PLOT_HEIGHT - 40;
	const span = Math.max(yMax - yMin, 1e-6);
	return bottom - ((y - yMin) / span) * (bottom - top);
}

export const __test = { substitutePForX };
