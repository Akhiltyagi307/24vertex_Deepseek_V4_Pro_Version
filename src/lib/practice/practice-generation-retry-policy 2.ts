import type { GeneratePracticeFailure } from "../../../app/student/practice/actions/types";

export type PracticeRetryClassification = {
	retryable: boolean;
	reason: string;
};

const TRANSIENT_ERROR_PATTERN =
	/\b(429|503|504|rate(?:[ -]?limit(?:ing)?)?|timeout|timed out|overload|capacity|socket hang up|network|temporar(?:y|ily)|econn|enotfound|eai_again)\b/i;
const DETERMINISTIC_FAILURE_PATTERN =
	/\b(question mix|expected|must include|missing options|non-multiple-choice|topic that was not|output blocked|replacement questions failed|timed out before a safe retry could start)\b/i;

export function classifyPracticeGenerationFailureForRetry(
	failure: Pick<GeneratePracticeFailure, "code" | "message">,
): PracticeRetryClassification {
	if (failure.code === "generation_invalid") {
		return { retryable: false, reason: "generation_invalid" };
	}
	if (failure.code === "database_error") {
		return { retryable: false, reason: "database_error" };
	}
	if (failure.code === "validation_error") {
		return { retryable: false, reason: "validation_error" };
	}
	if (failure.code === "generation_failed") {
		if (DETERMINISTIC_FAILURE_PATTERN.test(failure.message)) {
			return { retryable: false, reason: "deterministic_generation_failed" };
		}
		if (TRANSIENT_ERROR_PATTERN.test(failure.message)) {
			return { retryable: true, reason: "transient_generation_failed" };
		}
		// Preserve current retry behavior for unknown generation failures.
		return { retryable: true, reason: "unknown_generation_failed_default_retry" };
	}
	return { retryable: false, reason: "non_retryable_code" };
}
