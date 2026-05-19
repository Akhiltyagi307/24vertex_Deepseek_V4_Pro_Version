"use server";

import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { withPracticeSpan } from "@/lib/practice/sentry-tags";
import { assertTestOwnedInProgress } from "@/lib/practice/submit-practice-shared";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

const abandonSchema = z.object({ testId: z.string().uuid() }).strict();

/**
 * Used by the wizard's "Regenerate" button to drop an unsubmitted
 * test before creating a fresh one.
 *
 * D9: the RPC `practice_abandon_test` enforces ownership server-side, but we
 * also assert it in the TS layer so a forged `testId` returns a 4xx-equivalent
 * message instead of relying solely on the RPC's silent no-op.
 *
 * D28: wrapped in `withPracticeSpan` so Sentry traces show this branch
 * alongside the generation pipeline.
 */
export async function abandonPracticeTest(
	input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
	return withPracticeSpan("abandonPracticeTest", {}, async () => {
		const parsed = abandonSchema.safeParse(input);
		if (!parsed.success) return { ok: false, message: "Invalid payload." };

		const user = await getServerUser();
		if (!user) return { ok: false, message: "Not signed in." };

		const supabase = await createClient();

		const gate = await assertTestOwnedInProgress(supabase, parsed.data.testId, user.id);
		if (!gate.ok) {
			return { ok: false, message: gate.message };
		}

		const { error } = await supabase.rpc("practice_abandon_test", {
			p_test_id: parsed.data.testId,
		});
		if (error) {
			logSupabaseError("abandonPracticeTest.practice_abandon_test", error);
			return { ok: false, message: "Could not abandon the test." };
		}
		return { ok: true };
	});
}
