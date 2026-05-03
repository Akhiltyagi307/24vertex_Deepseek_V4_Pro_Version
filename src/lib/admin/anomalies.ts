export type TestRowLike = {
	durationSeconds: number | null;
	timeLimitSeconds: number | null;
	totalScore: string | null;
	status: string | null;
};

export type QuestionRowLike = { answerKey: unknown };

export type AnswerRowLike = { aiFeedback: string | null };

/** duration < 5% of allowed time — possible speed anomaly (PDR §4.7). */
export function anomalyTooFast(test: TestRowLike): boolean {
	const limit = test.timeLimitSeconds ?? 0;
	const dur = test.durationSeconds ?? 0;
	if (limit <= 0 || dur <= 0) return false;
	return dur < limit * 0.05;
}

export function anomalyZeroScore(test: TestRowLike): boolean {
	const s = test.totalScore;
	if (s == null) return false;
	return Number(s) === 0 && (test.status === "graded" || test.status === "submitted");
}

export function anomalyMissingAnswerKey(question: QuestionRowLike): boolean {
	const k = question.answerKey;
	return k == null || (typeof k === "object" && k !== null && Object.keys(k as object).length === 0);
}

export function anomalyAiErrorAnswer(answer: AnswerRowLike): boolean {
	const f = answer.aiFeedback;
	return typeof f === "string" && f.startsWith("[error]");
}

/** Flags shown on admin test grids (practice list + per-student). */
export function adminPracticeTestAnomalyFlags(test: TestRowLike): string[] {
	const flags: string[] = [];
	if (anomalyTooFast(test)) flags.push("too_fast");
	if (anomalyZeroScore(test)) flags.push("zero_score");
	return flags;
}

export type LiveTestRowLike = TestRowLike & {
	tabBlurCount?: number | null;
	isPaused?: boolean | null;
};

/** Live sessions grid: practice flags plus tab-blur and pause signals (PDR §4.28). */
export function adminLiveTestAnomalyFlags(test: LiveTestRowLike): string[] {
	const flags = adminPracticeTestAnomalyFlags(test);
	if ((test.tabBlurCount ?? 0) > 3) flags.push("tab_blur");
	if (test.isPaused) flags.push("paused");
	return flags;
}
