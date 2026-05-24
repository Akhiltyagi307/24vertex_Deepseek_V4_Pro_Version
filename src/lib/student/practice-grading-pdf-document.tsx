import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { formatDuration } from "@/lib/student/subject-test-report";
import { formatTrackerStatusFromRaw } from "@/lib/student/tracker-status-labels";
import {
	clampGenerationBlockForPdf,
	clampPdfPlainText,
	PDF_COACH_NOTE_MAX,
	PDF_COACH_WALK_SIDEBYSIDE_MAX,
	PDF_WALKTHROUGH_MAX,
} from "@/lib/student/practice-grading-pdf-chunks";
import type { GradedQuestionItem, PracticeGradingSummary } from "@/lib/practice/grading-schema";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";
import { QuestionVisualPdf } from "@/lib/student/practice-grading-pdf-visual";

/**
 * Print theme: A4 study sheet for desk reading in daylight.
 * Restrained #2ea070 accent, typographic hierarchy, hairline rules, density-aware
 * padding (not uniform card grids).
 */
const pdf = {
	ink: "#0a0a0a",
	inkSubtle: "#404040",
	muted: "#737373",
	muted2: "#a3a3a3",
	border: "#e8e8e8",
	borderStrong: "#d6d6d6",
	canvas: "#f7f7f7",
	surface: "#ffffff",
	brand: "#2ea070",
	brandDeep: "#0f4a30",
	brandSoft: "rgba(46, 160, 112, 0.07)",
	brandSofter: "rgba(46, 160, 112, 0.035)",
	brandLine: "rgba(46, 160, 112, 0.28)",
	destructive: "#e55353",
	destructiveSoft: "rgba(229, 83, 83, 0.08)",
	destructiveInk: "#b91c1c",
	warning: "#d97706",
	warningSoft: "#fffbeb",
	warningInk: "#92400e",
	successInk: "#15803d",
	tHead: "#f3f3f3",
	tStripe: "#fafafa",
} as const;

/** Type scale from 9pt body: ×1.25 per step (labels 7, body 9, lead 11.25, title 14, display 17.5). */
const type = {
	label: 7,
	labelMd: 7.5,
	bodySm: 8.5,
	body: 9,
	bodyLead: 10,
	section: 11.25,
	qTitle: 12,
	coverTitle: 17.5,
	coverScore: 22,
} as const;

/** Vertical rhythm: tight meta → airy stem → compact compare → clear scored block. */
const space = {
	xs: 3,
	sm: 5,
	md: 8,
	lg: 11,
	xl: 14,
	section: 10,
	sectionLoose: 13,
} as const;

const PAGE_CHROME_TOP = 52;
const PAGE_CHROME_BOTTOM = 32;
const PAGE_CHROME_HORIZONTAL = 26;

const styles = StyleSheet.create({
	brandTopRule: { height: 3, width: "100%", backgroundColor: pdf.brand },
	cover: {
		padding: 0,
		fontSize: type.body,
		fontFamily: "Helvetica",
		backgroundColor: pdf.canvas,
		color: pdf.ink,
		minHeight: "100%",
	},
	coverInner: { paddingHorizontal: 26, paddingTop: 14, paddingBottom: 34 },
	coverHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: space.sm,
	},
	coverKicker: {
		fontSize: type.label,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.1,
		textTransform: "uppercase",
	},
	coverTitleBlock: { marginBottom: space.md },
	coverTitle: {
		fontSize: type.coverTitle,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		letterSpacing: -0.35,
		lineHeight: 1.15,
		marginBottom: space.xs,
	},
	coverSub: { fontSize: type.bodySm, color: pdf.muted, lineHeight: 1.4 },
	coverScoreRow: {
		flexDirection: "row",
		alignItems: "baseline",
		marginTop: space.sm,
	},
	coverScoreValue: {
		fontSize: type.coverScore,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: -0.5,
		lineHeight: 1,
		marginRight: 5,
	},
	coverScoreSuffix: {
		fontSize: type.bodySm,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
	},
	metaStrip: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginBottom: space.section,
		paddingVertical: space.sm,
		paddingHorizontal: space.md,
		backgroundColor: pdf.surface,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: pdf.border,
	},
	metaStripItem: {
		fontSize: type.bodySm,
		color: pdf.inkSubtle,
		marginRight: 12,
		lineHeight: 1.35,
	},
	metaStripValue: { fontFamily: "Helvetica-Bold", color: pdf.ink },
	logo: { width: 30, height: 30 },
	wordmark: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: 0.15,
	},
	sectionLabelRow: { marginTop: space.section, marginBottom: space.sm },
	sectionLabelRowTight: { marginTop: space.md, marginBottom: space.xs },
	sectionLabel: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.85,
	},
	coverageTable: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 3,
		overflow: "hidden",
		backgroundColor: pdf.surface,
	},
	coverageRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	coverageRowAlt: { backgroundColor: pdf.tStripe },
	coverageRowHead: {
		backgroundColor: pdf.tHead,
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: pdf.borderStrong,
	},
	coverageCell: {
		flex: 1,
		paddingVertical: 4,
		paddingHorizontal: 6,
		fontSize: type.bodySm,
		color: pdf.ink,
		lineHeight: 1.32,
	},
	coverageCellNarrow: {
		width: "14%",
		paddingVertical: 4,
		paddingHorizontal: 5,
		fontSize: type.bodySm,
		color: pdf.ink,
	},
	coverageHead: {
		fontFamily: "Helvetica-Bold",
		color: pdf.muted,
		fontSize: type.label,
		textTransform: "uppercase",
		letterSpacing: 0.65,
	},
	statusGood: { color: pdf.successInk, fontFamily: "Helvetica-Bold" },
	statusWarn: { color: pdf.warningInk, fontFamily: "Helvetica-Bold" },
	statusBad: { color: pdf.destructiveInk, fontFamily: "Helvetica-Bold" },
	scoreCellGood: { color: pdf.successInk, fontFamily: "Helvetica-Bold" },
	scoreCellWarn: { color: pdf.warningInk, fontFamily: "Helvetica-Bold" },
	scoreCellBad: { color: pdf.destructiveInk, fontFamily: "Helvetica-Bold" },
	proseBlock: {
		borderWidth: 1,
		borderColor: pdf.border,
		backgroundColor: pdf.surface,
		borderRadius: 3,
	},
	proseBlockMuted: {
		borderWidth: 1,
		borderColor: pdf.border,
		backgroundColor: pdf.canvas,
		borderRadius: 3,
	},
	proseBlockBrand: {
		borderWidth: 1,
		borderColor: pdf.brandLine,
		backgroundColor: pdf.brandSofter,
		borderRadius: 3,
	},
	proseBlockScored: {
		borderWidth: 1,
		borderColor: pdf.borderStrong,
		backgroundColor: pdf.tStripe,
		borderRadius: 3,
	},
	summaryNarrative: {
		paddingVertical: space.md,
		paddingHorizontal: space.md + 1,
		backgroundColor: pdf.surface,
		borderRadius: 3,
		borderWidth: 1,
		borderColor: pdf.border,
	},
	summaryNarrativeText: { fontSize: type.bodyLead, color: pdf.ink, lineHeight: 1.48 },
	tagRow: { flexDirection: "row", flexWrap: "wrap" },
	tagChip: {
		borderWidth: 1,
		borderColor: pdf.brandLine,
		backgroundColor: pdf.brandSoft,
		borderRadius: 2,
		paddingVertical: 2,
		paddingHorizontal: 5,
		marginRight: 4,
		marginBottom: 4,
	},
	tagChipText: { fontSize: type.bodySm, color: pdf.brandDeep, lineHeight: 1.28 },
	twoColRow: { flexDirection: "row", marginTop: space.xs },
	twoCol: { width: "49%", marginRight: "2%" },
	twoColLast: { width: "49%" },
	insightsBox: {
		marginTop: space.md,
		paddingVertical: space.md,
		paddingHorizontal: space.md + 1,
		backgroundColor: pdf.brandSoft,
		borderRadius: 3,
		borderWidth: 1,
		borderColor: pdf.brandLine,
	},
	insightsLabel: {
		fontSize: type.labelMd,
		color: pdf.brandDeep,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.75,
		marginBottom: space.xs,
	},
	insightsText: { fontSize: type.bodyLead, color: pdf.brandDeep, lineHeight: 1.45 },

	qPage: {
		paddingTop: PAGE_CHROME_TOP,
		paddingBottom: PAGE_CHROME_BOTTOM,
		paddingHorizontal: PAGE_CHROME_HORIZONTAL,
		fontSize: type.body,
		fontFamily: "Helvetica",
		backgroundColor: pdf.canvas,
		color: pdf.ink,
	},
	pageChromeWrap: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: PAGE_CHROME_TOP,
		backgroundColor: pdf.surface,
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	pageChromeHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: PAGE_CHROME_HORIZONTAL,
		paddingTop: 5,
		paddingBottom: 5,
	},
	pageChromeHeaderLeft: { flex: 1, paddingRight: 8 },
	pageChromeTitle: {
		fontSize: type.bodyLead,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		lineHeight: 1.28,
	},
	pageChromeMeta: { fontSize: type.labelMd, color: pdf.muted, marginTop: 1, lineHeight: 1.28 },
	pageChromeFooter: {
		position: "absolute",
		bottom: 9,
		left: PAGE_CHROME_HORIZONTAL,
		right: PAGE_CHROME_HORIZONTAL,
		fontSize: type.label,
		color: pdf.muted,
		textAlign: "center",
		lineHeight: 1.32,
	},
	qHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: space.sectionLoose,
		paddingBottom: space.md,
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	qTitleBlock: { flex: 1, paddingRight: 10 },
	qHeaderTitle: {
		fontSize: type.qTitle,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		lineHeight: 1.28,
	},
	qHeaderMeta: { fontSize: type.labelMd, color: pdf.muted, marginTop: 3, lineHeight: 1.35 },
	qHeaderRight: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
	verdictPill: {
		borderRadius: 2,
		paddingVertical: 2,
		paddingHorizontal: 5,
		fontSize: type.label,
		fontFamily: "Helvetica-Bold",
		borderWidth: 1,
		letterSpacing: 0.45,
		textTransform: "uppercase",
		marginRight: 5,
	},
	scoreChip: {
		fontSize: type.section,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: -0.2,
	},
	sectionTight: { marginBottom: space.md },
	sectionStem: { marginBottom: space.sectionLoose },
	sectionScored: { marginBottom: space.section },
	sectionCoach: { marginBottom: space.section },
	sectionLabelQ: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.75,
		textTransform: "uppercase",
		marginBottom: space.sm,
	},
	body: { fontSize: type.bodyLead, lineHeight: 1.48, color: pdf.ink },
	bodyCompact: { fontSize: type.body, lineHeight: 1.42, color: pdf.ink },
	compareRow: { flexDirection: "row", marginBottom: space.xs },
	compareCol: { width: "49%", marginRight: "2%" },
	compareColLast: { width: "49%" },
	compareColLabel: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.65,
		marginBottom: space.xs,
	},
	feedbackRow: { flexDirection: "row", marginBottom: space.section },
	feedbackCol: { flex: 1, marginRight: 7 },
	feedbackColLast: { flex: 1 },
	breakdownBand: {
		fontSize: type.bodyLead,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		marginBottom: space.sm,
	},
	breakdownListTitle: {
		fontSize: type.label,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.55,
		marginBottom: 2,
		marginTop: space.xs,
	},
	breakdownBullet: { fontSize: type.body, color: pdf.ink, lineHeight: 1.38, marginBottom: 2 },
	breakdownNext: {
		fontSize: type.body,
		color: pdf.inkSubtle,
		lineHeight: 1.4,
		marginTop: space.sm,
		paddingTop: space.sm,
		borderTopWidth: 1,
		borderTopColor: pdf.border,
	},
	atGlanceText: {
		fontSize: type.bodySm,
		color: pdf.muted,
		lineHeight: 1.35,
		fontStyle: "italic",
		marginTop: space.sm,
	},
	logoSm: { width: 22, height: 22 },
});

const PDF_COVER_NARRATIVE_MAX = 1000;
const PDF_COVER_INSIGHTS_MAX = 480;
const PDF_COVER_TOPIC_ROWS_MAX = 10;
const PDF_COVER_TRUNC_NOTE = "\n\n[Longer detail is available in the in-app report for this practice test.]";

/** Padding scales with text length so short MCQ rows stay compact and essays breathe. */
function prosePadding(charCount: number, tier: "tight" | "normal" | "loose" = "normal"): {
	paddingVertical: number;
	paddingHorizontal: number;
} {
	if (tier === "tight" || charCount < 80) {
		return { paddingVertical: 5, paddingHorizontal: 7 };
	}
	if (tier === "loose" || charCount > 420) {
		return { paddingVertical: 10, paddingHorizontal: 11 };
	}
	if (charCount > 200) {
		return { paddingVertical: 8, paddingHorizontal: 9 };
	}
	return { paddingVertical: 6, paddingHorizontal: 8 };
}

function truncateForSinglePage(text: string, maxChars: number): { text: string; wasTruncated: boolean } {
	const t = text.trim();
	if (t.length <= maxChars) return { text: t, wasTruncated: false };
	const cap = Math.max(0, maxChars - PDF_COVER_TRUNC_NOTE.length);
	return { text: `${t.slice(0, cap).trimEnd()}${PDF_COVER_TRUNC_NOTE}`, wasTruncated: true };
}

function formatStatusForPdf(raw: string): string {
	const t = raw.trim();
	if (!t || t === "—") return "—";
	return formatTrackerStatusFromRaw(t);
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
	if (v === "correct") {
		return { bg: pdf.brandSoft, fg: pdf.successInk, border: pdf.brandLine, label: "Correct" };
	}
	if (v === "partially_correct") {
		return { bg: pdf.warningSoft, fg: pdf.warningInk, border: pdf.warning, label: "Partial credit" };
	}
	return { bg: pdf.destructiveSoft, fg: pdf.destructiveInk, border: "rgba(229, 83, 83, 0.35)", label: "Incorrect" };
}

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
	generation_answer_display: string;
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
	logoSrc: string | Buffer | null;
};

export type PracticeGradingPdfDocumentProps = PracticeGradingPdfCoverProps & {
	questions: PracticeGradingPdfQuestion[];
};

export type PracticeGradingPdfTestMeta = Pick<
	PracticeGradingPdfCoverProps,
	"subjectName" | "studentDisplayName" | "difficulty" | "timeLimitSeconds" | "durationSeconds"
>;

function formatTestConfigFooterLine(meta: PracticeGradingPdfTestMeta): string {
	const parts: string[] = [];
	const diff = meta.difficulty?.trim();
	if (diff) parts.push(`Difficulty ${diff}`);
	if (meta.timeLimitSeconds != null) {
		parts.push(`Limit ${formatDuration(meta.timeLimitSeconds)}`);
	}
	if (meta.durationSeconds != null) {
		parts.push(`Taken ${formatDuration(meta.durationSeconds)}`);
	}
	return parts.length > 0 ? parts.join(" · ") : "Practice test";
}

type QuestionPageChromeProps = {
	logoSrc: string | Buffer | null;
	testMeta: PracticeGradingPdfTestMeta;
	q: PracticeGradingPdfQuestion;
	nQuestions: number;
	continued?: boolean;
	sectionHint?: string;
};

function QuestionPageChrome({
	logoSrc,
	testMeta,
	q,
	nQuestions,
	continued,
	sectionHint,
}: QuestionPageChromeProps) {
	const qLabel = continued ? `Q${q.question_number} (cont.)` : `Q${q.question_number}`;
	const topicLine = [q.chapter_name, q.topic_name].filter(Boolean).join(" · ");
	const chromeTitle = sectionHint ? `${qLabel} · ${sectionHint}` : `${testMeta.subjectName} · ${qLabel}`;
	return (
		<>
			<View fixed style={styles.pageChromeWrap}>
				<View style={styles.brandTopRule} />
				<View style={styles.pageChromeHeader} wrap={false}>
					<View style={styles.pageChromeHeaderLeft}>
						<Text style={styles.pageChromeTitle} wrap>
							{chromeTitle}
						</Text>
						{topicLine ? (
							<Text style={styles.pageChromeMeta} wrap>
								{topicLine}
							</Text>
						) : null}
					</View>
					{logoSrc ? (
						// eslint-disable-next-line jsx-a11y/alt-text -- PDF logo, decorative in document
						<Image src={logoSrc} style={styles.logoSm} />
					) : (
						<Text style={[styles.wordmark, { fontSize: 9 }]}>24Vertex</Text>
					)}
				</View>
			</View>
			<Text
				fixed
				style={styles.pageChromeFooter}
				render={({ pageNumber, totalPages }) => {
					const config = formatTestConfigFooterLine(testMeta);
					const student =
						testMeta.studentDisplayName?.trim() ?
							`${testMeta.studentDisplayName.trim()} · `
						:	"";
					return `${student}Q ${q.question_number} of ${nQuestions} · ${config} · Page ${pageNumber} / ${totalPages}`;
				}}
			/>
		</>
	);
}

function QuestionPage({
	children,
	chrome,
}: {
	children: ReactNode;
	chrome: QuestionPageChromeProps;
}) {
	return (
		<Page size="A4" style={styles.qPage} wrap>
			<QuestionPageChrome {...chrome} />
			{children}
		</Page>
	);
}

function BrandedTopRight({ logoSrc }: { logoSrc: string | Buffer | null }) {
	if (logoSrc) {
		// eslint-disable-next-line jsx-a11y/alt-text -- PDF logo, decorative in document
		return <Image src={logoSrc} style={styles.logo} />;
	}
	return <Text style={styles.wordmark}>24Vertex</Text>;
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

function CoverSectionLabel({ children, tight }: { children: ReactNode; tight?: boolean }) {
	return (
		<View style={tight ? styles.sectionLabelRowTight : styles.sectionLabelRow} wrap={false}>
			<Text style={styles.sectionLabel}>{children}</Text>
		</View>
	);
}

function QSectionLabel({ children }: { children: ReactNode }) {
	return (
		<Text style={styles.sectionLabelQ} wrap={false}>
			{children}
		</Text>
	);
}

type ProseVariant = "default" | "muted" | "brand" | "scored";

function ProseBlock({
	variant,
	charCount,
	tier,
	children,
}: {
	variant: ProseVariant;
	charCount: number;
	tier?: "tight" | "normal" | "loose";
	children: ReactNode;
}) {
	const pad = prosePadding(charCount, tier);
	const shell =
		variant === "muted" ? styles.proseBlockMuted
		: variant === "brand" ? styles.proseBlockBrand
		: variant === "scored" ? styles.proseBlockScored
		: styles.proseBlock;
	return <View style={[shell, pad]}>{children}</View>;
}

function CoverPageFooter(props: PracticeGradingPdfCoverProps & { totalQuestions: number }) {
	const config = formatTestConfigFooterLine(props);
	const student = props.studentDisplayName?.trim() ? `${props.studentDisplayName.trim()} · ` : "";
	return (
		<Text
			style={styles.pageChromeFooter}
			fixed
			render={({ pageNumber, totalPages }) =>
				`${student}${props.totalQuestions} questions · ${config} · Page ${pageNumber} / ${totalPages}`
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
	const overallScoreLabel = overallScorePercent != null ? `${Math.round(overallScorePercent)}` : "—";
	const subParts = [
		dateLine,
		`${totalQuestions} ${totalQuestions === 1 ? "question" : "questions"}`,
		studentDisplayName?.trim() || null,
	].filter(Boolean);

	return (
		<Page size="A4" style={styles.cover} wrap={false}>
			<View style={styles.brandTopRule} />
			<View style={styles.coverInner} wrap={false}>
				<View style={styles.coverHeaderRow} wrap={false}>
					<Text style={styles.coverKicker}>Practice test report</Text>
					<BrandedTopRight logoSrc={logoSrc} />
				</View>

				<View style={styles.coverTitleBlock} wrap={false}>
					<Text style={styles.coverTitle}>{subjectName}</Text>
					<Text style={styles.coverSub}>{subParts.join(" · ")}</Text>
					<View style={styles.coverScoreRow} wrap={false}>
						<Text style={styles.coverScoreValue}>{overallScoreLabel}</Text>
						{overallScorePercent != null ? (
							<Text style={styles.coverScoreSuffix}>% overall</Text>
						) : (
							<Text style={styles.coverScoreSuffix}>overall</Text>
						)}
					</View>
				</View>

				<View style={styles.metaStrip} wrap={false}>
					<Text style={styles.metaStripItem}>
						Difficulty{" "}
						<Text style={styles.metaStripValue}>{difficulty?.trim() ? difficulty : "—"}</Text>
					</Text>
					<Text style={styles.metaStripItem}>
						Limit{" "}
						<Text style={styles.metaStripValue}>
							{timeLimitSeconds != null ? formatDuration(timeLimitSeconds) : "—"}
						</Text>
					</Text>
					<Text style={styles.metaStripItem}>
						Taken{" "}
						<Text style={styles.metaStripValue}>{formatDuration(durationSeconds)}</Text>
					</Text>
				</View>

				<CoverSectionLabel>Topics and chapters</CoverSectionLabel>
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
							<Text style={{ padding: 5, fontSize: type.label, color: pdf.muted, fontStyle: "italic" }}>
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
						<View style={styles.twoColLast} wrap={false}>
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
						<Text style={styles.insightsLabel}>Insights</Text>
						<Text style={styles.insightsText}>{insights.text}</Text>
					</View>
				) : null}
			</View>
			<CoverPageFooter {...props} totalQuestions={totalQuestions} />
		</Page>
	);
}

function QuestionPageHeader({ q }: { q: PracticeGradingPdfQuestion }) {
	const v = verdictStyles(q.verdict);
	const locParts = [
		q.chapter_name,
		q.unit_name,
		q.grade != null ? `Grade ${q.grade}` : null,
		q.topic_name,
		q.question_difficulty ? `Item ${q.question_difficulty}` : null,
	].filter(Boolean);
	return (
		<View style={styles.qHeaderRow} wrap={false}>
			<View style={styles.qTitleBlock}>
				<Text style={styles.qHeaderTitle}>
					Question {q.question_number} · {formatQType(q.question_type)}
				</Text>
				{locParts.length ? (
					<Text style={styles.qHeaderMeta} wrap>
						{locParts.join(" · ")}
					</Text>
				) : null}
			</View>
			<View style={styles.qHeaderRight} wrap={false}>
				<Text
					style={[
						styles.verdictPill,
						{ backgroundColor: v.bg, color: v.fg, borderColor: v.border },
					]}
				>
					{v.label}
				</Text>
				<Text style={styles.scoreChip}>{Math.round(q.score)}%</Text>
			</View>
		</View>
	);
}

function GradingBreakdownPdfView({ q }: { q: PracticeGradingPdfQuestion }) {
	const hasLists =
		(q.what_was_correct?.length ?? 0) > 0 || (q.where_marks_were_lost?.length ?? 0) > 0;
	const useTwoCol =
		(q.what_was_correct?.length ?? 0) > 0 && (q.where_marks_were_lost?.length ?? 0) > 0;
	const listChars =
		(q.what_was_correct ?? []).join("").length + (q.where_marks_were_lost ?? []).join("").length;

	return (
		<ProseBlock variant="scored" charCount={listChars + (q.band_label?.length ?? 0)} tier="normal">
			{q.band_label?.trim() ? (
				<Text style={styles.breakdownBand}>Result: {q.band_label.trim()}</Text>
			) : null}
			{useTwoCol ? (
				<View style={styles.feedbackRow}>
					<View style={styles.feedbackCol}>
						<Text style={styles.breakdownListTitle}>Got right</Text>
						{(q.what_was_correct ?? []).map((item, i) => (
							<Text key={`c-${i}`} style={styles.breakdownBullet} wrap>
								· {item}
							</Text>
						))}
					</View>
					<View style={styles.feedbackColLast}>
						<Text style={styles.breakdownListTitle}>Not full marks</Text>
						{(q.where_marks_were_lost ?? []).map((item, i) => (
							<Text key={`l-${i}`} style={styles.breakdownBullet} wrap>
								· {item}
							</Text>
						))}
					</View>
				</View>
			) : hasLists ? (
				<>
					{(q.what_was_correct?.length ?? 0) > 0 ? (
						<>
							<Text style={styles.breakdownListTitle}>Got right</Text>
							{(q.what_was_correct ?? []).map((item, i) => (
								<Text key={`c-${i}`} style={styles.breakdownBullet} wrap>
									· {item}
								</Text>
							))}
						</>
					) : null}
					{(q.where_marks_were_lost?.length ?? 0) > 0 ? (
						<>
							<Text style={styles.breakdownListTitle}>Not full marks</Text>
							{(q.where_marks_were_lost ?? []).map((item, i) => (
								<Text key={`l-${i}`} style={styles.breakdownBullet} wrap>
									· {item}
								</Text>
							))}
						</>
					) : null}
				</>
			) : null}
			{q.criterion_scores?.length ? (
				<>
					<Text style={styles.breakdownListTitle}>Marking breakdown</Text>
					{q.criterion_scores.map((c, i) => (
						<Text key={`cr-${i}`} style={styles.breakdownBullet} wrap>
							· {c.name}: {c.points}/20 ({c.note})
						</Text>
					))}
				</>
			) : null}
			{q.to_reach_next_band?.trim() ? (
				<Text style={styles.breakdownNext} wrap>
					Next: {q.to_reach_next_band.trim()}
				</Text>
			) : null}
		</ProseBlock>
	);
}

function AnswerCompareRow({
	studentAnswer,
	answerKey,
	summary,
}: {
	studentAnswer: string;
	answerKey: string;
	summary?: string | null;
}) {
	const studentLen = studentAnswer.length;
	const keyLen = answerKey.length;
	return (
		<View style={styles.sectionTight}>
			<View style={styles.compareRow}>
				<View style={styles.compareCol}>
					<Text style={styles.compareColLabel}>Your answer</Text>
					<ProseBlock variant="muted" charCount={studentLen} tier="tight">
						<Text style={styles.bodyCompact} wrap>
							{studentAnswer}
						</Text>
					</ProseBlock>
				</View>
				<View style={styles.compareColLast}>
					<Text style={styles.compareColLabel}>Answer key</Text>
					<ProseBlock variant="brand" charCount={keyLen} tier="tight">
						<Text style={styles.bodyCompact} wrap>
							{answerKey || "—"}
						</Text>
					</ProseBlock>
				</View>
			</View>
			{summary?.trim() ? (
				<Text style={styles.atGlanceText} wrap>
					At a glance: {summary.trim()}
				</Text>
			) : null}
		</View>
	);
}

function Section({
	label,
	spacing,
	children,
}: {
	label: string;
	spacing: "stem" | "scored" | "coach" | "tight";
	children: ReactNode;
}) {
	const sectionStyle =
		spacing === "stem" ? styles.sectionStem
		: spacing === "scored" ? styles.sectionScored
		: spacing === "coach" ? styles.sectionCoach
		: styles.sectionTight;
	return (
		<View style={sectionStyle}>
			<QSectionLabel>{label}</QSectionLabel>
			{children}
		</View>
	);
}

function hasGradingBreakdown(q: PracticeGradingPdfQuestion): boolean {
	return Boolean(
		q.band_label?.trim() ||
			q.what_was_correct?.length ||
			q.where_marks_were_lost?.length ||
			q.to_reach_next_band?.trim() ||
			q.criterion_scores?.length,
	);
}

function renderQuestionPageSequence(
	q: PracticeGradingPdfQuestion,
	nQuestions: number,
	logoSrc: string | Buffer | null,
	testMeta: PracticeGradingPdfTestMeta,
): ReactElement[] {
	const chromeBase = { logoSrc, testMeta, q, nQuestions };
	const gen = clampGenerationBlockForPdf(q.generation_answer_display);
	const showBreakdown = hasGradingBreakdown(q);
	const coach = clampPdfPlainText(q.analysis ?? "", PDF_COACH_NOTE_MAX);
	const walk = clampPdfPlainText(q.step_by_step_solution ?? "", PDF_WALKTHROUGH_MAX);
	const coachWalkSideBySide =
		coach.text.length > 0 &&
		walk.text.length > 0 &&
		coach.text.length <= PDF_COACH_WALK_SIDEBYSIDE_MAX &&
		walk.text.length <= PDF_COACH_WALK_SIDEBYSIDE_MAX;

	return [
		<QuestionPage key={q.question_id} chrome={chromeBase}>
			<QuestionPageHeader q={q} />
			<Section label="Question" spacing="stem">
				<ProseBlock variant="default" charCount={q.question_text.length} tier="loose">
					<Text style={styles.body} wrap>
						{q.question_text}
					</Text>
					<QuestionVisualPdf visual={q.visual} />
				</ProseBlock>
			</Section>
			<AnswerCompareRow
				studentAnswer={q.student_answer_display}
				answerKey={gen.text}
				summary={q.user_answer_summary}
			/>
			{showBreakdown ? (
				<Section label="How you were scored" spacing="scored">
					<GradingBreakdownPdfView q={q} />
				</Section>
			) : null}
			{coachWalkSideBySide ? (
				<View style={[styles.feedbackRow, { marginBottom: 0 }]}>
					<View style={styles.feedbackCol}>
						<QSectionLabel>Coach note</QSectionLabel>
						<ProseBlock variant="default" charCount={coach.text.length} tier="tight">
							<Text style={styles.bodyCompact} wrap>
								{coach.text}
							</Text>
						</ProseBlock>
					</View>
					<View style={styles.feedbackColLast}>
						<QSectionLabel>Walk through it</QSectionLabel>
						<ProseBlock variant="brand" charCount={walk.text.length} tier="tight">
							<Text style={styles.bodyCompact} wrap>
								{walk.text}
							</Text>
						</ProseBlock>
					</View>
				</View>
			) : (
				<>
					{coach.text ? (
						<Section label="Coach note" spacing="coach">
							<ProseBlock variant="default" charCount={coach.text.length}>
								<Text style={styles.body} wrap>
									{coach.text}
								</Text>
							</ProseBlock>
						</Section>
					) : null}
					{walk.text ? (
						<Section label="Walk through it" spacing="coach">
							<ProseBlock variant="brand" charCount={walk.text.length}>
								<Text style={styles.body} wrap>
									{walk.text}
								</Text>
							</ProseBlock>
						</Section>
					) : null}
				</>
			)}
		</QuestionPage>,
	];
}

export function PracticeGradingPdfDocument(props: PracticeGradingPdfDocumentProps) {
	const { questions, ...coverProps } = props;
	const nQ = questions.length;
	const logoSrc = coverProps.logoSrc;
	return (
		<Document title={`${props.subjectName} · Practice report`}>
			<ReportCoverPage {...coverProps} />
			{questions.flatMap((q) =>
				renderQuestionPageSequence(q, nQ, logoSrc, {
					subjectName: coverProps.subjectName,
					studentDisplayName: coverProps.studentDisplayName,
					difficulty: coverProps.difficulty,
					timeLimitSeconds: coverProps.timeLimitSeconds,
					durationSeconds: coverProps.durationSeconds,
				}),
			)}
		</Document>
	);
}
