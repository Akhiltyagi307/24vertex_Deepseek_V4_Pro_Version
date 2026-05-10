"use client";

import * as React from "react";
import SmilesDrawer from "smiles-drawer";

import type { ChemistryMoleculeSpec } from "@/lib/practice/visuals/types";

const SVG_WIDTH = 320;
const SVG_HEIGHT = 220;

/**
 * `chemistry_molecule` renderer.
 *
 * Wraps smiles-drawer (pure JS, zero deps beyond chroma-js). Parses the
 * SMILES string into a tree and asks SvgDrawer to render the molecule
 * into an SVG element we own via a ref. Bad SMILES surfaces as a small
 * "could not parse" message rather than a half-rendered chart.
 *
 * Theme: smiles-drawer ships a 'light' / 'dark' theme; we always pass
 * 'light' for legibility in v1 and rely on the surrounding figure shell
 * for visual context. The schema's `display: "3d"` is accepted but v1
 * always renders 2D — 3D depends on `3dmol` which is not installed.
 */
export function ChemistryMolecule({
	spec,
}: {
	spec: ChemistryMoleculeSpec;
}): React.ReactElement {
	const svgRef = React.useRef<SVGSVGElement | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return undefined;
		svg.innerHTML = "";
		try {
			(SmilesDrawer as unknown as {
				parse(
					smi: string,
					ok: (tree: unknown) => void,
					err: (e: unknown) => void,
				): void;
			}).parse(
				spec.smiles,
				(tree) => {
					try {
						const drawer = new (SmilesDrawer as unknown as {
							SvgDrawer: new (opts: Record<string, unknown>) => {
								draw(tree: unknown, target: SVGSVGElement, themeName: string): void;
							};
						}).SvgDrawer({
							width: SVG_WIDTH,
							height: SVG_HEIGHT,
							bondThickness: 1.1,
							compactDrawing: false,
							terminalCarbons: false,
							explicitHydrogens: false,
						});
						drawer.draw(tree, svg, "light");
						setError(null);
					} catch (e) {
						setError(e instanceof Error ? e.message : "Could not draw molecule.");
					}
				},
				(e) => {
					setError(e instanceof Error ? e.message : "Could not parse SMILES.");
				},
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not parse SMILES.");
		}
		return () => {
			if (svg) svg.innerHTML = "";
		};
	}, [spec.smiles]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Could not render molecule.</span>
				<code className="text-xs">{spec.smiles}</code>
			</div>
		);
	}

	return (
		<svg
			ref={svgRef}
			width={SVG_WIDTH}
			height={SVG_HEIGHT}
			viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
			role="img"
			aria-hidden="true"
			className="text-foreground"
		/>
	);
}
