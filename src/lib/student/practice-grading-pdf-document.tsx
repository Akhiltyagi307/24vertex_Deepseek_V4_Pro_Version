import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDuration } from "@/lib/student/subject-test-report";
import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

const styles = StyleSheet.create({
	cover: {
		padding: 48,
		fontSize: 11,
		fontFamily: "Helvetica",
		backgroundColor: "#0f172a",
		color: "#f8fafc",
		minHeight: "100%",
	},
	coverAccent: {
		fontSize: 10,
		color: "#6ee7b7",
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1.2,
		marginBottom: 12,
		textTransform: "uppercase",
	},
	coverTitle: {
		fontSize: 26,
		fontFamily: "Helvetica-Bold",
		marginBottom: 8,
		color: "#ffffff",
	},
	coverSub: { fontSize: 11, color: "#94a3b8", marginBottom: 28 },
	statsGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
	statCard: {
		width: "47%",
		marginRight: "3%",
		marginBottom: 12,
		backgroundColor: "#1e293b",
		borderRadius: 8,
		padding: 12,
		borderWidth: 1,
		borderColor: "#334155",
	},
	statLabel: { fontSize: 9, color: "#94a3b8", marginBottom: 4 },
	statValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#e2e8f0" },
	topicPill: {
		backgroundColor: "#14532d",
		color: "#bbf7d0",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4,
		fontSize: 9,
		marginRight: 6,
		marginBottom: 6,
	},
	topicRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, alignItems: "flex-start" },
	summaryBox: {
		marginTop: 20,
		padding: 14,
		backgroundColor: "#1e293b",
		borderRadius: 8,
		borderLeftWidth: 4,
		borderLeftColor: "#34d399",
	},
	summaryText: { fontSize: 10, color: "#e2e8f0", lineHeight: 1.5 },
	footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 8, color: "#64748b" },

	page: {
		padding: 40,
		fontSize: 10,
		fontFamily: "Helvetica",
		backgroundColor: "#ffffff",
	},
	qHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		borderBottomWidth: 2,
		borderBottomColor: "#0f766e",
		paddingBottom: 10,
		marginBottom: 14,
	},
	qMeta: { fontSize: 9, color: "#64748b" },
	qScore: { fontFamily: "Helvetica-Bold", fontSize: 14, color: "#0f766e" },
	block: { marginBottom: 12 },
	label: {
		fontSize: 9,
		color: "#64748b",
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		marginBottom: 4,
	},
	body: { fontSize: 10, lineHeight: 1.45, color: "#1e293b" },
});

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	} catch {
		return "—";
	}
}

export type PracticeGradingPdfCoverProps = {
	subjectName: string;
	difficulty: string | null;
	timeLimitSeconds: number | null;
	durationSeconds: number | null;
	testDateIso: string | null;
	createdAtIso: string | null;
	topicNames: string[];
	totalQuestions: number;
	overallScorePercent: number | null;
	overallSummary: string;
};

export type PracticeGradingPdfDocumentProps = PracticeGradingPdfCoverProps & {
	questions: Array<
		GradedQuestionItem & {
			question_number: number;
			question_text: string;
			question_type: string;
		}
	>;
};

export function PracticeGradingPdfDocument({
	subjectName,
	difficulty,
	timeLimitSeconds,
	durationSeconds,
	testDateIso,
	createdAtIso,
	topicNames,
	totalQuestions,
	overallScorePercent,
	overallSummary,
	questions,
}: PracticeGradingPdfDocumentProps) {
	const uniqueTopics = [...new Set(topicNames)];

	return (
		<Document>
			<Page size="A4" style={styles.cover}>
				<Text style={styles.coverAccent}>Practice test report</Text>
				<Text style={styles.coverTitle}>{subjectName}</Text>
				<Text style={styles.coverSub}>
					{formatDate(testDateIso ?? createdAtIso)} · {totalQuestions} questions
				</Text>

				<View style={styles.statsGrid}>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Overall score</Text>
						<Text style={styles.statValue}>
							{overallScorePercent != null ? `${Math.round(overallScorePercent)}%` : "—"}
						</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Difficulty</Text>
						<Text style={styles.statValue}>{difficulty?.trim() ? difficulty : "—"}</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Time limit</Text>
						<Text style={styles.statValue}>
							{timeLimitSeconds != null ? formatDuration(timeLimitSeconds) : "—"}
						</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Time taken</Text>
						<Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
					</View>
				</View>

				<Text style={[styles.label, { marginTop: 20, color: "#94a3b8" }]}>Topics covered</Text>
				<View style={styles.topicRow}>
					{uniqueTopics.map((t) => (
						<Text key={t} style={styles.topicPill}>
							{t}
						</Text>
					))}
				</View>

				<View style={styles.summaryBox}>
					<Text style={styles.summaryText}>{overallSummary}</Text>
				</View>

				<Text style={styles.footer} fixed>
					EduAI · Confidential practice report
				</Text>
			</Page>

			{questions.map((q) => (
				<Page key={q.question_id} size="A4" style={styles.page}>
					<View style={styles.qHeader}>
						<View>
							<Text style={styles.qMeta}>
								Q{q.question_number} · {q.question_type.replace("_", " ")}
							</Text>
							<Text style={styles.qMeta}>Verdict: {q.verdict.replace("_", " ")}</Text>
						</View>
						<Text style={styles.qScore}>{Math.round(q.score)}%</Text>
					</View>

					<View style={styles.block}>
						<Text style={styles.label}>Question</Text>
						<Text style={styles.body}>{q.question_text}</Text>
					</View>

					<View style={styles.block}>
						<Text style={styles.label}>Your answer</Text>
						<Text style={styles.body}>{q.user_answer_summary}</Text>
					</View>

					<View style={styles.block}>
						<Text style={styles.label}>Reference answer</Text>
						<Text style={styles.body}>{q.reference_answer_summary}</Text>
					</View>

					<View style={styles.block}>
						<Text style={styles.label}>Analysis</Text>
						<Text style={styles.body}>{q.analysis}</Text>
					</View>

					{q.step_by_step_solution?.trim() ? (
						<View style={styles.block}>
							<Text style={styles.label}>Step-by-step solution</Text>
							<Text style={styles.body}>{q.step_by_step_solution}</Text>
						</View>
					) : null}

					<Text style={[styles.footer, { color: "#94a3b8" }]} fixed>
						Question {q.question_number} of {totalQuestions}
					</Text>
				</Page>
			))}
		</Document>
	);
}
