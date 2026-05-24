import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { formatDuration } from "@/lib/student/subject-test-report";
import { formatTrackerStatusFromRaw } from "@/lib/student/tracker-status-labels";
import {
	clampGenerationBlockForPdf,
	clampPdfPlainText,
	PDF_COACH_NOTE_MAX,
	PDF_WALKTHROUGH_MAX,
} from "@/lib/student/practice-grading-pdf-chunks";
import type { GradedQuestionItem, PracticeGradingSummary } from "@/lib/practice/grading-schema";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";
import { QuestionVisualPdf } from "@/lib/student/practice-grading-pdf-visual";
import {
	PDF_BRAND,
	PDF_TRAFFIC,
	pdfTrafficFromScorePercent,
	pdfTrafficFromVerdict,
	pdfTrafficVerdictLabel,
	type PdfTrafficTone,
} from "@/lib/student/practice-grading-pdf-traffic";
import {
	buildPracticeGradingPdfStudentDetailLines,
	practiceGradingPdfStudentDisplayName,
	type PracticeGradingPdfStudentDetails,
} from "@/lib/student/practice-grading-pdf-student-details";

/** Print theme aligned with DESIGN.md tokens (PDF-safe hex only). */
const pdf = {
	ink: "#252525",
	inkSubtle: "#353535",
	muted: "#8e8e8e",
	border: "#ebebeb",
	borderSoft: "#f0f0f0",
	canvas: "#fafafa",
	surface: "#ffffff",
	studentFill: "#f5f5f5",
	scoredFill: "#fafafa",
	brand: PDF_BRAND.green,
	brandDeep: PDF_BRAND.greenDeep,
	brandSoft: PDF_BRAND.greenSoft,
	brandSofter: PDF_BRAND.greenSoft,
	brandBorder: PDF_BRAND.greenBorder,
	tHead: "#f3f3f3",
	tStripe: "#fafafa",
} as const;

const type = {
	label: 7,
	labelMd: 7.5,
	bodySm: 8.5,
	body: 9,
	bodyLead: 10,
	section: 11.25,
	qTitle: 12,
	coverTitle: 17.5,
	coverScore: 26,
} as const;

const space = {
	xs: 3,
	sm: 5,
	md: 8,
	lg: 11,
	xl: 14,
	section: 10,
	sectionLoose: 13,
} as const;

const PAGE_PAD_H = 28;
const PAGE_PAD_TOP = 36;
const PAGE_PAD_BOTTOM = 32;
const FOOTER_HEIGHT = 22;

const styles = StyleSheet.create({
	page: {
		paddingTop: PAGE_PAD_TOP,
		paddingBottom: PAGE_PAD_BOTTOM + FOOTER_HEIGHT,
		paddingHorizontal: PAGE_PAD_H,
		fontSize: type.body,
		fontFamily: "Helvetica",
		backgroundColor: pdf.surface,
		color: pdf.ink,
	},
	brandTopRule: { height: 4, width: "100%", backgroundColor: pdf.brand, marginBottom: space.lg },
	footer: {
		position: "absolute",
		bottom: 14,
		left: PAGE_PAD_H,
		right: PAGE_PAD_H,
		fontSize: type.label,
		color: pdf.muted,
		textAlign: "center",
		lineHeight: 1.32,
	},
	coverKicker: {
		fontSize: type.label,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.1,
		textTransform: "uppercase",
		marginBottom: space.xs,
	},
	coverTitle: {
		fontSize: type.coverTitle,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		letterSpacing: -0.35,
		lineHeight: 1.15,
		marginBottom: space.xs,
	},
	coverMeta: { fontSize: type.bodyLead, color: pdf.muted, lineHeight: 1.4, marginBottom: space.lg },
	heroCard: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 6,
		backgroundColor: pdf.canvas,
		paddingVertical: 0,
		paddingHorizontal: 0,
		marginBottom: space.sectionLoose,
		overflow: "hidden",
	},
	heroTopRow: {
		flexDirection: "row",
		alignItems: "stretch",
	},
	heroScoreBlock: {
		width: "34%",
		paddingVertical: space.lg + 2,
		paddingHorizontal: space.lg + 2,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: pdf.surface,
	},
	heroStudentColumn: {
		flex: 1,
		backgroundColor: PDF_BRAND.greenSoft,
		paddingVertical: space.lg,
		paddingHorizontal: space.lg + 2,
	},
	heroStudentKicker: {
		fontSize: type.label,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.85,
		marginBottom: space.xs,
	},
	heroStudentName: {
		fontSize: type.section,
		fontFamily: "Helvetica-Bold",
		color: PDF_BRAND.greenDeep,
		lineHeight: 1.28,
		marginBottom: space.md,
	},
	heroStudentRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: 4,
	},
	heroStudentRowSecondary: {
		marginBottom: 3,
	},
	heroStudentLabelCol: {
		width: 58,
		paddingRight: 8,
	},
	heroStudentLabel: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.55,
		lineHeight: 1.35,
	},
	heroStudentValue: {
		flex: 1,
		fontSize: type.bodySm,
		color: pdf.ink,
		lineHeight: 1.4,
	},
	heroStudentValueSecondary: {
		color: pdf.inkSubtle,
	},
	heroStudentValueCode: {
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.35,
	},
	heroScoreLabel: {
		fontSize: type.label,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.85,
		marginBottom: 3,
	},
	heroScoreValue: {
		fontSize: type.coverScore,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: -0.5,
		lineHeight: 1,
	},
	heroSummary: {
		paddingVertical: space.md + 1,
		paddingHorizontal: space.lg + 2,
		borderTopWidth: 1,
		borderTopColor: pdf.border,
		fontSize: type.bodyLead,
		color: pdf.inkSubtle,
		lineHeight: 1.48,
		backgroundColor: pdf.surface,
	},
	coverHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: space.md,
	},
	logo: { width: 28, height: 28 },
	wordmark: {
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
		letterSpacing: 0.15,
	},
	sectionLabel: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.85,
		marginTop: space.section,
		marginBottom: space.sm,
	},
	sectionLabelRow: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: space.section,
		marginBottom: space.sm,
	},
	sectionLabelBar: {
		width: 3,
		height: 9,
		backgroundColor: pdf.brand,
		borderRadius: 1,
		marginRight: 5,
	},
	sectionLabelText: {
		fontSize: type.labelMd,
		color: pdf.muted,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 0.75,
	},
	card: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 5,
		backgroundColor: pdf.surface,
	},
	cardStudent: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 5,
		backgroundColor: pdf.studentFill,
	},
	cardKey: {
		borderWidth: 1,
		borderColor: pdf.brandBorder,
		borderRadius: 5,
		backgroundColor: pdf.brandSofter,
	},
	cardScored: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 5,
		backgroundColor: pdf.scoredFill,
	},
	body: { fontSize: type.bodyLead, lineHeight: 1.48, color: pdf.ink },
	bodyCompact: { fontSize: type.body, lineHeight: 1.42, color: pdf.ink },
	atGlance: {
		marginTop: space.sm,
		fontSize: type.bodySm,
		color: pdf.muted,
		lineHeight: 1.38,
		fontStyle: "italic",
		paddingVertical: 5,
		paddingHorizontal: 7,
		borderWidth: 1,
		borderColor: pdf.borderSoft,
		borderRadius: 4,
		backgroundColor: pdf.surface,
	},
	qBlock: { marginBottom: space.sectionLoose },
	qHead: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		paddingBottom: space.md,
		marginBottom: space.md,
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	qHeadLeft: { flex: 1, paddingRight: 10 },
	qNum: {
		fontSize: type.label,
		color: pdf.brand,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: 3,
	},
	qTopic: {
		fontSize: type.section,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		lineHeight: 1.3,
		marginBottom: space.sm,
	},
	verdictPill: {
		alignSelf: "flex-start",
		borderRadius: 3,
		paddingVertical: 2,
		paddingHorizontal: 6,
		fontSize: type.label,
		fontFamily: "Helvetica-Bold",
		borderWidth: 1,
		letterSpacing: 0.45,
		textTransform: "uppercase",
	},
	scoreBox: {
		alignItems: "center",
		borderWidth: 1,
		borderColor: pdf.brandBorder,
		borderRadius: 5,
		backgroundColor: pdf.brandSoft,
		paddingVertical: 5,
		paddingHorizontal: 10,
		minWidth: 52,
	},
	scoreBoxLabel: {
		fontSize: type.label,
		fontFamily: "Helvetica-Bold",
		color: pdf.brandDeep,
		textTransform: "uppercase",
		letterSpacing: 0.7,
		marginBottom: 2,
	},
	scoreBoxValue: {
		fontSize: type.section + 1,
		fontFamily: "Helvetica-Bold",
		color: pdf.brand,
	},
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
	coverageTable: {
		borderWidth: 1,
		borderColor: pdf.border,
		borderRadius: 5,
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
		borderBottomColor: pdf.border,
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
	tagRow: { flexDirection: "row", flexWrap: "wrap" },
	tagChip: {
		borderWidth: 1,
		borderColor: PDF_BRAND.greenBorder,
		backgroundColor: PDF_BRAND.greenSoft,
		borderRadius: 4,
		paddingVertical: 3,
		paddingHorizontal: 6,
		marginRight: 4,
		marginBottom: 4,
	},
	tagChipText: { fontSize: type.bodySm, color: PDF_BRAND.greenDeep, lineHeight: 1.28 },
	insightsCard: {
		borderWidth: 1,
		borderColor: PDF_BRAND.greenBorder,
		borderRadius: 5,
		backgroundColor: PDF_BRAND.greenSoft,
		paddingVertical: 8,
		paddingHorizontal: 9,
		marginTop: space.sm,
	},
	trafficDotsRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 4,
	},
	trafficDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		marginRight: 3,
	},
	twoColRow: { flexDirection: "row", marginTop: space.xs },
	twoCol: { width: "49%", marginRight: "2%" },
	twoColLast: { width: "49%" },
	logoSm: { width: 22, height: 22 },
	pageChromeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: space.lg,
		paddingBottom: space.sm,
		borderBottomWidth: 1,
		borderBottomColor: pdf.border,
	},
	pageChromeTitle: {
		fontSize: type.bodyLead,
		fontFamily: "Helvetica-Bold",
		color: pdf.ink,
		lineHeight: 1.28,
	},
	pageChromeMeta: { fontSize: type.labelMd, color: pdf.muted, marginTop: 1 },
});

const PDF_COVER_NARRATIVE_MAX = 280;
const PDF_COVER_INSIGHTS_MAX = 420;
const PDF_COVER_TOPIC_ROWS_MAX = 12;
const PDF_COVER_TRUNC_NOTE = "\n\n[Longer detail is available in the in-app report for this practice test.]";

function prosePadding(charCount: number, tier: "tight" | "normal" | "loose" = "normal"): {
	paddingVertical: number;
	paddingHorizontal: number;
} {
	if (tier === "tight" || charCount < 80) {
		return { paddingVertical: 6, paddingHorizontal: 8 };
	}
	if (tier === "loose" || charCount > 420) {
		return { paddingVertical: 10, paddingHorizontal: 11 };
	}
	if (charCount > 200) {
		return { paddingVertical: 8, paddingHorizontal: 9 };
	}
	return { paddingVertical: 7, paddingHorizontal: 9 };
}

function truncateForPdf(text: string, maxChars: number): string {
	const t = text.trim();
	if (t.length <= maxChars) return t;
	const cap = Math.max(0, maxChars - PDF_COVER_TRUNC_NOTE.length);
	return `${t.slice(0, cap).trimEnd()}${PDF_COVER_TRUNC_NOTE}`;
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

function tableScoreStyle(avg: number | null): { color: string; fontFamily: "Helvetica-Bold" } | undefined {
	const tone = pdfTrafficFromScorePercent(avg);
	if (!tone) return undefined;
	return { color: tone.tableInk, fontFamily: "Helvetica-Bold" };
}

function TrafficSignalDots({ tone }: { tone: PdfTrafficTone }) {
	const onColors = [PDF_TRAFFIC.signalOnGreen, PDF_TRAFFIC.signalOnAmber, PDF_TRAFFIC.signalOnOrange];
	return (
		<View style={styles.trafficDotsRow} wrap={false}>
			{([0, 1, 2] as const).map((i) => (
				<View
					key={i}
					style={[
						styles.trafficDot,
						{
							backgroundColor: i === tone.signalIndex ? onColors[i] : PDF_TRAFFIC.signalOff,
						},
					]}
				/>
			))}
		</View>
	);
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

export type { PracticeGradingPdfStudentDetails } from "@/lib/student/practice-grading-pdf-student-details";

export type PracticeGradingPdfCoverProps = {
	subjectName: string;
	studentDetails: PracticeGradingPdfStudentDetails;
	/** @deprecated Use studentDetails.fullName; kept for footers. */
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
	if (diff) parts.push(`${diff} difficulty`);
	if (meta.timeLimitSeconds != null) {
		parts.push(`limit ${formatDuration(meta.timeLimitSeconds)}`);
	}
	if (meta.durationSeconds != null) {
		parts.push(`taken ${formatDuration(meta.durationSeconds)}`);
	}
	return parts.length > 0 ? parts.join(" · ") : "Practice test";
}

function PageFooter({
	studentDisplayName,
	totalQuestions,
	testMeta,
}: {
	studentDisplayName: string | null;
	totalQuestions: number;
	testMeta: PracticeGradingPdfTestMeta;
}) {
	const student = studentDisplayName?.trim() ? `${studentDisplayName.trim()} · ` : "";
	const config = formatTestConfigFooterLine(testMeta);
	return (
		<Text
			style={styles.footer}
			fixed
			render={({ pageNumber, totalPages }) =>
				`${student}${totalQuestions} questions · ${config} · Page ${pageNumber} / ${totalPages}`
			}
		/>
	);
}

function BrandedTopRight({ logoSrc }: { logoSrc: string | Buffer | null }) {
	if (logoSrc) {
		// eslint-disable-next-line jsx-a11y/alt-text -- PDF logo, decorative in document
		return <Image src={logoSrc} style={styles.logo} />;
	}
	return <Text style={styles.wordmark}>24Vertex</Text>;
}

function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<View style={styles.sectionLabelRow} wrap={false}>
			<View style={styles.sectionLabelBar} />
			<Text style={styles.sectionLabelText}>{children}</Text>
		</View>
	);
}

type CardVariant = "default" | "student" | "key" | "scored";

function ContentCard({
	variant,
	charCount,
	tier,
	children,
}: {
	variant: CardVariant;
	charCount: number;
	tier?: "tight" | "normal" | "loose";
	children: ReactNode;
}) {
	const pad = prosePadding(charCount, tier);
	const shell =
		variant === "student" ? styles.cardStudent
		: variant === "key" ? styles.cardKey
		: variant === "scored" ? styles.cardScored
		: styles.card;
	return <View style={[shell, pad]}>{children}</View>;
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

function buildCoverMetaLine(props: PracticeGradingPdfCoverProps): string {
	const parts: string[] = [
		`${props.totalQuestions} ${props.totalQuestions === 1 ? "question" : "questions"}`,
	];
	const diff = props.difficulty?.trim();
	if (diff) parts.push(`${diff} difficulty`);
	const date = formatDate(props.testDateIso ?? props.createdAtIso);
	if (date !== "—") parts.push(date);
	return parts.join(" · ");
}

function HeroStudentDetailsBlock({
	details,
	testDateIso,
	createdAtIso,
}: {
	details: PracticeGradingPdfStudentDetails;
	testDateIso: string | null;
	createdAtIso: string | null;
}) {
	const displayName = practiceGradingPdfStudentDisplayName(details);
	const lines = buildPracticeGradingPdfStudentDetailLines(details, {
		testDateIso,
		createdAtIso,
		includeSubject: false,
	});

	return (
		<View style={styles.heroStudentColumn} wrap={false}>
			<Text style={styles.heroStudentKicker}>Student</Text>
			<Text style={styles.heroStudentName} wrap>
				{displayName ?? "Student"}
			</Text>
			{lines.map((line) => {
				const isSecondary = line.tier === "secondary";
				const isCode = line.label === "Link code";
				return (
					<View
						key={line.label}
						style={
							isSecondary ?
								[styles.heroStudentRow, styles.heroStudentRowSecondary]
							:	styles.heroStudentRow
						}
						wrap={false}
					>
						<View style={styles.heroStudentLabelCol}>
							<Text style={styles.heroStudentLabel}>{line.label}</Text>
						</View>
						<Text
							style={
								isCode ?
									[styles.heroStudentValue, styles.heroStudentValueCode]
								: isSecondary ?
									[styles.heroStudentValue, styles.heroStudentValueSecondary]
								:	styles.heroStudentValue
							}
							wrap
						>
							{line.value}
						</Text>
					</View>
				);
			})}
		</View>
	);
}

function ReportCoverPage(props: PracticeGradingPdfCoverProps) {
	const { subjectName, studentDetails, overallScorePercent, summary, logoSrc, topicCoverageRows } = props;
	const heroSummary = truncateForPdf(summary.overall_summary ?? "", PDF_COVER_NARRATIVE_MAX);
	const insightsRaw = summary.ai_insights?.trim() ?? "";
	const insights = insightsRaw ? truncateForPdf(insightsRaw, PDF_COVER_INSIGHTS_MAX) : "";
	const scoreLabel =
		overallScorePercent != null ?
			`${overallScorePercent % 1 === 0 ? Math.round(overallScorePercent) : overallScorePercent.toFixed(1)}%`
		:	"—";

	const topicOverflow = topicCoverageRows.length > PDF_COVER_TOPIC_ROWS_MAX;
	const topicRowsShown = topicOverflow
		? topicCoverageRows.slice(0, PDF_COVER_TOPIC_ROWS_MAX)
		: topicCoverageRows;
	const restCount = topicCoverageRows.length - topicRowsShown.length;

	const strengths = summary.strengths ?? [];
	const focus = summary.improvement_areas ?? [];
	const recs = summary.recommendations ?? [];
	const useTwoCol = strengths.length > 0 && focus.length > 0;

	return (
		<Page size="A4" style={styles.page} wrap>
			<View style={styles.brandTopRule} />
			<View style={styles.coverHeaderRow} wrap={false}>
				<View>
					<Text style={styles.coverKicker}>Practice report</Text>
					<Text style={styles.coverTitle}>{subjectName}</Text>
					<Text style={styles.coverMeta}>{buildCoverMetaLine(props)}</Text>
				</View>
				<BrandedTopRight logoSrc={logoSrc} />
			</View>

			<View style={styles.heroCard} wrap={false}>
				<View style={styles.heroTopRow}>
					<HeroStudentDetailsBlock
						details={studentDetails}
						testDateIso={props.testDateIso}
						createdAtIso={props.createdAtIso}
					/>
					<View style={styles.heroScoreBlock}>
						<Text style={styles.heroScoreLabel}>Overall score</Text>
						<Text style={styles.heroScoreValue}>{scoreLabel}</Text>
					</View>
				</View>
				{heroSummary ? (
					<Text style={styles.heroSummary} wrap>
						{heroSummary}
					</Text>
				) : null}
			</View>

			{topicRowsShown.length > 0 ? (
				<>
					<Text style={styles.sectionLabel}>Topics and chapters</Text>
					<View style={styles.coverageTable}>
						<View style={styles.coverageRowHead} wrap={false}>
							<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Chapter</Text>
							<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Topic</Text>
							<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Avg</Text>
							<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Status</Text>
						</View>
						{topicRowsShown.map((row, i) => {
							const scoreStyle = tableScoreStyle(row.averageScore);
							const isAlt = i % 2 === 1;
							return (
								<View
									key={i}
									style={isAlt ? [styles.coverageRow, styles.coverageRowAlt] : styles.coverageRow}
									wrap={false}
								>
									<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.chapterName}</Text>
									<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.topicName}</Text>
									<Text
										style={
											scoreStyle ? [styles.coverageCellNarrow, scoreStyle] : styles.coverageCellNarrow
										}
									>
										{row.averageScore != null ? `${row.averageScore.toFixed(0)}%` : "—"}
									</Text>
									<Text
										style={
											scoreStyle ? [styles.coverageCellNarrow, scoreStyle] : styles.coverageCellNarrow
										}
									>
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
				</>
			) : null}

			{useTwoCol ? (
				<View style={styles.twoColRow} wrap={false}>
					<View style={styles.twoCol} wrap={false}>
						<Text style={styles.sectionLabel}>Strengths</Text>
						<TagChipList items={strengths} />
					</View>
					<View style={styles.twoColLast} wrap={false}>
						<Text style={styles.sectionLabel}>Focus areas</Text>
						<TagChipList items={focus} />
					</View>
				</View>
			) : (
				<>
					{strengths.length ? (
						<View wrap={false}>
							<Text style={styles.sectionLabel}>Strengths</Text>
							<TagChipList items={strengths} />
						</View>
					) : null}
					{focus.length ? (
						<View wrap={false}>
							<Text style={styles.sectionLabel}>Focus areas</Text>
							<TagChipList items={focus} />
						</View>
					) : null}
				</>
			)}

			{recs.length ? (
				<View wrap={false}>
					<Text style={styles.sectionLabel}>Recommendations</Text>
					<TagChipList items={recs} />
				</View>
			) : null}

			{insights ? (
				<View wrap={false}>
					<Text style={styles.sectionLabel}>Insights</Text>
					<View style={styles.insightsCard}>
						<Text style={styles.body} wrap>
							{insights}
						</Text>
					</View>
				</View>
			) : null}

			<PageFooter
				studentDisplayName={props.studentDisplayName}
				totalQuestions={props.totalQuestions}
				testMeta={props}
			/>
		</Page>
	);
}

function QuestionPageHeader({ q }: { q: PracticeGradingPdfQuestion }) {
	const tone = pdfTrafficFromVerdict(q.verdict);
	const topicLine = [q.chapter_name, q.topic_name].filter(Boolean).join(" · ");
	return (
		<View style={styles.qHead} wrap={false}>
			<View style={styles.qHeadLeft}>
				<Text style={styles.qNum}>Question {q.question_number}</Text>
				{topicLine ? (
					<Text style={styles.qTopic} wrap>
						{topicLine}
					</Text>
				) : null}
				<Text
					style={[
						styles.verdictPill,
						{
							backgroundColor: tone.pillBg,
							color: tone.pillFg,
							borderColor: tone.pillBorder,
						},
					]}
				>
					{pdfTrafficVerdictLabel(q.verdict)}
				</Text>
			</View>
			<View
				style={[
					styles.scoreBox,
					{
						backgroundColor: tone.scoreBg,
						borderColor: tone.scoreBorder,
					},
				]}
				wrap={false}
			>
				<TrafficSignalDots tone={tone} />
				<Text style={[styles.scoreBoxLabel, { color: tone.scoreLabelFg }]}>Score</Text>
				<Text style={[styles.scoreBoxValue, { color: tone.scoreFg }]}>{Math.round(q.score)}%</Text>
			</View>
		</View>
	);
}

function GradingBreakdownPdfView({ q }: { q: PracticeGradingPdfQuestion }) {
	const listChars =
		(q.what_was_correct ?? []).join("").length + (q.where_marks_were_lost ?? []).join("").length;

	return (
		<ContentCard variant="scored" charCount={listChars + (q.band_label?.length ?? 0)} tier="normal">
			{q.band_label?.trim() ? (
				<Text style={styles.breakdownBand}>Result: {q.band_label.trim()}</Text>
			) : null}
			{(q.what_was_correct?.length ?? 0) > 0 ? (
				<>
					<Text style={styles.breakdownListTitle}>What you got right</Text>
					{(q.what_was_correct ?? []).map((item, i) => (
						<Text key={`c-${i}`} style={styles.breakdownBullet} wrap>
							· {item}
						</Text>
					))}
				</>
			) : null}
			{(q.where_marks_were_lost?.length ?? 0) > 0 ? (
				<>
					<Text style={styles.breakdownListTitle}>Why not full marks</Text>
					{(q.where_marks_were_lost ?? []).map((item, i) => (
						<Text key={`l-${i}`} style={styles.breakdownBullet} wrap>
							· {item}
						</Text>
					))}
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
					Next step: {q.to_reach_next_band.trim()}
				</Text>
			) : null}
		</ContentCard>
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

function AnswerSectionsStack({
	studentAnswer,
	answerKey,
	summary,
}: {
	studentAnswer: string;
	answerKey: string;
	summary?: string | null;
}) {
	return (
		<>
			<SectionLabel>Your answer</SectionLabel>
			<ContentCard variant="student" charCount={studentAnswer.length} tier="tight">
				<Text style={styles.bodyCompact} wrap>
					{studentAnswer}
				</Text>
			</ContentCard>
			{summary?.trim() ? (
				<Text style={styles.atGlance} wrap>
					At a glance: {summary.trim()}
				</Text>
			) : null}
			<SectionLabel>Answer key (practice set)</SectionLabel>
			<ContentCard variant="key" charCount={answerKey.length} tier="normal">
				<Text style={styles.bodyCompact} wrap>
					{answerKey || "—"}
				</Text>
			</ContentCard>
		</>
	);
}

function renderQuestionPages(
	q: PracticeGradingPdfQuestion,
	nQuestions: number,
	logoSrc: string | Buffer | null,
	testMeta: PracticeGradingPdfTestMeta,
): ReactElement[] {
	const gen = clampGenerationBlockForPdf(q.generation_answer_display);
	const showBreakdown = hasGradingBreakdown(q);
	const coach = clampPdfPlainText(q.analysis ?? "", PDF_COACH_NOTE_MAX);
	const walk = clampPdfPlainText(q.step_by_step_solution ?? "", PDF_WALKTHROUGH_MAX);
	const topicLine = [q.chapter_name, q.topic_name].filter(Boolean).join(" · ");

	return [
		<Page key={q.question_id} size="A4" style={styles.page} wrap>
			<View style={styles.pageChromeRow} wrap={false}>
				<View style={{ flex: 1, paddingRight: 8 }}>
					<Text style={styles.pageChromeTitle}>
						{testMeta.subjectName} · Question {q.question_number} of {nQuestions}
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

			<View style={styles.qBlock}>
				<QuestionPageHeader q={q} />

				<SectionLabel>Question</SectionLabel>
				<ContentCard variant="default" charCount={q.question_text.length} tier="loose">
					<Text style={styles.body} wrap>
						{q.question_text}
					</Text>
					<QuestionVisualPdf visual={q.visual} />
				</ContentCard>

				<AnswerSectionsStack
					studentAnswer={q.student_answer_display}
					answerKey={gen.text}
					summary={q.user_answer_summary}
				/>

				{showBreakdown ? (
					<>
						<SectionLabel>How you were scored</SectionLabel>
						<GradingBreakdownPdfView q={q} />
					</>
				) : null}

				{coach.text ? (
					<>
						<SectionLabel>Coach note</SectionLabel>
						<ContentCard variant="default" charCount={coach.text.length}>
							<Text style={styles.body} wrap>
								{coach.text}
							</Text>
						</ContentCard>
					</>
				) : null}

				{walk.text ? (
					<>
						<SectionLabel>Walk through it</SectionLabel>
						<ContentCard variant="key" charCount={walk.text.length}>
							<Text style={styles.body} wrap>
								{walk.text}
							</Text>
						</ContentCard>
					</>
				) : null}
			</View>

			<PageFooter
				studentDisplayName={testMeta.studentDisplayName}
				totalQuestions={nQuestions}
				testMeta={testMeta}
			/>
		</Page>,
	];
}

export function PracticeGradingPdfDocument(props: PracticeGradingPdfDocumentProps) {
	const { questions, ...coverProps } = props;
	const nQ = questions.length;
	const logoSrc = coverProps.logoSrc;
	const testMeta: PracticeGradingPdfTestMeta = {
		subjectName: coverProps.subjectName,
		studentDisplayName: coverProps.studentDisplayName,
		difficulty: coverProps.difficulty,
		timeLimitSeconds: coverProps.timeLimitSeconds,
		durationSeconds: coverProps.durationSeconds,
	};

	return (
		<Document title={`${props.subjectName} · Practice report`}>
			<ReportCoverPage {...coverProps} />
			{questions.flatMap((q) => renderQuestionPages(q, nQ, logoSrc, testMeta))}
		</Document>
	);
}
