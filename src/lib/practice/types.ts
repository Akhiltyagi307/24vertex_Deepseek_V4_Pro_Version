export type PracticeDifficulty = "easy" | "medium" | "hard";

/** Server-verified row used for prompts and UI (names from DB, not the client). */
export type PracticeCanonicalTopic = {
	trackerId: string;
	topicId: string;
	topicName: string;
	unitName: string;
	chapterName: string;
	grade: number;
	status: string;
	averageScore: number | null;
	testsTaken: number;
	trend: string;
	lastTestDate: string | null;
};
