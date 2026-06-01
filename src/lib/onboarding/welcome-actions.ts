"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Durably record that the signed-in user dismissed the first-run welcome, so it
 * doesn't re-appear on another device/browser. Idempotent (only stamps the first
 * time via `.is(... null)`), scoped to the caller's own row by RLS, and never
 * accepts a user id from the client. Best-effort: callers fire-and-forget and the
 * UI closes optimistically off localStorage, so a failure here (e.g. the column
 * isn't migrated yet) degrades to the previous per-device behavior.
 */
export async function markWelcomeSeen(): Promise<{ ok: boolean }> {
	const user = await getServerUser();
	if (!user) return { ok: false };

	const supabase = await createClient();
	const { error } = await supabase
		.from("profiles")
		.update({ onboarding_welcome_seen_at: new Date().toISOString() })
		.eq("id", user.id)
		.is("onboarding_welcome_seen_at", null);

	if (error) {
		logSupabaseError("markWelcomeSeen.update", error, { userId: user.id });
		return { ok: false };
	}
	return { ok: true };
}
