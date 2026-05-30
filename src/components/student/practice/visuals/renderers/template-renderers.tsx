"use client";

import * as React from "react";

import type {
	BiologyDiagramSpec,
	ChemistryCellDiagramSpec,
	FlowchartSpec,
	MapVisualSpec,
	PhysicsFieldDiagramSpec,
	PhysicsWaveDiagramSpec,
	SourceExtractSpec,
	TimelineSpec,
} from "@/lib/practice/visuals/types";

const SVG_W = 520;
const SVG_H = 260;

function titleCase(value: string): string {
	return value
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percentX(x: number): number {
	return (Math.min(100, Math.max(0, x)) / 100) * SVG_W;
}

function percentY(y: number): number {
	return (Math.min(100, Math.max(0, y)) / 100) * SVG_H;
}

function PanelTitle({ children }: { children: React.ReactNode }): React.ReactElement {
	return <div className="mb-2 text-center text-sm font-semibold text-foreground">{children}</div>;
}

function NoteList({ notes }: { notes: string[] }): React.ReactElement | null {
	if (notes.length === 0) return null;
	return (
		<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
			{notes.map((note, index) => (
				<li key={`${index}-${note}`} className="leading-snug">
					{note}
				</li>
			))}
		</ul>
	);
}

export function BiologyDiagram({ spec }: { spec: BiologyDiagramSpec }): React.ReactElement {
	return (
		<div className="w-full max-w-[640px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<svg
				viewBox={`0 0 ${SVG_W} ${SVG_H}`}
				className="h-auto w-full rounded-md border border-border bg-muted/20 text-foreground"
				role="img"
				aria-hidden="true"
			>
				<rect x="18" y="18" width={SVG_W - 36} height={SVG_H - 36} rx="18" className="fill-card stroke-border" />
				<text x="28" y="38" className="fill-muted-foreground text-[12px]">
					{titleCase(spec.subKind)}
				</text>
				{spec.labels.map((label, index) => (
					<g key={label.id}>
						<circle cx={percentX(label.x)} cy={percentY(label.y)} r={index % 2 === 0 ? 18 : 14} className="fill-background stroke-foreground" />
						<text
							x={percentX(label.x)}
							y={percentY(label.y) + 4}
							textAnchor="middle"
							className="fill-foreground text-[12px]"
						>
							{label.text}
						</text>
					</g>
				))}
			</svg>
			<NoteList notes={spec.notes} />
		</div>
	);
}

export function Flowchart({ spec }: { spec: FlowchartSpec }): React.ReactElement {
	const nodeX = (index: number): number => 64 + index * Math.max(92, (SVG_W - 128) / Math.max(1, spec.nodes.length - 1));
	const nodeY = SVG_H / 2;
	const nodeById = new Map(spec.nodes.map((node, index) => [node.id, { ...node, index }]));

	return (
		<div className="w-full max-w-[680px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="h-auto w-full text-foreground" role="img" aria-hidden="true">
				<defs>
					<marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
					</marker>
				</defs>
				{spec.edges.map((edge, index) => {
					const from = nodeById.get(edge.from);
					const to = nodeById.get(edge.to);
					if (!from || !to) return null;
					const x1 = nodeX(from.index) + 44;
					const x2 = nodeX(to.index) - 44;
					const y = nodeY;
					return (
						<g key={`${edge.from}-${edge.to}-${index}`}>
							<line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />
							{edge.label ? (
								<text x={(x1 + x2) / 2} y={y - 12} textAnchor="middle" className="fill-muted-foreground text-[11px]">
									{edge.label}
								</text>
							) : null}
						</g>
					);
				})}
				{spec.nodes.map((node, index) => {
					const x = nodeX(index);
					const y = nodeY;
					const isDecision = node.kind === "decision";
					return (
						<g key={node.id}>
							{isDecision ? (
								<polygon
									points={`${x},${y - 42} ${x + 54},${y} ${x},${y + 42} ${x - 54},${y}`}
									className="fill-card stroke-foreground"
								/>
							) : (
								<rect x={x - 54} y={y - 34} width="108" height="68" rx="10" className="fill-card stroke-foreground" />
							)}
							<text x={x} y={y - (node.detail ? 5 : -4)} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">
								{node.label}
							</text>
							{node.detail ? (
								<text x={x} y={y + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
									{node.detail}
								</text>
							) : null}
						</g>
					);
				})}
			</svg>
		</div>
	);
}

export function Timeline({ spec }: { spec: TimelineSpec }): React.ReactElement {
	return (
		<div className="w-full max-w-[680px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<div className="rounded-md border border-border bg-muted/20 p-3">
				{spec.axisLabel ? <div className="mb-2 text-xs text-muted-foreground">{spec.axisLabel}</div> : null}
				<ol className="relative flex flex-col gap-3 border-l border-border pl-4">
					{spec.events.map((event) => (
						<li key={`${event.dateLabel}-${event.label}`} className="relative">
							<span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-foreground bg-card" />
							<div className={event.emphasis ? "font-semibold text-foreground" : "text-foreground"}>
								<span className="tabular-nums">{event.dateLabel}</span> - {event.label}
							</div>
							{event.description ? <div className="text-xs text-muted-foreground">{event.description}</div> : null}
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}

export function SourceExtract({ spec }: { spec: SourceExtractSpec }): React.ReactElement {
	return (
		<div className="w-full max-w-[640px] rounded-md border border-border bg-muted/20 p-3">
			{spec.title ? <PanelTitle>{spec.title}</PanelTitle> : null}
			{spec.context ? <p className="mb-2 text-xs text-muted-foreground">{spec.context}</p> : null}
			<div className="space-y-1">
				{spec.lines.map((line) => (
					<div key={line.number} className="grid grid-cols-[2.25rem_1fr] gap-2 text-sm leading-relaxed">
						<span className="text-right font-mono text-xs text-muted-foreground">{line.number}</span>
						<span>{line.text}</span>
					</div>
				))}
			</div>
			{spec.source ? <div className="mt-2 text-right text-xs text-muted-foreground">Source: {spec.source}</div> : null}
		</div>
	);
}

export function MapVisual({ spec }: { spec: MapVisualSpec }): React.ReactElement {
	return (
		<div className="w-full max-w-[560px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<div className="rounded-md border border-border bg-muted/20 p-4">
				<div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
					<span>{titleCase(spec.scope)} map</span>
					<span>{titleCase(spec.mapStyle)}</span>
				</div>
				<div className="grid gap-2 medium:grid-cols-2">
					{spec.regions.map((region) => (
						<div key={`${region.id}-${region.role}`} className="rounded border border-border bg-card px-3 py-2">
							<div className="text-sm font-medium text-foreground">{region.label}</div>
							<div className="text-xs text-muted-foreground">{titleCase(region.role)}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function ChemistryCellDiagram({ spec }: { spec: ChemistryCellDiagramSpec }): React.ReactElement {
	const flow = spec.electronFlow === "anode_to_cathode" ? "Anode -> Cathode" : spec.electronFlow === "cathode_to_anode" ? "Cathode -> Anode" : "External source";
	return (
		<div className="w-full max-w-[620px]">
			<PanelTitle>{titleCase(spec.cellType)} cell</PanelTitle>
			<div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 medium:grid-cols-[1fr_auto_1fr]">
				<ElectrodeCard label="Anode" electrode={spec.anode} />
				<div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
					<div className="rounded-full border border-border bg-card px-3 py-1">e- flow</div>
					<div className="mt-1 font-medium text-foreground">{flow}</div>
					{spec.saltBridge ? <div className="mt-2">Salt bridge: {spec.saltBridge}</div> : null}
				</div>
				<ElectrodeCard label="Cathode" electrode={spec.cathode} />
			</div>
			<NoteList notes={spec.labels} />
		</div>
	);
}

function ElectrodeCard({
	label,
	electrode,
}: {
	label: string;
	electrode: ChemistryCellDiagramSpec["anode"];
}): React.ReactElement {
	return (
		<div className="rounded border border-border bg-card p-3 text-sm">
			<div className="font-semibold text-foreground">{label}: {electrode.label}</div>
			<div className="text-muted-foreground">Material: {electrode.material}</div>
			<div className="text-muted-foreground">Electrolyte: {electrode.electrolyte}</div>
			<div className="text-muted-foreground">Polarity: {electrode.polarity}</div>
		</div>
	);
}

export function PhysicsFieldDiagram({ spec }: { spec: PhysicsFieldDiagramSpec }): React.ReactElement {
	const lines = Array.from({ length: spec.fieldLineCount }, (_, index) => index);
	return (
		<div className="w-full max-w-[620px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="h-auto w-full rounded-md border border-border bg-muted/20 text-foreground" role="img" aria-hidden="true">
				<defs>
					<marker id="field-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
						<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
					</marker>
				</defs>
				<text x="18" y="26" className="fill-muted-foreground text-[12px]">
					{titleCase(spec.fieldType)} field
				</text>
				{lines.map((line) => {
					const y = 54 + line * ((SVG_H - 96) / Math.max(1, lines.length - 1));
					return <path key={line} d={`M 54 ${y} C 190 ${y - 36} 330 ${y + 36} 466 ${y}`} fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.45" markerEnd="url(#field-arrow)" />;
				})}
				{spec.sources.map((source) => (
					<g key={`${source.kind}-${source.label}`}>
						<circle cx={percentX(source.x)} cy={percentY(source.y)} r="22" className="fill-card stroke-foreground" />
						<text x={percentX(source.x)} y={percentY(source.y) + 5} textAnchor="middle" className="fill-foreground text-[14px] font-semibold">
							{source.label}
						</text>
					</g>
				))}
				{spec.labels.map((label) => (
					<text key={label.id} x={percentX(label.x)} y={percentY(label.y)} textAnchor="middle" className="fill-foreground text-[12px]">
						{label.text}
					</text>
				))}
			</svg>
		</div>
	);
}

export function PhysicsWaveDiagram({ spec }: { spec: PhysicsWaveDiagramSpec }): React.ReactElement {
	const range = spec.xMax - spec.xMin;
	const samples = 80;
	const wavelength = spec.wavelength ?? range / 2;
	const path = Array.from({ length: samples + 1 }, (_, index) => {
		const t = index / samples;
		const xValue = spec.xMin + t * range;
		const x = 32 + t * (SVG_W - 64);
		const phase = ((xValue - spec.xMin) / wavelength) * Math.PI * 2;
		const y = SVG_H / 2 - Math.sin(phase) * 58;
		return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
	const markerX = (xValue: number): number => 32 + ((xValue - spec.xMin) / range) * (SVG_W - 64);

	return (
		<div className="w-full max-w-[620px]">
			<PanelTitle>{spec.title}</PanelTitle>
			<svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="h-auto w-full text-foreground" role="img" aria-hidden="true">
				<line x1="28" y1={SVG_H / 2} x2={SVG_W - 28} y2={SVG_H / 2} stroke="currentColor" strokeOpacity="0.35" />
				<path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
				<text x="28" y="28" className="fill-muted-foreground text-[12px]">
					{titleCase(spec.waveType)} wave
				</text>
				<text x="28" y={SVG_H - 18} className="fill-muted-foreground text-[11px]">
					Amplitude: {spec.amplitude}{spec.wavelength ? `, wavelength: ${spec.wavelength}` : ""}
				</text>
				{spec.markers.map((marker) => {
					const x = markerX(marker.x);
					return (
						<g key={`${marker.x}-${marker.label}`}>
							<line x1={x} y1="38" x2={x} y2={SVG_H - 42} stroke="currentColor" strokeDasharray="4 3" strokeOpacity="0.55" />
							<text x={x} y="34" textAnchor="middle" className="fill-foreground text-[12px]">
								{marker.label}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}
