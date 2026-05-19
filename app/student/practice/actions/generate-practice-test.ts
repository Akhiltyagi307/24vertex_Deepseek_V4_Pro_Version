"use server";

import {
	preflightPracticeGeneration,
	runPracticeGenerationAfterResolve,
} from "@/lib/practice/practice-generation-pipeline";
import { withPracticeSpan } from "@/lib/practice/sentry-tags";
import { finalizePracticeConfigSchema } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";

import type { GeneratePracticeResult } from "./types";

/**
 * Verifies selections again, generates a practice test via OpenAI, returns questions without answer keys.
 *
 * D28: wrapped in `withPracticeSpan` so the action shows up in Sentry traces as
 * a parent span over the pipeline call. The pipeline itself adds child spans.
 */
export async function generatePracticeTest(input: unknown): Promise<GeneratePracticeResult> {
	return withPracticeSpan("generatePracticeTest", {}, async () => {
		const parsed = finalizePracticeConfigSchema.safeParse(input);
		if (!parsed.success) {
			const flat = parsed.error.flatten();
			return {
				ok: false,
				code: "validation_error",
				message: "Check your selections and try again.",
				fieldErrors: flat.fieldErrors as Record<string, string[]>,
			};
		}

		const supabase = await createClient();

		const gate = await preflightPracticeGeneration(supabase, parsed.data);
		if (!gate.ok) {
			return gate.result;
		}

		return runPracticeGenerationAfterResolve(supabase, parsed.data, gate.resolved, {
			useStreamObject: false,
		});
	});
}
