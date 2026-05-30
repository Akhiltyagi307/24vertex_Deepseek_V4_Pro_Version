import { Math as PdfMath } from "@react-pdf/math";
import { StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import katex from "katex";

// `@react-pdf/renderer` doesn't re-export the single-style `Style` type (its
// source `@react-pdf/types` isn't hoisted), but it does export `Styles`
// (`{ [key: string]: Style }`), so index it to recover a single style object.
type PdfStyle = Styles[string];

import { normalizeKatexMath } from "@/lib/practice/katex-math-normalize";
import { parseLatexNodes, type LatexNode } from "@/lib/practice/parse-latex-nodes";

const PDF_INK = "#252525";

const styles = StyleSheet.create({
	block: { width: "100%" },
	line: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		width: "100%",
	},
	displayMath: {
		width: "100%",
		alignItems: "center",
		marginVertical: 4,
	},
	lineGap: { height: 5, width: "100%" },
	fallbackMath: {
		fontFamily: "Courier",
		fontSize: 8.5,
		color: PDF_INK,
	},
});

function katexRenders(tex: string): boolean {
	try {
		katex.renderToString(tex, {
			throwOnError: true,
			displayMode: false,
			strict: "ignore",
			trust: false,
			output: "html",
		});
		return true;
	} catch {
		return false;
	}
}

function PdfMathFragment({
	tex,
	display,
	inlineHeight,
	textStyle,
}: {
	tex: string;
	display: boolean;
	inlineHeight: number;
	textStyle?: PdfStyle;
}): ReactElement {
	if (!katexRenders(tex)) {
		return (
			<Text style={textStyle ? [styles.fallbackMath, textStyle] : styles.fallbackMath}>{tex}</Text>
		);
	}
	if (display) {
		return (
			<View style={styles.displayMath}>
				<PdfMath color={PDF_INK}>{tex}</PdfMath>
			</View>
		);
	}
	return (
		<PdfMath inline height={inlineHeight} color={PDF_INK}>
			{tex}
		</PdfMath>
	);
}

function renderInlineLine(
	nodes: LatexNode[],
	inlineHeight: number,
	textStyle: PdfStyle | undefined,
	keyPrefix: string,
): ReactElement {
	const parts: ReactNode[] = [];
	let i = 0;
	for (const node of nodes) {
		if (node.type === "text") {
			if (node.value) {
				parts.push(
					<Text key={`${keyPrefix}-t-${i}`} style={textStyle}>
						{node.value}
					</Text>,
				);
			}
		} else {
			parts.push(
				<PdfMathFragment
					key={`${keyPrefix}-m-${i}`}
					tex={node.value}
					display={false}
					inlineHeight={inlineHeight}
					textStyle={textStyle}
				/>,
			);
		}
		i += 1;
	}
	return (
		<View style={styles.line} wrap>
			{parts}
		</View>
	);
}

/**
 * Renders practice prose with `$...$` / `$$...$$` math for @react-pdf documents.
 * Applies the same delimiter normalisation as the web `LatexText` path.
 */
export function PdfLatexText({
	children,
	style,
	inlineMathHeight = 10,
}: {
	children: string;
	style?: PdfStyle;
	inlineMathHeight?: number;
}): ReactElement {
	const normalized = normalizeKatexMath(children);
	const nodes = parseLatexNodes(normalized);
	const blocks: ReactElement[] = [];
	let inlineBuffer: LatexNode[] = [];
	let blockKey = 0;

	const flushInline = () => {
		if (inlineBuffer.length === 0) return;
		blocks.push(
			renderInlineLine(inlineBuffer, inlineMathHeight, style, `line-${blockKey}`),
		);
		blockKey += 1;
		inlineBuffer = [];
	};

	const pushLineBreak = () => {
		flushInline();
		blocks.push(<View key={`gap-${blockKey}`} style={styles.lineGap} />);
		blockKey += 1;
	};

	for (const node of nodes) {
		if (node.type === "math" && node.display) {
			flushInline();
			blocks.push(
				<PdfMathFragment
					key={`disp-${blockKey}`}
					tex={node.value}
					display
					inlineHeight={inlineMathHeight}
					textStyle={style}
				/>,
			);
			blockKey += 1;
			continue;
		}

		if (node.type === "math") {
			inlineBuffer.push(node);
			continue;
		}

		const segments = node.value.split("\n");
		segments.forEach((segment, segIdx) => {
			if (segIdx > 0) pushLineBreak();
			if (!segment) return;
			inlineBuffer.push({ type: "text", value: segment });
		});
	}

	flushInline();

	if (blocks.length === 0) {
		return (
			<Text style={style} wrap>
				{children || "—"}
			</Text>
		);
	}

	return <View style={styles.block}>{blocks}</View>;
}
