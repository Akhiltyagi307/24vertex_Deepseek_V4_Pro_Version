"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

/**
 * Top-level question visual dispatcher.
 *
 * Renders a `<figure>` shell with the caption and an accessible aria-label
 * (using the spec's altText). The renderer body is dispatched on
 * `visual.spec.kind`. Each renderer batch (commits 6–9 of the v2 visuals
 * plan) registers a real component for its kind; until a kind has its
 * renderer wired, the body falls through to a small "not yet supported"
 * fallback so a stored envelope cannot crash the page.
 *
 * Server-side concerns: this component is a client component, but it
 * renders fine on the server too (no DOM-only APIs at the top level).
 * Heavy renderers (Mafs, Plotly, smiles-drawer, etc.) are imported via
 * `next/dynamic({ ssr: false })` inside their own renderer files so the
 * server bundle stays light.
 */

function RendererLoading(): React.ReactElement {
	return (
		<div
			className="bg-muted/40 flex h-[180px] w-full max-w-[480px] items-center justify-center rounded text-muted-foreground text-sm"
			aria-hidden="true"
		>
			Loading visual…
		</div>
	);
}

const MathGeometry = dynamic(
	() => import("./renderers/math-geometry").then((m) => ({ default: m.MathGeometry })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const MathFunctionPlot = dynamic(
	() => import("./renderers/math-function-plot").then((m) => ({ default: m.MathFunctionPlot })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const NumberLine = dynamic(
	() => import("./renderers/number-line").then((m) => ({ default: m.NumberLine })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const PhysicsDiagram = dynamic(
	() => import("./renderers/physics-diagram").then((m) => ({ default: m.PhysicsDiagram })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const ChemistryMolecule = dynamic(
	() => import("./renderers/chemistry-molecule").then((m) => ({ default: m.ChemistryMolecule })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const ChemistryReaction = dynamic(
	() => import("./renderers/chemistry-reaction").then((m) => ({ default: m.ChemistryReaction })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const AccountancyTable = dynamic(
	() => import("./renderers/accountancy-table").then((m) => ({ default: m.AccountancyTable })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const StatisticsChart = dynamic(
	() => import("./renderers/statistics-chart").then((m) => ({ default: m.StatisticsChart })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const EconomicsCurve = dynamic(
	() => import("./renderers/economics-curve").then((m) => ({ default: m.EconomicsCurve })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
export function QuestionVisual({
	visual,
	className,
}: {
	visual: QuestionVisualEnvelope | null;
	className?: string;
}): React.ReactElement | null {
	if (!visual) return null;
	return (
		<figure
			role="figure"
			aria-label={visual.altText}
			className={cn(
				"my-4 flex w-full flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-3",
				className,
			)}
			data-question-visual
			data-question-visual-kind={visual.spec.kind}
		>
			<div className="flex min-h-[120px] w-full items-center justify-center overflow-x-auto">
				<RendererDispatch visual={visual} />
			</div>
			<figcaption className="text-muted-foreground text-center text-xs">
				{visual.caption}
			</figcaption>
		</figure>
	);
}

function RendererDispatch({
	visual,
}: {
	visual: QuestionVisualEnvelope;
}): React.ReactElement {
	const spec = visual.spec;
	switch (spec.kind) {
		case "math_geometry":
			return <MathGeometry spec={spec} />;
		case "math_function_plot":
			return <MathFunctionPlot spec={spec} />;
		case "number_line":
			return <NumberLine spec={spec} />;
		case "physics_diagram":
			return <PhysicsDiagram spec={spec} />;
		case "chemistry_molecule":
			return <ChemistryMolecule spec={spec} />;
		case "chemistry_reaction":
			return <ChemistryReaction spec={spec} />;
		case "accountancy_table":
			return <AccountancyTable spec={spec} />;
		case "statistics_chart":
			return <StatisticsChart spec={spec} />;
		case "economics_curve":
			return <EconomicsCurve spec={spec} />;
		default:
			// Fallback for kinds whose renderer hasn't shipped yet. Visible to
			// internal QA only; PRACTICE_VISUALS=false in production keeps the
			// model from emitting any visual until renderers land.
			return (
				<span className="text-muted-foreground text-sm" aria-hidden="true">
					Visual ({spec.kind}) not yet supported on this client.
				</span>
			);
	}
}
