/**
 * Verdicts for `consumeXxxRateLimit` helpers from
 * `src/lib/practice/practice-rate-limit.ts`. The shape is uniform across
 * the consumers (`{ ok: true } | { ok: false, message: string }`).
 *
 * The factory exposes mutable verdicts so a single test file can flip the
 * gate state per test without re-running `vi.mock`.
 */
export type RateLimitVerdict = { ok: true } | { ok: false; message: string };

export interface MockRateLimitState {
	doubtChat?: RateLimitVerdict;
	generation?: RateLimitVerdict;
	practice?: RateLimitVerdict;
	studyTips?: RateLimitVerdict;
	adaptiveFollowups?: RateLimitVerdict;
}

export interface MockRateLimitBindings {
	consumeDoubtChatRateLimit: () => Promise<RateLimitVerdict>;
	consumeGenerationRateLimit: () => Promise<RateLimitVerdict>;
	consumePracticeRateLimit: () => Promise<RateLimitVerdict>;
	consumeStudyTipsRateLimit: () => Promise<RateLimitVerdict>;
	consumeAdaptiveFollowupsRateLimit: () => Promise<RateLimitVerdict>;
	__set: (next: MockRateLimitState) => void;
}

export function makeMockRateLimit(initial: MockRateLimitState = {}): MockRateLimitBindings {
	let state: MockRateLimitState = { ...initial };

	const verdict = (key: keyof MockRateLimitState): RateLimitVerdict => state[key] ?? { ok: true };

	return {
		consumeDoubtChatRateLimit: async () => verdict("doubtChat"),
		consumeGenerationRateLimit: async () => verdict("generation"),
		consumePracticeRateLimit: async () => verdict("practice"),
		consumeStudyTipsRateLimit: async () => verdict("studyTips"),
		consumeAdaptiveFollowupsRateLimit: async () => verdict("adaptiveFollowups"),
		__set: (next: MockRateLimitState) => {
			state = { ...state, ...next };
		},
	};
}
