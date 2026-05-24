import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

export const QNA_LOG_PAGE_SIZES = [50, 100, 500] as const;
export type QnaLogPageSize = (typeof QNA_LOG_PAGE_SIZES)[number];

export const QNA_LOG_SOURCES = ["practice", "assignment"] as const;
export type QnaLogSource = (typeof QNA_LOG_SOURCES)[number];

export const QNA_LOG_PERFORMANCE = ["correct", "partial", "incorrect", "pending"] as const;
export type QnaLogPerformance = (typeof QNA_LOG_PERFORMANCE)[number];

export const QNA_LOG_SORT_KEYS = ["date", "subject", "performance", "type", "topic"] as const;
export type QnaLogSortKey = (typeof QNA_LOG_SORT_KEYS)[number];

export const QNA_LOG_SORT_DIRS = ["asc", "desc"] as const;
export type QnaLogSortDir = (typeof QNA_LOG_SORT_DIRS)[number];

export const QNA_LOG_QUESTION_TYPES = [
	"multiple_choice",
	"fill_in_blank",
	"short_answer",
	"long_answer",
	"numerical",
] as const;
export type QnaLogQuestionType = (typeof QNA_LOG_QUESTION_TYPES)[number];

export type QnaLogFilters = {
	query: string | null;
	subjectId: string | null;
	source: QnaLogSource | null;
	performance: QnaLogPerformance | null;
	questionType: QnaLogQuestionType | null;
	fromDateKey: string | null;
	toDateKey: string | null;
};

export type QnaLogSort = {
	key: QnaLogSortKey;
	dir: QnaLogSortDir;
};

export type QnaLogListParams = {
	studentId: string;
	page: number;
	pageSize: QnaLogPageSize;
	filters: QnaLogFilters;
	sort: QnaLogSort;
};

export type QnaLogListRow = {
	answerId: string;
	questionId: string;
	testId: string;
	questionNumber: number;
	questionPreview: string;
	questionType: QnaLogQuestionType;
	dateIso: string | null;
	source: QnaLogSource;
	performance: QnaLogPerformance;
	scorePercent: number | null;
	subjectId: string;
	subjectName: string;
	subjectSortOrder: number;
	topicName: string;
	chapterName: string | null;
	testStatus: "submitted" | "graded";
};

export type QnaLogListResult = {
	rows: QnaLogListRow[];
	total: number;
	page: number;
	pageSize: QnaLogPageSize;
	subjectOptions: Array<{ id: string; name: string; sortOrder: number }>;
};

export type QnaLogGradingBreakdown = {
	bandLabel: string;
	whatWasCorrect: string[];
	whereMarksWereLost: string[];
	toReachNextBand: string;
	criterionScores: Array<{ name: string; points: number; note: string }>;
};

export type QnaLogAiFeedback = {
	analysis: string;
	stepByStep: string | null;
	breakdown: QnaLogGradingBreakdown | null;
};

export type QnaLogDetail = {
	answerId: string;
	questionId: string;
	testId: string;
	questionNumber: number;
	questionText: string;
	questionType: QnaLogQuestionType;
	difficultyLevel: string | null;
	dateIso: string | null;
	source: QnaLogSource;
	testStatus: "submitted" | "graded";
	performance: QnaLogPerformance;
	scorePercent: number | null;
	subjectId: string;
	subjectName: string;
	topicName: string;
	chapterName: string | null;
	options: Record<string, string> | null;
	studentAnswerDisplay: string;
	studentSelectedKey: string | null;
	correctOptionKey: string | null;
	correctAnswerDisplay: string | null;
	correctAnswerSummary: string | null;
	aiFeedback: QnaLogAiFeedback | null;
	aiUserAnswerSummary: string | null;
	aiReferenceAnswerSummary: string | null;
	visual: QuestionVisualEnvelope | null;
};
