"use client";

import * as React from "react";

import { LatexText } from "../latex-text";
import { cn } from "@/lib/utils";

/** True when the string should be rendered via KaTeX (inline `$...$` or bare `\command` fragments). */
export function visualMathNeedsKatex(text: string | null | undefined): boolean {
	if (text == null || text === "") return false;
	const t = text.trim();
	return t.includes("$") || /\\[a-zA-Z]/.test(t);
}

export function visualMathToLatexSource(text: string): string {
	const t = text.trim();
	if (!t) return t;
	if (t.includes("$")) return t;
	if (/\\[a-zA-Z]/.test(t)) return `$${t}$`;
	return t;
}

type SvgMixedTextLabelProps = {
	x: number;
	y: number;
	text: string;
	fontSize?: number;
	textAnchor?: "start" | "middle" | "end";
	className?: string;
};

/**
 * SVG label: native `<text>` for plain labels; `foreignObject` + {@link LatexText} when math is needed.
 */
export function SvgMixedTextLabel({
	x,
	y,
	text,
	fontSize = 12,
	textAnchor = "middle",
	className,
}: SvgMixedTextLabelProps): React.ReactElement {
	const t = text.trim();
	if (!visualMathNeedsKatex(t)) {
		return (
			<text
				x={x}
				y={y}
				textAnchor={textAnchor}
				fontSize={fontSize}
				className={cn("fill-current", className)}
			>
				{t}
			</text>
		);
	}
	const src = visualMathToLatexSource(t);
	const estW = Math.min(300, Math.max(40, Math.ceil(src.length * fontSize * 0.42)));
	const estH = Math.max(30, fontSize * 2.5);
	const foX = textAnchor === "middle" ? x - estW / 2 : textAnchor === "end" ? x - estW : x;
	const foY = y - fontSize * 0.95;
	return (
		<foreignObject x={foX} y={foY} width={estW} height={estH} style={{ overflow: "visible" }}>
			<div
				className={cn(
					"text-foreground flex h-full items-center text-left [&_.katex]:text-[length:inherit]",
					textAnchor === "middle" && "justify-center",
					textAnchor === "end" && "justify-end",
					className,
				)}
				style={{ fontSize: `${fontSize}px`, lineHeight: 1.15 }}
			>
				<LatexText text={src} />
			</div>
		</foreignObject>
	);
}

type ChartAxisLatexLayoutProps = {
	xLabel?: string | null;
	yLabel?: string | null;
	children: React.ReactNode;
	className?: string;
};

/**
 * Wraps a chart: when axis titles contain math, hides default axis titles and renders KaTeX in HTML beside/below the plot.
 */
export function ChartAxisLatexLayout({
	xLabel,
	yLabel,
	children,
	className,
}: ChartAxisLatexLayoutProps): React.ReactElement {
	const xL = xLabel?.trim() ?? "";
	const yL = yLabel?.trim() ?? "";
	const xMath = visualMathNeedsKatex(xL);
	const yMath = visualMathNeedsKatex(yL);

	return (
		<div className={cn("flex w-full max-w-[480px] flex-row items-stretch gap-0", className)}>
			{yMath && yL ? (
				<div className="text-muted-foreground flex w-8 shrink-0 items-center justify-center self-stretch pb-6 text-[11px] [writing-mode:vertical-rl] rotate-180">
					<LatexText text={yL} />
				</div>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col">
				{children}
				{xMath && xL ? (
					<div className="text-muted-foreground -mt-0.5 px-1 pb-0.5 text-center text-[11px] leading-snug">
						<LatexText text={xL} />
					</div>
				) : null}
			</div>
		</div>
	);
}
