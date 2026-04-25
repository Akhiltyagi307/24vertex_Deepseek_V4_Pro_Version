import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

import { formatDuration } from "@/lib/student/subject-test-report";
import type { GradedQuestionItem, PracticeGradingSummary } from "@/lib/practice/grading-schema";
import {
	chunkTextByMaxChars,
	PDF_ANALYSIS_FIRST_MAX,
	PDF_BLOCK_CONT_MAX,
} from "@/lib/student/practice-grading-pdf-chunks";

// --- Design tokens (aligned with app dark + emerald accent) -----------------
const c = {
	bgCover: "#0f172a",
	card: "#1e293b",
	cardBorder: "#334155",
	muted: "#94a3b8",
	ink: "#1e293b",
	inkLight: "#f8fafc",
	accent: "#34d399",
	accentText: "#6ee7b7",
	white: "#ffffff",
};

const styles = StyleSheet.create({
	cover: {
		padding: 44,
		fontSize: 10,
		fontFamily: "Helvetica",
		backgroundColor: c.bgCover,
		color: c.inkLight,
		minHeight: "100%",
	},
	coverAccent: {
		fontSize: 9,
		color: c.accentText,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.2,
		marginBottom: 10,
		textTransform: "uppercase",
	},
	coverTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 4, color: c.white },
	coverSub: { fontSize: 10, color: c.muted, marginBottom: 20 },
	heroLine: { fontSize: 10, color: c.muted, marginBottom: 16 },
	metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, gap: 0 },
	metaCard: {
		width: "48%",
		marginRight: "2%",
		marginBottom: 10,
		backgroundColor: c.card,
		borderRadius: 6,
		padding: 10,
		borderWidth: 1,
		borderColor: c.cardBorder,
	},
	metaLabel: { fontSize: 8, color: c.muted, marginBottom: 3, textTransform: "uppercase" },
	metaValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: c.inkLight },
	sectionLabel: {
		fontSize: 9,
		color: c.accentText,
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		marginTop: 14,
		marginBottom: 6,
	},
	coverageTable: {
		borderWidth: 1,
		borderColor: c.cardBorder,
		borderRadius: 6,
		overflow: "hidden",
		marginTop: 4,
	},
	coverageRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.cardBorder },
	coverageRowHead: { backgroundColor: c.card, flexDirection: "row" },
	coverageCell: {
		flex: 1,
		padding: 8,
		fontSize: 8,
		color: c.inkLight,
	},
	coverageCellNarrow: {
		width: "18%",
		padding: 8,
		fontSize: 8,
		color: c.inkLight,
	},
	coverageHead: { fontFamily: "Helvetica-Bold", color: c.muted, fontSize: 7, textTransform: "uppercase" },
	summaryNarrative: {
		marginTop: 12,
		padding: 12,
		backgroundColor: c.card,
		borderLeftWidth: 3,
		borderLeftColor: c.accent,
		borderRadius: 4,
	},
	summaryNarrativeText: { fontSize: 9, color: c.inkLight, lineHeight: 1.45 },
	bullets: { marginTop: 4 },
	bulletItem: { fontSize: 9, color: c.inkLight, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8 },
	insightsBox: {
		marginTop: 10,
		padding: 10,
		backgroundColor: "#134e4a",
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "#115e59",
	},
	insightsText: { fontSize: 9, color: "#ccfbf1", lineHeight: 1.45 },
	footer: {
		position: "absolute",
		bottom: 28,
		left: 44,
		right: 44,
		fontSize: 7,
		color: c.muted,
	},

	// Question pages
	qPage: {
		padding: 36,
		fontSize: 10,
		fontFamily: "Helvetica",
		backgroundColor: "#ffffff",
	},
	qTopBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 14,
		paddingBottom: 10,
		borderBottomWidth: 2,
		borderBottomColor: "#0d9488",
	},
	qTitleBlock: { flex: 1, paddingRight: 12 },
	qBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
	verdictPill: {
		borderRadius: 4,
		paddingVertical: 3,
		paddingHorizontal: 7,
		fontSize: 7,
		fontFamily: "Helvetica-Bold",
	},
	scorePill: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		color: "#0f766e",
	},
	loc: { fontSize: 8, color: "#64748b", lineHeight: 1.3 },
	section: { marginBottom: 11 },
	sectionLabelQ: {
		fontSize: 8,
		color: "#64748b",
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		marginBottom: 4,
	},
	sectionBody: { fontSize: 10, lineHeight: 1.45, color: c.ink },
	card: {
		borderWidth: 1,
		borderColor: "#e2e8f0",
		backgroundColor: "#f8fafc",
		borderRadius: 5,
		padding: 9,
		marginTop: 3,
	},
	continuedHint: {
		fontSize: 8,
		color: "#0f766e",
		fontFamily: "Helvetica-Bold",
		marginBottom: 6,
		textTransform: "uppercase",
	},
});

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	} catch {
		return "—";
	}
}

function formatQType(t: string): string {
	return t.replace(/_/g, " ");
}

function verdictStyles(v: GradedQuestionItem["verdict"]): { bg: string; fg: string; label: string } {
	if (v === "correct") return { bg: "#d1fae7", fg: "#047857", label: "Correct" };
	if (v === "partially_correct") return { bg: "#fef3c7", fg: "#b45309", label: "Partially correct" };
	return { bg: "#fee2e2", fg: "#b91c1c", label: "Incorrect" };
}

/** Split analysis: first chunk sized for the first question page, rest in larger chunks. */
function splitAnalysisForQuestionPages(analysis: string): { first: string; rest: string[] } {
	const t = analysis.trim();
	if (!t) return { first: "", rest: [] };
	const parts = chunkTextByMaxChars(t, PDF_ANALYSIS_FIRST_MAX);
	if (parts.length === 0) return { first: "", rest: [] };
	if (parts.length === 1) return { first: parts[0] ?? "", rest: [] };
	const [first, ...tailParts] = parts;
	const merged = tailParts.join("\n\n");
	const rest = merged ? chunkTextByMaxChars(merged, PDF_BLOCK_CONT_MAX) : [];
	return { first: first ?? "", rest };
}

function splitStep(text: string | undefined): string[] {
	if (!text?.trim()) return [];
	return chunkTextByMaxChars(text.trim(), PDF_BLOCK_CONT_MAX);
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
	/** For location line (not in grader JSON; from topics table) */
	topic_name: string;
	/** For location line */
	chapter_name: string;
	unit_name: string | null;
	grade: number | null;
	student_answer_display: string;
	/** Per-question item difficulty if present */
	question_difficulty: string | null;
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
};

export type PracticeGradingPdfDocumentProps = PracticeGradingPdfCoverProps & {
	questions: PracticeGradingPdfQuestion[];
};

function GlobalFooter() {
	return (
		<Text
			style={styles.footer}
			fixed
			render={({ pageNumber, totalPages }) =>
				`EduAI · Confidential practice report · ${pageNumber} / ${totalPages}`
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
	} = props;

	return (
		<Page size="A4" style={styles.cover} wrap>
			<Text style={styles.coverAccent}>Practice test report</Text>
			<Text style={styles.coverTitle}>{subjectName}</Text>
			<Text style={styles.coverSub}>
				{formatDate(testDateIso ?? createdAtIso)} · {totalQuestions} questions
			</Text>
			{studentDisplayName ? <Text style={styles.heroLine}>Student: {studentDisplayName}</Text> : null}

			<View style={styles.metaGrid}>
				<View style={styles.metaCard}>
					<Text style={styles.metaLabel}>Overall score</Text>
					<Text style={styles.metaValue}>
						{overallScorePercent != null ? `${Math.round(overallScorePercent)}%` : "—"}
					</Text>
				</View>
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
				<View style={styles.metaCard}>
					<Text style={styles.metaLabel}>Time taken</Text>
					<Text style={styles.metaValue}>{formatDuration(durationSeconds)}</Text>
				</View>
			</View>

			<Text style={styles.sectionLabel}>Topics and chapters</Text>
			<View style={styles.coverageTable}>
				<View style={styles.coverageRowHead} wrap={false}>
					<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Chapter</Text>
					<Text style={[styles.coverageCell, styles.coverageHead, { flex: 1.1 }]}>Topic</Text>
					<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Avg</Text>
					<Text style={[styles.coverageCellNarrow, styles.coverageHead]}>Status</Text>
				</View>
				{topicCoverageRows.map((row, i) => (
					<View key={i} style={styles.coverageRow} wrap={false}>
						<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.chapterName}</Text>
						<Text style={{ ...styles.coverageCell, flex: 1.1 }}>{row.topicName}</Text>
						<Text style={styles.coverageCellNarrow}>
							{row.averageScore != null ? `${row.averageScore.toFixed(0)}%` : "—"}
						</Text>
						<Text style={styles.coverageCellNarrow}>{row.statusLabel}</Text>
					</View>
				))}
			</View>

			<Text style={styles.sectionLabel}>How you did</Text>
			<View style={styles.summaryNarrative} wrap={false}>
				<Text style={styles.summaryNarrativeText}>{summary.overall_summary}</Text>
			</View>

			{summary.strengths?.length ? (
				<View wrap={false}>
					<Text style={styles.sectionLabel}>Strengths</Text>
					{summary.strengths.map((s, i) => (
						<Text key={i} style={styles.bulletItem}>
							· {s}
						</Text>
					))}
				</View>
			) : null}

			{summary.improvement_areas?.length ? (
				<View wrap={false}>
					<Text style={styles.sectionLabel}>Focus areas</Text>
					{summary.improvement_areas.map((s, i) => (
						<Text key={i} style={styles.bulletItem}>
							· {s}
						</Text>
					))}
				</View>
			) : null}

			{summary.recommendations?.length ? (
				<View wrap={false}>
					<Text style={styles.sectionLabel}>Recommendations</Text>
					{summary.recommendations.map((s, i) => (
						<Text key={i} style={styles.bulletItem}>
							· {s}
						</Text>
					))}
				</View>
			) : null}

			{summary.ai_insights?.trim() ? (
				<View style={styles.insightsBox} wrap={false}>
					<Text style={styles.sectionLabel}>Insights</Text>
					<Text style={styles.insightsText}>{summary.ai_insights.trim()}</Text>
				</View>
			) : null}

			<GlobalFooter />
		</Page>
	);
}

type QuestionPageHeaderProps = {
	q: PracticeGradingPdfQuestion;
	continued?: boolean;
	sectionHint?: string;
};

function QuestionPageHeader({ q, continued, sectionHint }: QuestionPageHeaderProps) {
	const v = verdictStyles(q.verdict);
	return (
		<View style={styles.qTopBar} wrap={false}>
			<View style={styles.qTitleBlock}>
				<Text style={styles.loc}>
					Question {q.question_number} · {formatQType(q.question_type)}
					{continued ? " · continued" : ""}
				</Text>
				{sectionHint ? <Text style={styles.continuedHint}>{sectionHint}</Text> : null}
				<Text style={{ fontSize: 9, color: c.ink, marginTop: 2 }} wrap>
					{q.chapter_name}
					{q.unit_name ? ` · ${q.unit_name}` : ""}
					{q.grade != null ? ` · Grade ${q.grade}` : ""}
					{q.topic_name ? ` · ${q.topic_name}` : ""}
				</Text>
				{q.question_difficulty ? (
					<Text style={[styles.loc, { marginTop: 2 }]}>Item difficulty: {q.question_difficulty}</Text>
				) : null}
				<View style={styles.qBadgeRow} wrap={false}>
					<Text style={[styles.verdictPill, { backgroundColor: v.bg, color: v.fg, marginRight: 4 }]}>{v.label}</Text>
				</View>
			</View>
			<Text style={styles.scorePill}>{Math.round(q.score)}%</Text>
		</View>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionLabelQ}>{label}</Text>
			{children}
		</View>
	);
}

function renderQuestionPageSequence(
	q: PracticeGradingPdfQuestion,
	nQuestions: number,
): ReactElement[] {
	const pages: ReactElement[] = [];
	const { first, rest: analysisRest } = splitAnalysisForQuestionPages(q.analysis);
	const stepParts = splitStep(q.step_by_step_solution);

	// page 1: stem + your answer + ref + first analysis
	pages.push(
		<Page key={`${q.question_id}-p0`} size="A4" style={styles.qPage} wrap>
			<QuestionPageHeader q={q} />
			<Section label="Question">
				<Text style={styles.sectionBody} wrap>
					{q.question_text}
				</Text>
			</Section>
			<Section label="Your answer">
				<View style={styles.card}>
					<Text style={styles.sectionBody} wrap>
						{q.student_answer_display}
					</Text>
				</View>
				{q.user_answer_summary?.trim() ? (
					<Text style={[styles.loc, { marginTop: 5 }]} wrap>
						At a glance: {q.user_answer_summary.trim()}
					</Text>
				) : null}
			</Section>
			<Section label="Reference / model answer">
				<View style={styles.card}>
					<Text style={styles.sectionBody} wrap>
						{q.reference_answer_summary?.trim() ? q.reference_answer_summary.trim() : "—"}
					</Text>
				</View>
			</Section>
			{first ? (
				<Section label="Analysis">
					<Text style={styles.sectionBody} wrap>
						{first}
					</Text>
				</Section>
			) : null}
			<Text
				style={[styles.footer, { position: "absolute", color: "#64748b" }]}
				fixed
				render={({ pageNumber, totalPages }) =>
					`Q ${q.question_number} of ${nQuestions} · ${pageNumber} / ${totalPages}`
				}
			/>
		</Page>,
	);

	for (let i = 0; i < analysisRest.length; i++) {
		pages.push(
			<Page key={`${q.question_id}-a${i}`} size="A4" style={styles.qPage} wrap>
				<QuestionPageHeader
					q={q}
					continued
					sectionHint={i === 0 ? "Analysis (continued)" : "Analysis (continued)"}
				/>
				<Section label="Analysis">
					<Text style={styles.sectionBody} wrap>
						{analysisRest[i]}
					</Text>
				</Section>
				<Text
					style={[styles.footer, { position: "absolute", color: "#64748b" }]}
					fixed
					render={({ pageNumber, totalPages }) =>
						`Q ${q.question_number} of ${nQuestions} · ${pageNumber} / ${totalPages}`
					}
				/>
			</Page>,
		);
	}

	for (let i = 0; i < stepParts.length; i++) {
		pages.push(
			<Page key={`${q.question_id}-s${i}`} size="A4" style={styles.qPage} wrap>
				<QuestionPageHeader
					q={q}
					continued
					sectionHint={i === 0 ? "Step-by-step solution" : "Step-by-step (continued)"}
				/>
				<Section label={i === 0 ? "Step-by-step solution" : "Step-by-step (continued)"}>
					<Text style={styles.sectionBody} wrap>
						{stepParts[i]}
					</Text>
				</Section>
				<Text
					style={[styles.footer, { position: "absolute", color: "#64748b" }]}
					fixed
					render={({ pageNumber, totalPages }) =>
						`Q ${q.question_number} of ${nQuestions} · ${pageNumber} / ${totalPages}`
					}
				/>
			</Page>,
		);
	}

	return pages;
}

export function PracticeGradingPdfDocument(props: PracticeGradingPdfDocumentProps) {
	const { questions, ...coverProps } = props;
	const nQ = questions.length;
	return (
		<Document title={`${props.subjectName} — Practice report`}>
			<ReportCoverPage {...coverProps} />
			{questions.flatMap((q) => renderQuestionPageSequence(q, nQ))}
		</Document>
	);
}
