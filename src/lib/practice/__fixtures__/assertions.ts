/**
 * Assertion evaluators for the practice prompt fixture system.
 *
 * Each evaluator takes (prompt | output, assertion) and returns a pass/fail
 * with an explanatory reason. Pure functions — easy to unit-test in isolation.
 */

import type {
	GeneratedOutput,
	OutputAssertion,
	OutputAssertionResult,
	PracticeFixture,
	PromptAssertion,
	PromptAssertionResult,
} from "./types";

// ---------------------------------------------------------------------------
// Tier 1 — prompt assertions
// ---------------------------------------------------------------------------

export function evaluatePromptAssertion(
	prompt: string,
	assertion: PromptAssertion,
): PromptAssertionResult {
	switch (assertion.type) {
		case "contains": {
			const pass = prompt.includes(assertion.substring);
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt to contain ${JSON.stringify(assertion.substring)}${assertion.label ? ` (${assertion.label})` : ""} — not found.`,
			};
		}
		case "notContains": {
			const pass = !prompt.includes(assertion.substring);
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt NOT to contain ${JSON.stringify(assertion.substring)}${assertion.label ? ` (${assertion.label})` : ""} — but it does.`,
			};
		}
		case "matches": {
			const pass = assertion.regex.test(prompt);
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt to match ${assertion.regex}${assertion.label ? ` (${assertion.label})` : ""} — no match.`,
			};
		}
		case "lengthBetween": {
			const pass =
				prompt.length >= assertion.min && prompt.length <= assertion.max;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt length ∈ [${assertion.min}, ${assertion.max}] — actual ${prompt.length}.`,
			};
		}
		case "interpolatesQuestionCount": {
			const target = `Total items = ${assertion.expected}.`;
			const pass = prompt.includes(target);
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt to interpolate "${target}" — not found (count interpolation drift).`,
			};
		}
		case "mentionsGrade": {
			const target = `Grade ${assertion.grade}`;
			const pass = prompt.includes(target);
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected prompt to mention "${target}" — not found.`,
			};
		}
	}
}

// ---------------------------------------------------------------------------
// Tier 2 — output assertions (used by the LLM eval runner)
// ---------------------------------------------------------------------------

export type OutputAssertionContext = {
	expectedTotalCount: number;
	expectedPerBucket: {
		multiple_choice: number;
		fill_in_blank: number;
		short_answer: number;
		long_answer: number;
	};
};

function flattenAllQuestions(output: GeneratedOutput) {
	const buckets = output.questions_by_type ?? {};
	return [
		...(buckets.multiple_choice ?? []),
		...(buckets.fill_in_blank ?? []),
		...(buckets.short_answer ?? []),
		...(buckets.long_answer ?? []),
	];
}

export function evaluateOutputAssertion(
	output: GeneratedOutput,
	assertion: OutputAssertion,
	ctx: OutputAssertionContext,
): OutputAssertionResult {
	switch (assertion.type) {
		case "totalCountMatches": {
			const total = flattenAllQuestions(output).length;
			const pass = total === ctx.expectedTotalCount;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected ${ctx.expectedTotalCount} questions total — got ${total}.`,
			};
		}
		case "perBucketCountsMatch": {
			const buckets = output.questions_by_type ?? {};
			const actual = {
				multiple_choice: buckets.multiple_choice?.length ?? 0,
				fill_in_blank: buckets.fill_in_blank?.length ?? 0,
				short_answer: buckets.short_answer?.length ?? 0,
				long_answer: buckets.long_answer?.length ?? 0,
			};
			const exp = ctx.expectedPerBucket;
			const pass =
				actual.multiple_choice === exp.multiple_choice &&
				actual.fill_in_blank === exp.fill_in_blank &&
				actual.short_answer === exp.short_answer &&
				actual.long_answer === exp.long_answer;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Per-bucket counts mismatch. Expected mc=${exp.multiple_choice}/fib=${exp.fill_in_blank}/sa=${exp.short_answer}/la=${exp.long_answer}; got mc=${actual.multiple_choice}/fib=${actual.fill_in_blank}/sa=${actual.short_answer}/la=${actual.long_answer}.`,
			};
		}
		case "topicIdsFromList": {
			const allQuestions = flattenAllQuestions(output);
			const allowed = new Set(assertion.allowedTopicIds);
			const violators: string[] = [];
			for (const q of allQuestions) {
				const tid = q.topic_id ?? "";
				if (!allowed.has(tid)) {
					violators.push(tid || "(missing)");
				}
			}
			const pass = violators.length === 0;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `${violators.length} question(s) have topic_id outside the supplied list. First offender: ${JSON.stringify(violators[0])}. Hallucinated topic_ids are a hard contract violation.`,
			};
		}
		case "noEmptyQuestions": {
			const allQuestions = flattenAllQuestions(output);
			const offenders: number[] = [];
			allQuestions.forEach((q, idx) => {
				const hasText = (q.question_text ?? "").trim().length > 0;
				const hasAnswerKey =
					q.answer_key !== undefined &&
					(q.answer_key.correct_answer ?? "").trim().length > 0;
				if (!hasText || !hasAnswerKey) offenders.push(idx);
			});
			const pass = offenders.length === 0;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `${offenders.length} question(s) have empty question_text or answer_key. Indices: ${offenders.slice(0, 3).join(", ")}${offenders.length > 3 ? "…" : ""}.`,
			};
		}
		case "respectsTimeBudget": {
			const allQuestions = flattenAllQuestions(output);
			const sumSec = allQuestions.reduce(
				(acc, q) => acc + (q.estimated_time_seconds ?? 0),
				0,
			);
			const lower = Math.round(0.8 * assertion.timeLimit);
			const upper = Math.round(1.2 * assertion.timeLimit);
			const pass = sumSec >= lower && sumSec <= upper;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Σ estimated_time_seconds = ${sumSec}; expected ∈ [${lower}, ${upper}] (±20% of ${assertion.timeLimit}s).`,
			};
		}
		case "hasAdaptationRationale": {
			const text = (output.generation_metadata?.adaptation_rationale ?? "").trim();
			const pass = text.length > 0;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `generation_metadata.adaptation_rationale is empty or missing.`,
			};
		}
		case "mcqOptionsParity": {
			const mcqs = output.questions_by_type?.multiple_choice ?? [];
			if (mcqs.length === 0) {
				return {
					pass: true,
					assertion,
					reason: "(no MCQs in output — assertion vacuously satisfied)",
				};
			}
			const firstWith = mcqs.find((q) => q.options !== undefined);
			if (!firstWith) {
				return {
					pass: false,
					assertion,
					reason: "No MCQ has an options field.",
				};
			}
			const expectedKeys = ["A", "B", "C", "D"];
			const actualKeys = Object.keys(firstWith.options ?? {}).sort();
			const allPresent = expectedKeys.every((k) => actualKeys.includes(k));
			if (!allPresent) {
				return {
					pass: false,
					assertion,
					reason: `First MCQ options keys are ${JSON.stringify(actualKeys)}; expected exactly A/B/C/D.`,
				};
			}
			const lengths = expectedKeys.map(
				(k) => (firstWith.options ?? {})[k]?.length ?? 0,
			);
			const minLen = Math.min(...lengths);
			const maxLen = Math.max(...lengths);
			const delta = maxLen - minLen;
			const allowed = assertion.maxLengthDelta ?? 60;
			const pass = delta <= allowed;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `MCQ options length range = ${delta} chars (min=${minLen}, max=${maxLen}); allowed ≤ ${allowed}. The longest option is the answer-tell distractors warn against.`,
			};
		}
		case "outputMentions": {
			const allQuestions = flattenAllQuestions(output);
			const blob = allQuestions
				.map(
					(q) =>
						`${q.question_text ?? ""}\n${q.answer_key?.explanation ?? ""}\n${(q.answer_key?.common_mistakes ?? []).join("\n")}`,
				)
				.join("\n");
			const target = assertion.keyword;
			const min = assertion.minOccurrences ?? 1;
			const occurrences = (blob.match(new RegExp(escapeRegex(target), "gi")) ?? []).length;
			const pass = occurrences >= min;
			return {
				pass,
				assertion,
				reason: pass
					? undefined
					: `Expected at least ${min} occurrence(s) of "${target}" across question_text/explanation/common_mistakes — got ${occurrences}.`,
			};
		}
	}
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Aggregate fixture evaluator (Tier 1 only — Tier 2 lives in __evals__/runner.ts)
// ---------------------------------------------------------------------------

export type FixtureRunResult = {
	fixtureId: string;
	subject: string;
	prompt: string;
	promptResults: PromptAssertionResult[];
	pass: boolean;
};

export function runFixturePromptAssertions(
	fixture: PracticeFixture,
	prompt: string,
): FixtureRunResult {
	const promptResults = fixture.promptAssertions.map((a) =>
		evaluatePromptAssertion(prompt, a),
	);
	const pass = promptResults.every((r) => r.pass);
	return {
		fixtureId: fixture.id,
		subject: fixture.subject,
		prompt,
		promptResults,
		pass,
	};
}
