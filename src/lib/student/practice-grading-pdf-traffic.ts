import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

/**
 * 24Vertex brand greens for PDF output.
 * Use solid hex only: @react-pdf/renderer often mis-renders rgba borders as orange/red.
 */
export const PDF_BRAND = {
	green: "#2ea070",
	greenDeep: "#1d6b45",
	/** Light mint fill (~8% brand on white). */
	greenSoft: "#eef7f3",
	/** Solid brand stroke for summary chips and insights (always green). */
	greenBorder: "#2ea070",
} as const;

/** PDF traffic-light palette (no red borders; third band uses deep amber). */
export const PDF_TRAFFIC = {
	signalOnGreen: PDF_BRAND.green,
	signalOnAmber: "#f59e0b",
	signalOnOrange: "#ea580c",
	signalOff: "#e5e5e5",
	greenBg: PDF_BRAND.greenSoft,
	greenBorder: PDF_BRAND.greenBorder,
	greenInk: PDF_BRAND.greenDeep,
	amberBg: "#fef3c7",
	amberBorder: "#f59e0b",
	amberInk: "#92400e",
	orangeBg: "#fff7ed",
	orangeBorder: "#fdba74",
	orangeInk: "#c2410c",
	/** Cover summary chips + insights box: always brand-green border. */
	chipBorder: PDF_BRAND.greenBorder,
	chipInk: PDF_BRAND.greenDeep,
	chipBg: PDF_BRAND.greenSoft,
} as const;

export type PdfTrafficTone = {
	/** 0 = green, 1 = amber, 2 = orange */
	signalIndex: 0 | 1 | 2;
	pillBg: string;
	pillFg: string;
	pillBorder: string;
	scoreBg: string;
	scoreBorder: string;
	scoreFg: string;
	scoreLabelFg: string;
	tableInk: string;
};

export function pdfTrafficFromVerdict(verdict: GradedQuestionItem["verdict"]): PdfTrafficTone {
	if (verdict === "correct") {
		return {
			signalIndex: 0,
			pillBg: PDF_TRAFFIC.greenBg,
			pillFg: PDF_TRAFFIC.greenInk,
			pillBorder: PDF_TRAFFIC.greenBorder,
			scoreBg: PDF_TRAFFIC.greenBg,
			scoreBorder: PDF_TRAFFIC.greenBorder,
			scoreFg: PDF_TRAFFIC.greenInk,
			scoreLabelFg: PDF_TRAFFIC.greenInk,
			tableInk: PDF_TRAFFIC.greenInk,
		};
	}
	if (verdict === "partially_correct") {
		return {
			signalIndex: 1,
			pillBg: PDF_TRAFFIC.amberBg,
			pillFg: PDF_TRAFFIC.amberInk,
			pillBorder: PDF_TRAFFIC.amberBorder,
			scoreBg: PDF_TRAFFIC.amberBg,
			scoreBorder: PDF_TRAFFIC.amberBorder,
			scoreFg: PDF_TRAFFIC.amberInk,
			scoreLabelFg: PDF_TRAFFIC.amberInk,
			tableInk: PDF_TRAFFIC.amberInk,
		};
	}
	return {
		signalIndex: 2,
		pillBg: PDF_TRAFFIC.orangeBg,
		pillFg: PDF_TRAFFIC.orangeInk,
		pillBorder: PDF_TRAFFIC.orangeBorder,
		scoreBg: PDF_TRAFFIC.orangeBg,
		scoreBorder: PDF_TRAFFIC.orangeBorder,
		scoreFg: PDF_TRAFFIC.orangeInk,
		scoreLabelFg: PDF_TRAFFIC.orangeInk,
		tableInk: PDF_TRAFFIC.orangeInk,
	};
}

/** Topic table avg/status columns use the same 75 / 50 bands as the app matrix. */
export function pdfTrafficFromScorePercent(score: number | null): PdfTrafficTone | undefined {
	if (score == null || Number.isNaN(score)) return undefined;
	if (score >= 75) return pdfTrafficFromVerdict("correct");
	if (score >= 50) return pdfTrafficFromVerdict("partially_correct");
	return pdfTrafficFromVerdict("incorrect");
}

export function pdfTrafficVerdictLabel(verdict: GradedQuestionItem["verdict"]): string {
	if (verdict === "correct") return "Correct";
	if (verdict === "partially_correct") return "Partial credit";
	return "Incorrect";
}
