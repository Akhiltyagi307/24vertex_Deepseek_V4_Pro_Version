/**
 * Tier 1 fixture runner — runs structural prompt assertions for every
 * fixture. CI-friendly: no LLM calls, fully deterministic.
 *
 * Catches:
 *   - Routing drift (fixture's `generationSubject` no longer reaches the
 *     compact builder it expects)
 *   - Worked-example removal (someone strips an exemplar without realising
 *     it's load-bearing)
 *   - Count-interpolation breakage (per-bucket counts no longer interpolated
 *     from `userMessageSummary`)
 *   - Persona-drift (subject-specific load-bearing rule disappears from
 *     prompt)
 *
 * Tier 2 (behavioural assertions on LLM output) lives in
 * `src/lib/practice/__evals__/runner.ts` and is opt-in.
 */

import { describe, expect, it } from "vitest";

import { runFixturePromptAssertions } from "../__fixtures__/assertions";
import { FIXTURES } from "../__fixtures__/index";
import { buildPracticeSystemPrompt } from "../system-prompt";

describe("Tier 1 fixture runner — prompt assertions", () => {
	it.each(FIXTURES.map((f) => [f.id, f] as const))(
		"%s",
		(_id, fixture) => {
			const prompt = buildPracticeSystemPrompt({
				userMessageSummary: fixture.input.userMessageSummary,
				generationSubject: fixture.input.generationSubject,
			});

			const result = runFixturePromptAssertions(fixture, prompt);

			if (!result.pass) {
				const failures = result.promptResults
					.filter((r) => !r.pass)
					.map((r) => `  - ${r.reason}`)
					.join("\n");
				expect.fail(
					`Fixture "${fixture.id}" failed ${result.promptResults.filter((r) => !r.pass).length}/${result.promptResults.length} prompt assertions:\n${failures}`,
				);
			}

			expect(result.pass).toBe(true);
		},
	);

	it("covers every migrated subject (sanity check — at least one fixture per subject)", () => {
		const subjectsCovered = new Set<string>(FIXTURES.map((f) => f.subject));
		const expected: string[] = [
			"math-6-10",
			"math-11-12",
			"science-6-10",
			"social-science-6-10",
			"english-6-10",
			"english-11-12",
			"physics-11-12",
			"chemistry-11-12",
			"biology-11-12",
			"accountancy-11-12",
			"business-studies-11-12",
			"economics-11-12",
		];
		const missing = expected.filter((s) => !subjectsCovered.has(s));
		expect(
			missing,
			`Subjects missing fixture coverage: ${missing.join(", ")}. Every migrated compact builder should have at least one fixture in src/lib/practice/__fixtures__/index.ts.`,
		).toEqual([]);
	});

	it("every fixture id is unique", () => {
		const ids = FIXTURES.map((f) => f.id);
		const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
		expect(dupes, `Duplicate fixture ids: ${dupes.join(", ")}`).toEqual([]);
	});

	it("every fixture has at least one prompt assertion AND at least one output assertion", () => {
		const offenders = FIXTURES.filter(
			(f) =>
				f.promptAssertions.length === 0 || f.outputAssertions.length === 0,
		);
		expect(
			offenders.map((f) => f.id),
			"Each fixture should declare at least one prompt assertion (Tier 1) and one output assertion (Tier 2).",
		).toEqual([]);
	});
});
