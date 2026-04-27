"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

/**
 * Runs `sync_student_performance_tracker` for the signed-in student (RLS + RPC grants).
 * Does not accept a user id from the client.
 */
export async function syncPerformanceTrackerFromSession(): Promise<
	{ ok: true } | { ok: false; message: string }
> {
	const user = await getServerUser();
	if (!user) {
		return { ok: false, message: "Not signed in." };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("sync_student_performance_tracker", {
		p_reset_curriculum: false,
	});
	if (error) {
		logSupabaseError("syncPerformanceTrackerFromSession.rpc", error, { userId: user.id });
		return { ok: false, message: "We couldn't refresh your performance tracker right now. Try again." };
	}
	return { ok: true };
}
