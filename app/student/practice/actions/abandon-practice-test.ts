"use server";

import { z } from "zod";

import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

const abandonSchema = z.object({ testId: z.string().uuid() });

/**
 * Used by the wizard's "Regenerate" button to drop an unsubmitted
 * test before creating a fresh one.
 */
export async function abandonPracticeTest(
	input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const parsed = abandonSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: "Invalid payload." };

	const supabase = await createClient();
	const { error } = await supabase.rpc("practice_abandon_test", { p_test_id: parsed.data.testId });
	if (error) {
		logSupabaseError("abandonPracticeTest.practice_abandon_test", error);
		return { ok: false, message: "Could not abandon the test." };
	}
	return { ok: true };
}
