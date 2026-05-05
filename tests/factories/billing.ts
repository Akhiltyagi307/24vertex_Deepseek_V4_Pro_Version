/**
 * Mocks for `@/lib/billing/entitlements` consumers used by the AI routes.
 *
 * `canStartDoubtChat` and `preflightPracticeTestQuota` return a `ConsumeResult`
 * verdict shaped as `{ ok: true } | { ok: false, code, message }`. The factory
 * exposes mutable per-test verdicts.
 */

export type BillingVerdict =
	| { ok: true }
	| { ok: false; code: string; message: string };

export interface MockBillingState {
	canStartDoubtChat?: BillingVerdict;
	preflightPracticeTestQuota?: BillingVerdict;
}

export interface MockBillingBindings {
	canStartDoubtChat: () => Promise<BillingVerdict>;
	preflightPracticeTestQuota: () => Promise<BillingVerdict>;
	consumeTokens: (...args: unknown[]) => Promise<undefined>;
	__set: (next: MockBillingState) => void;
}

export function makeMockBilling(initial: MockBillingState = {}): MockBillingBindings {
	let state: MockBillingState = { ...initial };

	return {
		canStartDoubtChat: async () => state.canStartDoubtChat ?? { ok: true },
		preflightPracticeTestQuota: async () => state.preflightPracticeTestQuota ?? { ok: true },
		consumeTokens: async () => undefined,
		__set: (next: MockBillingState) => {
			state = { ...state, ...next };
		},
	};
}
