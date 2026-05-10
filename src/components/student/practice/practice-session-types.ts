import type { PracticeQuestionKind, SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

export type PracticeSessionQuestion = {
	id: string;
	question_number: number;
	question_text: string;
	question_type: PracticeQuestionKind;
	difficulty_level: string | null;
	options: Record<string, string> | null;
	topic_id: string;
	topic_name: string;
	/** From `topics.chapter_name` when joined; used with `topic_name` for the header line. */
	chapter_name: string | null;
	/**
	 * Optional structured visual envelope. Read from `questions.metadata.visual`
	 * via `parseStoredQuestionVisualFromMetadata`. Null when the question has
	 * no visual or the stored envelope failed to parse (logged + dropped).
	 */
	visual: QuestionVisualEnvelope | null;
};

export type PracticeBatchItem = {
	questionId: string;
	studentAnswer: SessionStudentAnswer;
	flaggedForReview: boolean;
	timeSpentMs?: number;
	visits?: number;
};
