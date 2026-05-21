import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { formatDuration } from "@/lib/student/subject-test-report";
import { clampGenerationBlockForPdf, splitFeedbackForTwoQuestionPages } from "@/lib/student/practice-grading-pdf-chunks";
import type { GradedQuestionItem, PracticeGradingSummary } from "@/lib/practice/grading-schema";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";
import { QuestionVisualPdf } from "@/lib/student/practice-grading-pdf-visual";

/**
 * Print theme: refined editorial PDF design — strong typographic hierarchy,
 * 24Vertex brand (#2ea070) accents, semantic verdict colors, hero score on cover,
 * accent bars on section labels, and zebra-striped tables.
 * Tight radii, hairline borders, top accent rule — Supabase Studio inspired.
 */
const pdf = {
	/** Light theme `foreground` (oklch(0.145 0 0) ≈) */
	ink: "#0a0a0a",
	inkSubtle: "#404040",
	muted: "#737373",
	muted2: "#a3a3a3",
	border: "#e5e5e5",
	borderStrong: "#d4d4d4",
	borderSubtle: "#f0f0f0",
	/** Studio-like canvas */
	canvas: "#fafafa",
	surface: "#ffffff",
	/** --primary solid (dark mode / brand usage) */
	brand: "#2ea070",
	brandDim: "#1d6b45",
	brandDeep: "#0f4a30",
	brandSoft: "rgba(46, 160, 112, 0.08)",
	brandSofter: "rgba(46, 160, 112, 0.04)",
	brandTint: "rgba(46, 160, 112, 0.22)",
	/** --destructive */
	destructive: "#e55353",
	destructiveSoft: "rgba(229, 83, 83, 0.10)",
	destructiveInk: "#b91c1c",
	/** Warning / partial-credit (amber 500 / 700-ish) */
	warning: "#f59e0b",
	warningSoft: "#fef3c7",
	warningInk: "#92400e",
	/** Success ink for status text */
	successInk: "#15803d",
	tHead: "#f5f5f5",
	tStripe: "#fafafa",
} as const;

const styles = StyleSheet.create({
	brandTopRule: { height: 4, width: "100%", backgroundColor: pdf.brand },
	cover: {
		padding: 0,
		fontSize: 10,
		fontFamily: "Helvetica",
		backgroundColor: pdf.canvas,
		color: pdf.ink,
		minHeight: "100%",
	},
	coverInner: { padding: 28, paddingTop: 22 },
	coverHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	coverKicker: {
		fontSize: 8,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.5,
		textTransform: "uppercase",
	},
	coverTitle: {
		fontSize: 28,
		fontFamily: "Helvetica-Bold",
		marginBottom: 3,
		marginTop: 4,
		color: pdf.ink,
		letterSpacing: -0.6,
	},
	coverSub: { fontSize: 9.5, color: pdf.muted, marginBottom: 4, lineHeight: 1.4 },
	heroLine: { fontSize: 9.5, color: pdf.inkSubtle, marginBottom: 4 },
	logo: { width: 40, height: 40 },
	wordmark: {
		fontSize: 13,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: 0.2,
	},
	// Hero score card (replaces "Overall score" tile with a prominent treatment)
	heroScoreCard: {
		marginTop: 12,
		marginBottom: 8,
		paddingVertical: 14,
		paddingHorizontal: 16,
		backgroundColor: pdf.surface,
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 6,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderLeftWidth: 4,
		borderLeftColor: pdf.brand,
	},
	heroScoreLeft: { flexDirection: "column" },
	heroScoreLabel: {
		fontSize: 7.5,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	heroScoreValue: {
		fontSize: 38,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: -1.2,
		lineHeight: 1,
	},
	heroScoreCaption: {
		fontSize: 9,
		color: pdf.muted,
		marginTop: 5,
	},
	heroScoreRight: {
		alignItems: "flex-end",
		flexDirection: "column",
		maxWidth: "55%",
	},
	heroStat: {
		fontSize: 9.5,
		color: pdf.ink,
		marginBottom: 1,
		textAlign: "right",
	},
	heroStatLabel: {
		fontSize: 6.5,
		color: pdf.muted,
		letterSpacing: 0.8,
		textTransform: "uppercase",
		fontFamily: "Helvetica-Bold",
		marginBottom: 1,
		textAlign: "right",
	},
	metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 0 },
	metaCard: {
		width: "32%",
		marginRight: "2%",
		marginBottom: 8,
		backgroundColor: pdf.surface,
		borderRadius: 5,
		padding: 11,
		borderWidth: 1,
		borderColor: pdf.border,
	},
	metaCardLast: {
		marginRight: 0,
	},
	metaLabel: {
		fontSize: 7,
		color: pdf.muted,
		marginBottom: 4,
		letterSpacing: 0.7,
		textTransform: "uppercase",
		fontFamily: "Helvetica-Bold",
	},
	metaValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: pdf.ink, letterSpacing: -0.2 },
	// Cover section labels — accent bar + uppercase strong label
	sectionLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 14,
		marginBottom: 6,
	},
	sectionLabelRowTight: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 0,
		marginBottom: 5,
	},
	sectionLabelBar: {
		width: 3,
		height: 9,
		backgroundColor: pdf.brand,
		marginRight: 6,
		borderRadius: 1,
	},
	sectionLabel: {
		fontSize: 8.5,
		color: pdf.ink,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	sectionLabelTight: {
		fontSize: 7.5,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.9,
		marginTop: 0,
		marginBottom: 5,
	},
	coverageTable: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 5,
		overflow: "hidden",
		marginTop: 0,
		backgroundColor: pdf.surface,
	},
	coverageRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: pdf.borderSubtle,
	},
	coverageRowAlt: {
		backgroundColor: pdf.tStripe,
	},
	coverageRowHead: {
		backgroundColor: pdf.tHead,
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	coverageCell: {
		flex: 1,
		padding: 7,
		fontSize: 8.5,
		color: pdf.ink,
		lineHeight: 1.35,
	},
	coverageCellNarrow: {
		width: "16%",
		padding: 7,
		fontSize: 8.5,
		color: pdf.ink,
	},
	coverageHead: {
		fontFamily: "Helvetica-Bold",
		color: pdf.muted,
		fontSize: 6.8,
		textTransform: "uppercase",
		letterSpacing: 0.7,
	},
	statusGood: { color: pdf.successInk, fontFamily: "Helvetica-Bold" },
	statusWarn: { color: pdf.warningInk, fontFamily: "Helvetica-Bold" },
	statusBad: { color: pdf.destructiveInk, fontFamily: "Helvetica-Bold" },
	scoreCellGood: { color: pdf.successInk, fontFamily: "Helvetica-Bold" },
	scoreCellWarn: { color: pdf.warningInk, fontFamily: "Helvetica-Bold" },
	scoreCellBad: { color: pdf.destructiveInk, fontFamily: "Helvetica-Bold" },
	summaryNarrative: {
		marginTop: 0,
		padding: 13,
		paddingLeft: 14,
		backgroundColor: pdf.surface,
		borderLeftWidth: 3,
		borderLeftColor: pdf.brand,
		borderRadius: 5,
		borderTopWidth: 1,
		borderRightWidth: 1,
		borderBottomWidth: 1,
		borderTopColor: pdf.border,
		borderRightColor: pdf.border,
		borderBottomColor: pdf.border,
	},
	summaryNarrativeText: { fontSize: 9.5, color: pdf.ink, lineHeight: 1.55 },
	/** Brand-tinted tag rows (replaces • bullets) */
	tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 0 },
	tagChip: {
		borderWidth: 1,
		borderColor: pdf.brandTint,
		backgroundColor: pdf.brandSoft,
		borderRadius: 3,
		paddingVertical: 4,
		paddingHorizontal: 7,
		marginRight: 5,
		marginBottom: 5,
	},
	tagChipText: { fontSize: 8.5, color: pdf.brandDeep, lineHeight: 1.35 },
	twoColRow: { flexDirection: "row", marginTop: 4 },
	twoCol: { width: "49%", marginRight: "1%" },
	insightsBox: {
		marginTop: 8,
		padding: 12,
		backgroundColor: pdf.brandSoft,
		borderRadius: 5,
		borderWidth: 1,
		borderColor: pdf.brandTint,
	},
	insightsLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 5,
	},
	insightsBar: {
		width: 3,
		height: 8,
		backgroundColor: pdf.brand,
		marginRight: 6,
		borderRadius: 1,
	},
	insightsLabel: {
		fontSize: 8,
		color: pdf.brandDeep,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	insightsText: { fontSize: 9.5, color: pdf.brandDeep, lineHeight: 1.5 },
	footer: {
		position: "absolute",
		bottom: 18,
		left: 28,
		right: 28,
		fontSize: 7.5,
		color: pdf.muted2,
		textAlign: "center",
		letterSpacing: 0.4,
	},

	// Question pages
	qPage: { padding: 0, fontSize: 11, fontFamily: "Helvetica", backgroundColor: pdf.canvas },
	qPageInner: { padding: 32, paddingTop: 28 },
	qHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	logoSm: { width: 32, height: 32 },
	qTitleBlock: { flex: 1, paddingRight: 12 },
	qNumberKicker: {
		fontSize: 8,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.3,
		textTransform: "uppercase",
		marginBottom: 3,
	},
	qLocation: {
		fontSize: 11,
		color: pdf.ink,
		fontFamily: "Helvetica-Bold",
		marginTop: 1,
		lineHeight: 1.35,
		letterSpacing: -0.1,
	},
	qBadgeRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, alignItems: "center" },
	verdictPill: {
		borderRadius: 3,
		paddingVertical: 3,
		paddingHorizontal: 8,
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		borderWidth: 1,
		letterSpacing: 0.6,
		textTransform: "uppercase",
	},
	scorePillWrap: {
		backgroundColor: pdf.brandSoft,
		borderWidth: 1,
		borderColor: pdf.brandTint,
		borderRadius: 6,
		paddingVertical: 6,
		paddingHorizontal: 14,
		marginTop: 6,
		alignItems: "center",
	},
	scorePillLabel: {
		fontSize: 6.5,
		color: pdf.brandDim,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.9,
		textTransform: "uppercase",
		marginBottom: 1,
	},
	scorePill: {
		fontSize: 24,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: -0.5,
		lineHeight: 1,
	},
	loc: { fontSize: 8.5, color: pdf.muted, lineHeight: 1.4 },
	section: { marginBottom: 12 },
	sectionLabelQRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 6,
	},
	sectionLabelQBar: {
		width: 3,
		height: 8,
		backgroundColor: pdf.brand,
		marginRight: 6,
		borderRadius: 1,
	},
	sectionLabelQ: {
		fontSize: 8,
		color: pdf.ink,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.9,
		textTransform: "uppercase",
	},
	sectionBody: { fontSize: 11, lineHeight: 1.6, color: pdf.ink },
	card: {
		borderWidth: 1,
		borderColor: pdf.border,
		backgroundColor: pdf.surface,
		borderRadius: 5,
		padding: 12,
		marginTop: 0,
	},
	cardAnswerKey: {
		borderWidth: 1,
		borderColor: pdf.brandTint,
		backgroundColor: pdf.brandSofter,
		borderRadius: 5,
		padding: 12,
		marginTop: 0,
	},
	cardFeedback: {
		borderWidth: 1,
		borderColor: pdf.border,
		backgroundColor: pdf.surface,
		borderRadius: 5,
		padding: 12,
		marginTop: 0,
		borderLeftWidth: 3,
		borderLeftColor: pdf.brand,
	},
	atGlance: {
		marginTop: 6,
		paddingVertical: 5,
		paddingHorizontal: 8,
		backgroundColor: pdf.canvas,
		borderRadius: 3,
		borderLeftWidth: 2,
		borderLeftColor: pdf.borderStrong,
	},
	atGlanceText: { fontSize: 8.5, color: pdf.inkSubtle, lineHeight: 1.45, fontStyle: "italic" },
	continuedHint: {
		fontSize: 9,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		marginTop: 2,
		letterSpacing: 0.3,
	},
});

/** Keep the dark "test details" section to a single printed page (no wrap). */
const PDF_COVER_NARRATIVE_MAX = 1000;
const PDF_COVER_INSIGHTS_MAX = 480;
const PDF_COVER_TOPIC_ROWS_MAX = 10;
const PDF_COVER_TRUNC_NOTE = "\n\n[Longer detail is available in the in-app report for this practice test.]";

function truncateForSinglePage(text: string, maxChars: number): { text: string; wasTruncated: boolean } {
	const t = text.trim();
	if (t.length <= maxChars) return { text: t, wasTruncated: false };
	const cap = Math.max(0, maxChars - PDF_COVER_TRUNC_NOTE.length);
	return { text: `${t.slice(0, cap).trimEnd()}${PDF_COVER_TRUNC_NOTE}`, wasTruncated: true };
}

function formatStatusForPdf(raw: string): string {
	const t = raw.trim();
	if (!t || t === "—") return "—";
	if (t.length <= 3) return t.toUpperCase();
	return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	try {
		return formatDateTimeMediumShortInAppTimeZone(iso);
	} catch {
		return "—";
	}
}

function formatQType(t: string): string {
	return t.replace(/_/g, " ");
}

function verdictStyles(v: GradedQuestionItem["verdict"]): { bg: string; fg: string; border: string; label: string } {
	/** Match app badge intent: success (emerald family), warning (amber), destructive (#e55353). */
	if (v === "correct") {
		return { bg: pdf.brandSoft, fg: pdf.successInk, border: pdf.brandTint, label: "Correct" };
	}
	if (v === "partially_correct") {
		return { bg: pdf.warningSoft, fg: pdf.warningInk, border: pdf.warning, label: "Partial credit" };
	}
	return { bg: pdf.destructiveSoft, fg: pdf.destructiveInk, border: "rgba(229, 83, 83, 0.4)", label: "Incorrect" };
}

/** Color the score / status by performance threshold. */
function scoreColorStyle(avg: number | null): { color: string; fontFamily: "Helvetica-Bold" } | undefined {
	if (avg == null) return undefined;
	if (avg >= 75) return styles.scoreCellGood as { color: string; fontFamily: "Helvetica-Bold" };
	if (avg >= 50) return styles.scoreCellWarn as { color: string; fontFamily: "Helvetica-Bold" };
	return styles.scoreCellBad as { color: string; fontFamily: "Helvetica-Bold" };
}

export type TopicCoverageRow = {
	chapterName: string;
	topicName: string;
	unitName: string | null;
	grade: number | null;
	averageScore: number | null;
	statusLabel: string;
};

export type PracticeGradingPdfQuestion = GradedQuestionItem & {
	question_number: number;
	question_text: string;
	question_type: string;
	topic_name: string;
	chapter_name: string;
	unit_name: string | null;
	grade: number | null;
	student_answer_display: string;
	question_difficulty: string | null;
	/** Preformatted from questions.answer_key + options (generation pipeline). */
	generation_answer_display: string;
	/**
	 * Stored visual envelope (parsed from `questions.metadata.visual`).
	 * Null when the question has no visual or the envelope failed to parse —
	 * in either case the PDF skips the visual section entirely.
	 */
	visual: QuestionVisualEnvelope | null;
};

export type PracticeGradingPdfCoverProps = {
	subjectName: string;
	studentDisplayName: string | null;
	difficulty: string | null;
	timeLimitSeconds: number | null;
	durationSeconds: number | null;
	testDateIso: string | null;
	createdAtIso: string | null;
	topicCoverageRows: TopicCoverageRow[];
	totalQuestions: number;
	overallScorePercent: number | null;
	summary: PracticeGradingSummary;
	/** Filesystem path to logo PNG for @react-pdf Image, or null to show wordmark */
	logoSrc: string | Buffer | null;
};

export type PracticeGradingPdfDocumentProps = PracticeGradingPdfCoverProps & {
	questions: PracticeGradingPdfQuestion[];
};

function BrandedTopRight({ logoSrc }: { logoSrc: string | Buffer | null }) {
	if (logoSrc) {
		/* @react-pdf/renderer's Image is not a DOM <img>; no alt in types. */
		// eslint-disable-next-line jsx-a11y/alt-text -- PDF logo, decorative in document
		return <Image src={logoSrc} style={styles.logo} />;
	}
	return <Text style={styles.wordmark}>24Vertex</Text>;
}

function QHeaderRight({ logoSrc }: { logoSrc: string | Buffer | null }) {
	if (logoSrc) {
		// eslint-disable-next-line jsx-a11y/alt-text -- PDF logo, decorative in document
		return <Image src={logoSrc} style={styles.logoSm} />;
	}
	return <Text style={[styles.wordmark, { fontSize: 12 }]}>24Vertex</Text>;
}

function TagChipList({ items }: { items: string[] }) {
	if (!items.length) return null;
	return (
		<View style={styles.tagRow} wrap>
			{items.map((s, i) => (
				<View key={i} style={styles.tagChip} wrap={false}>
					<Text style={styles.tagChipText}>{s}</Text>
				</View>
			))}
		</View>
	);
}

/** Section label with brand accent bar — used on the cover page. */
function CoverSectionLabel({ children, tight }: { children: ReactNode; tight?: boolean }) {
	return (
		<View style={tight ? styles.sectionLabelRowTight : styles.sectionLabelRow} wrap={false}>
			<View style={styles.sectionLabelBar} />
			<Text style={styles.sectionLabel}>{children}</Text>
		</View>
	);
}

/** Section label with brand accent bar — used on question pages. */
function QSectionLabel({ children }: { children: ReactNode }) {
	return (
		<View style={styles.sectionLabelQRow} wrap={false}>
			<View style={styles.sectionLabelQBar} />
			<Text style={styles.sectionLabelQ}>{children}</Text>
		</View>
	);
}

function GlobalFooter() {
	return (
		<Text
			style={styles.footer}
			fixed
			render={({ pageNumber, totalPages }) =>
				`24Vertex  ·  Confidential practice report  ·  ${pageNumber} / ${totalPages}`
			}
		/>
	);
}

function ReportCoverPage(props: PracticeGradingPdfCoverProps) {
	const {
		subjectName,
		studentDisplayName,
		difficulty,
		timeLimitSeconds,
		durationSeconds,
		testDateIso,
		createdAtIso,
		topicCoverageRows,
		totalQuestions,
		overallScorePercent,
		summary,
		logoSrc,
	} = props;

	const narrative = truncateForSinglePage(summary.overall_summary ?? "", PDF_COVER_NARRATIVE_MAX);
	const insightsRaw = summary.ai_insights?.trim() ?? "";
	const insights = insightsRaw
		? truncateForSinglePage(insightsRaw, PDF_COVER_INSIGHTS_MAX)
		: { text: "", wasTruncated: false };

	const topicOverflow = topicCoverageRows.length > PDF_COVER_TOPIC_ROWS_MAX;
	const topicRowsShown = topicOverflow ? topicCoverageRows.slice(0, PDF_COVER_TOPIC_ROWS_MAX) : topicCoverageRows;
	const restCount = topicCoverageRows.length - topicRowsShown.length;

	const strengths = summary.strengths ?? [];
	const focus = summary.improvement_areas ?? [];
	const recs = summary.recommendations ?? [];
	const useTwoCol = strengths.length > 0 && focus.length > 0;

	const dateLine = formatDate(testDateIso ?? createdAtIso);
	const overallScoreLabel = overallScorePercent != null ? `${Math.round(overallScorePercent)}%` : "—";

	return (
		<Page size="A4" style={styles.cover} wrap={false}>
			<View style={styles.brandTopRule} />
			<View style={styles.coverInner} wrap={false}>
				<View style={styles.coverHeaderRow} wrap={false}>
					<Text style={styles.coverKicker}>Practice test report</Text>
					<BrandedTopRight logoSrc={logoSrc} />
				</View>
				<Text style={styles.coverTitle}>{subjectName}</Text>
				<Text style={styles.coverSub}>
					{dateLine} · {totalQuestions} {totalQuestions === 1 ? "question" : "questions"}
				</Text>

				{/* Hero score panel — overall score + identification context */}
				<View style={styles.heroScoreCard} wrap={false}>
					<View style={styles.heroScoreLeft}>
						<Text style={styles.heroScoreLabel}>Overall score</Text>
						<Text style={styles.heroScoreValue}>{overallScoreLabel}</Text>
						<Text style={styles.heroScoreCaption}>
							Across {totalQuestions} {totalQuestions === 1 ? "question" : "questions"}
						</Text>
					</View>
					<View style={styles.heroScoreRight}>
						{studentDisplayName ? (
							<>
								<Text style={styles.heroStatLabel}>Student</Text>
								<Text style={styles.heroStat}>{studentDisplayName}</Text>
							</>
						) : null}
						<Text style={[styles.heroStatLabel, studentDisplayName ? { marginTop: 8 } : {}]}>
							Subject
						</Text>
						<Text style={styles.heroStat}>{subjectName}</Text>
					</View>
				</View>

				<View style={styles.metaGrid}>
					<View style={styles.metaCard}>
						<Text style={styles.metaLabel}>Test difficulty</Text>
						<Text style={styles.metaValue}>{difficulty?.trim() ? difficulty : "—"}</Text>
					</View>
					<View style={styles.metaCard}>
						<Text style={styles.metaLabel}>Time limit</Text>
						<Text style={styles.metaValue}>
							{timeLimitSeconds != null ? formatDuration(timeLimitSeconds) : "—"}
						</Text>
					</View>
					<View style={[styles.metaCard, styles.metaCardLast]}>
						<Text style={styles.metaLabel}>Time taken</Text>
						<Text style={styles.metaValue}>{formatDuration(durationSeconds)}</Text>
					</View>
				</View>

				<CoverSectionLabel>Topics and Chapters</CoverSectionLabel>
				<View style={styles.coverageTable}>
					<View style={styles.coverageRowHead} wrap={false}>
						<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Chapter</Text>
						<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Topic</Text>
						<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Avg</Text>
						<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Status</Text>
					</View>
					{topicRowsShown.map((row, i) => {
						const scoreStyle = scoreColorStyle(row.averageScore);
						const isAlt = i % 2 === 1;
						return (
							<View
								key={i}
								style={isAlt ? [styles.coverageRow, styles.coverageRowAlt] : styles.coverageRow}
								wrap={false}
							>
								<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.chapterName}</Text>
								<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.topicName}</Text>
								<Text style={scoreStyle ? [styles.coverageCellNarrow, scoreStyle] : styles.coverageCellNarrow}>
									{row.averageScore != null ? `${row.averageScore.toFixed(0)}%` : "—"}
								</Text>
								<Text style={scoreStyle ? [styles.coverageCellNarrow, scoreStyle] : styles.coverageCellNarrow}>
									{formatStatusForPdf(row.statusLabel)}
								</Text>
							</View>
						);
					})}
					{topicOverflow ? (
						<View style={[styles.coverageRow, { borderBottomWidth: 0 }]} wrap={false}>
							<Text style={{ padding: 6, fontSize: 7, color: pdf.muted, fontStyle: "italic" }}>
								… and {restCount} more topic{restCount === 1 ? "" : "s"} (see in-app report)
							</Text>
						</View>
					) : null}
				</View>

				<CoverSectionLabel>How you did</CoverSectionLabel>
				<View style={styles.summaryNarrative} wrap={false}>
					<Text style={styles.summaryNarrativeText}>{narrative.text}</Text>
				</View>

				{useTwoCol ? (
					<View style={styles.twoColRow} wrap={false}>
						<View style={styles.twoCol} wrap={false}>
							<CoverSectionLabel tight>Strengths</CoverSectionLabel>
							<TagChipList items={strengths} />
						</View>
						<View style={styles.twoCol} wrap={false}>
							<CoverSectionLabel tight>Focus areas</CoverSectionLabel>
							<TagChipList items={focus} />
						</View>
					</View>
				) : (
					<>
						{strengths.length ? (
							<View wrap={false}>
								<CoverSectionLabel>Strengths</CoverSectionLabel>
								<TagChipList items={strengths} />
							</View>
						) : null}
						{focus.length ? (
							<View wrap={false}>
								<CoverSectionLabel>Focus areas</CoverSectionLabel>
								<TagChipList items={focus} />
							</View>
						) : null}
					</>
				)}

				{recs.length ? (
					<View wrap={false}>
						<CoverSectionLabel>Recommendations</CoverSectionLabel>
						<TagChipList items={recs} />
					</View>
				) : null}

				{insights.text ? (
					<View style={styles.insightsBox} wrap={false}>
						<View style={styles.insightsLabelRow} wrap={false}>
							<View style={styles.insightsBar} />
							<Text style={styles.insightsLabel}>Insights</Text>
						</View>
						<Text style={styles.insightsText}>{insights.text}</Text>
					</View>
				) : null}
			</View>
			<GlobalFooter />
		</Page>
	);
}

type QuestionPageHeaderProps = {
	q: PracticeGradingPdfQuestion;
	logoSrc: string | Buffer | null;
	continued?: boolean;
	sectionHint?: string;
};

function QuestionPageHeader({ q, logoSrc, continued, sectionHint }: QuestionPageHeaderProps) {
	const v = verdictStyles(q.verdict);
	return (
		<View style={styles.qHeaderRow} wrap={false}>
			<View style={styles.qTitleBlock}>
				<Text style={styles.qNumberKicker}>
					Question {q.question_number}  ·  {formatQType(q.question_type)}
					{continued ? "  ·  continued" : ""}
				</Text>
				{sectionHint ? <Text style={styles.continuedHint}>{sectionHint}</Text> : null}
				<Text style={styles.qLocation} wrap>
					{q.chapter_name}
					{q.unit_name ? ` · ${q.unit_name}` : ""}
					{q.grade != null ? ` · Grade ${q.grade}` : ""}
					{q.topic_name ? ` · ${q.topic_name}` : ""}
				</Text>
				{q.question_difficulty ? (
					<Text style={[styles.loc, { marginTop: 3 }]}>Item difficulty: {q.question_difficulty}</Text>
				) : null}
				<View style={styles.qBadgeRow} wrap={false}>
					<Text
						style={[
							styles.verdictPill,
							{ backgroundColor: v.bg, color: v.fg, borderColor: v.border, marginRight: 4 },
						]}
					>
						{v.label}
					</Text>
				</View>
			</View>
			<View style={{ alignItems: "flex-end" }}>
				<QHeaderRight logoSrc={logoSrc} />
				<View style={styles.scorePillWrap} wrap={false}>
					<Text style={styles.scorePillLabel}>Score</Text>
					<Text style={styles.scorePill}>{Math.round(q.score)}%</Text>
				</View>
			</View>
		</View>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<QSectionLabel>{label}</QSectionLabel>
			{children}
		</View>
	);
}

function QuestionFooter({ q, nQuestions }: { q: PracticeGradingPdfQuestion; nQuestions: number }) {
	return (
		<Text
			style={[styles.footer, { position: "absolute", color: pdf.muted2 }]}
			fixed
			render={({ pageNumber, totalPages }) =>
				`Q ${q.question_number} of ${nQuestions}  ·  ${pageNumber} / ${totalPages}`
			}
		/>
	);
}

function renderQuestionPageSequence(
	q: PracticeGradingPdfQuestion,
	nQuestions: number,
	logoSrc: string | Buffer | null,
): ReactElement[] {
	const gen = clampGenerationBlockForPdf(q.generation_answer_display);
	const { page1, page2 } = splitFeedbackForTwoQuestionPages(q.analysis, q.step_by_step_solution);

	const pages: ReactElement[] = [];

	pages.push(
		<Page key={`${q.question_id}-p0`} size="A4" style={styles.qPage} wrap>
			<View style={styles.brandTopRule} />
			<View style={styles.qPageInner}>
				<QuestionPageHeader q={q} logoSrc={logoSrc} />
				<Section label="Question">
					<View style={styles.card}>
						<Text style={styles.sectionBody} wrap>
							{q.question_text}
						</Text>
						<QuestionVisualPdf visual={q.visual} />
					</View>
				</Section>
				<Section label="Your answer">
					<View style={styles.card}>
						<Text style={styles.sectionBody} wrap>
							{q.student_answer_display}
						</Text>
					</View>
					{q.user_answer_summary?.trim() ? (
						<View style={styles.atGlance} wrap={false}>
							<Text style={styles.atGlanceText} wrap>
								At a glance: {q.user_answer_summary.trim()}
							</Text>
						</View>
					) : null}
				</Section>
				<Section label="Answer key (practice set)">
					<View style={styles.cardAnswerKey}>
						<Text style={styles.sectionBody} wrap>
							{gen.text || "—"}
						</Text>
					</View>
				</Section>
				{page1 ? (
					<Section label="AI feedback">
						<View style={styles.cardFeedback}>
							<Text style={styles.sectionBody} wrap>
								{page1}
							</Text>
						</View>
					</Section>
				) : null}
				<QuestionFooter q={q} nQuestions={nQuestions} />
			</View>
		</Page>,
	);

	if (page2) {
		pages.push(
			<Page key={`${q.question_id}-p1`} size="A4" style={styles.qPage} wrap>
				<View style={styles.brandTopRule} />
				<View style={styles.qPageInner}>
					<QuestionPageHeader
						q={q}
						logoSrc={logoSrc}
						continued
						sectionHint="AI feedback (continued)"
					/>
					<Section label="AI feedback (continued)">
						<View style={styles.cardFeedback}>
							<Text style={styles.sectionBody} wrap>
								{page2}
							</Text>
						</View>
					</Section>
					<QuestionFooter q={q} nQuestions={nQuestions} />
				</View>
			</Page>,
		);
	}

	return pages;
}

export function PracticeGradingPdfDocument(props: PracticeGradingPdfDocumentProps) {
	const { questions, ...coverProps } = props;
	const nQ = questions.length;
	const logoSrc = coverProps.logoSrc;
	return (
		<Document title={`${props.subjectName} — Practice report`}>
			<ReportCoverPage {...coverProps} />
			{questions.flatMap((q) => renderQuestionPageSequence(q, nQ, logoSrc))}
		</Document>
	);
}
