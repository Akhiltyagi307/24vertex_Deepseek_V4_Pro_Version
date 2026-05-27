"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { LatexText } from "../latex-text";
import { cn } from "@/lib/utils";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";
import { VisualErrorBoundary } from "./visual-error-boundary";

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
const DataTable = dynamic(
	() => import("./renderers/data-table").then((m) => ({ default: m.DataTable })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const IndiaMap = dynamic(
	() => import("./renderers/india-map").then((m) => ({ default: m.IndiaMap })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const EnglishPassage = dynamic(
	() => import("./renderers/english-passage").then((m) => ({ default: m.EnglishPassage })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const BiologyDiagram = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.BiologyDiagram })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const Flowchart = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.Flowchart })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const Timeline = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.Timeline })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const SourceExtract = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.SourceExtract })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const MapVisual = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.MapVisual })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const ChemistryCellDiagram = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.ChemistryCellDiagram })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const PhysicsFieldDiagram = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.PhysicsFieldDiagram })),
	{ ssr: false, loading: () => <RendererLoading /> },
);
const PhysicsWaveDiagram = dynamic(
	() => import("./renderers/template-renderers").then((m) => ({ default: m.PhysicsWaveDiagram })),
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
			aria-labelledby={undefined}
			aria-label={visual.altText}
			className={cn(
				"my-4 flex w-full flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-3",
				className,
			)}
			data-question-visual
			data-question-visual-kind={visual.spec.kind}
		>
			{/*
			  D21: ship the spec's `altText` as actual sr-only DOM content (not just
			  an `aria-label` attribute) so AT users can navigate to it like body
			  text. The renderer body is `aria-hidden` so SVG/canvas internals
			  don't pollute the AT tree — for non-trivial diagrams the underlying
			  shapes have no meaningful labels, so the textual altText is the
			  authoritative description for assistive tech.
			*/}
			<span className="sr-only">{visual.altText}</span>
			<div
				className="max-h-[min(52dvh,28rem)] w-full overflow-x-auto overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]"
				aria-hidden="true"
			>
				<div className="flex min-h-[120px] w-full items-center justify-center">
					<VisualErrorBoundary kind={visual.spec.kind} altText={visual.altText}>
						<RendererDispatch visual={visual} />
					</VisualErrorBoundary>
				</div>
			</div>
			<figcaption className="text-muted-foreground text-center text-xs">
				<LatexText text={visual.caption} className="justify-center text-center" />
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
		case "data_table":
			return <DataTable spec={spec} />;
		case "india_map":
			return <IndiaMap spec={spec} />;
		case "english_passage":
			return <EnglishPassage spec={spec} />;
		case "biology_diagram":
			return <BiologyDiagram spec={spec} />;
		case "flowchart":
			return <Flowchart spec={spec} />;
		case "timeline":
			return <Timeline spec={spec} />;
		case "source_extract":
			return <SourceExtract spec={spec} />;
		case "map_visual":
			return <MapVisual spec={spec} />;
		case "chemistry_cell_diagram":
			return <ChemistryCellDiagram spec={spec} />;
		case "physics_field_diagram":
			return <PhysicsFieldDiagram spec={spec} />;
		case "physics_wave_diagram":
			return <PhysicsWaveDiagram spec={spec} />;
	}
}
