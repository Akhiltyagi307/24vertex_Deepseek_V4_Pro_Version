import type {
	PracticeCanonicalTopic,
	PracticeConfigResolveFailure,
	PublicGenerationMetadata,
	PublicPracticeQuestion,
} from "@/lib/practice";

export type FinalizePracticeSuccess = {
	ok: true;
	code: "success";
	/** Present only when PRACTICE_PROMPT_PREVIEW=true and NODE_ENV is not production. */
	userMessageJson?: string;
	systemPrompt?: string;
	canonicalTopics?: PracticeCanonicalTopic[];
};

export type FinalizePracticeFailure = {
	ok: false;
	code:
		| "unauthorized"
		| "validation_error"
		| "not_student"
		| "subject_not_enrolled"
		| "stale_selection"
		| "subject_mismatch"
		| "inactive_topic"
		| "database_error";
	message: string;
	fieldErrors?: Record<string, string[]>;
};

export type FinalizePracticeResult = FinalizePracticeSuccess | FinalizePracticeFailure;

export type GeneratePracticeSuccess = {
	ok: true;
	testId: string;
	subjectName: string;
	questions: PublicPracticeQuestion[];
	generation_metadata: PublicGenerationMetadata;
};

export type GeneratePracticeFailure = {
	ok: false;
	code:
		| FinalizePracticeFailure["code"]
		| "generation_failed"
		| "generation_invalid"
		| "rate_limited"
		| "quota_tests"
		| "trial_expired"
		| "subscription_expired";
	message: string;
	fieldErrors?: Record<string, string[]>;
	/** Support/debug reference for logs tied to this generation attempt. */
	correlationId?: string;
	/** When true the client should surface the paywall dialog instead of an inline error. */
	paywall?: boolean;
	/**
	 * For `code: "rate_limited"` — ISO timestamp when the limit window resets,
	 * or null if unknown. The generate-stream route maps this to a `Retry-After`
	 * header so the client can show a precise retry hint (H-3).
	 */
	resetAt?: string | null;
};

export type GeneratePracticeResult = GeneratePracticeSuccess | GeneratePracticeFailure;

export function mapResolveToFinalizeFailure(r: PracticeConfigResolveFailure): FinalizePracticeFailure {
	return { ok: false, code: r.code, message: r.message };
}

export function mapResolveToGenerateFailure(r: PracticeConfigResolveFailure): GeneratePracticeFailure {
	return { ok: false, code: r.code, message: r.message };
}
