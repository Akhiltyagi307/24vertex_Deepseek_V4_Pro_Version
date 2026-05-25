"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { logPracticeObs, newPracticeCorrelationId } from "@/lib/server/practice-observability";
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

	const correlationId = newPracticeCorrelationId();
	const started = Date.now();
	const supabase = await createClient();
	const { error } = await supabase.rpc("sync_student_performance_tracker", {
		p_reset_curriculum: false,
	});
	if (error) {
		logSupabaseError("syncPerformanceTrackerFromSession.rpc", error, {
			userId: user.id,
			correlationId,
		});
		logPracticeObs({
			phase: "sync_performance_tracker",
			correlationId,
			studentId: user.id,
			ok: false,
			durationMs: Date.now() - started,
		});
		return { ok: false, message: "We couldn't refresh your performance tracker right now. Try again." };
	}
	logPracticeObs({
		phase: "sync_performance_tracker",
		correlationId,
		studentId: user.id,
		ok: true,
		durationMs: Date.now() - started,
	});
	const { revalidateStudentDashboard } = await import("@/lib/student/revalidate-student-dashboard");
	revalidateStudentDashboard(user.id);
	return { ok: true };
}
