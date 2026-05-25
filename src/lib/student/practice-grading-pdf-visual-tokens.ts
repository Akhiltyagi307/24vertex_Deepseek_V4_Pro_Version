import { StyleSheet } from "@react-pdf/renderer";

import india from "@svg-maps/india";

import { parseSvgViewBox } from "@/lib/practice/visuals/india-map-regions";

export const PDF_VISUAL_WIDTH = 360;
export const PDF_VISUAL_HEIGHT = 220;

/** Height scales with @svg-maps/india aspect ratio when rendered at PDF_VISUAL_WIDTH. */
export function indiaMapPdfHeight(): number {
	const { vw, vh } = parseSvgViewBox(india.viewBox);
	return vw > 0 ? Math.round((vh / vw) * PDF_VISUAL_WIDTH) : 410;
}

// Design-token hex literals. Matches the on-screen palette closely enough
// for visual recognition; the PDF stays consistent across light/dark since
// Adobe Reader has no theme.
export const TOKEN = {
	foreground: "#0f172a",
	muted: "#64748b",
	border: "#cbd5e1",
	primary: "#3b82f6",
	secondary: "#10b981",
	accent: "#f59e0b",
	red: "#ef4444",
	cardBg: "#f8fafc",
} as const;

export const pdfVisualStyles = StyleSheet.create({
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
