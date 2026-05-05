import type { PracticeQuestionKind, SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

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
};

export type PracticeBatchItem = {
	questionId: string;
	studentAnswer: SessionStudentAnswer;
	flaggedForReview: boolean;
	timeSpentMs?: number;
	visits?: number;
};
