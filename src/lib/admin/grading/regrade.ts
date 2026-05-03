import "server-only";

import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";

const REGRADABLE = new Set(["graded", "grading_failed", "grading"]);

/**
 * Re-enqueues AI grading for a test (admin). Mirrors student `retryPracticeGrading` but service-role.
 */
export async function adminRegradeTest(testId: string): Promise<{ ok: true } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();

	const { data: test, error: tErr } = await admin
		.from("tests")
		.select("id, student_id, status")
		.eq("id", testId)
		.maybeSingle();

	if (tErr || !test) {
		return { ok: false, message: "Test not found." };
	}
	if (!REGRADABLE.has(test.status as string)) {
		return { ok: false, message: "Test must be graded or in a grading failure state to regrade." };
	}

	const { error: flipErr } = await admin
		.from("tests")
		.update({ status: "grading", updated_at: new Date().toISOString() })
		.eq("id", testId);
	if (flipErr) {
		logSupabaseError("adminRegradeTest.tests.update", flipErr, { testId });
		return { ok: false, message: "Could not update test status." };
	}

	const { error: enqErr } = await admin.rpc("practice_enqueue_job", {
		p_job_type: "grade",
		p_test_id: testId,
		p_payload: { admin_regrade: true },
		p_run_after: new Date().toISOString(),
	});
	if (enqErr) {
		logSupabaseError("adminRegradeTest.practice_enqueue_job", enqErr, { testId });
		await admin
			.from("tests")
			.update({ status: test.status as string, updated_at: new Date().toISOString() })
			.eq("id", testId);
		return { ok: false, message: "Could not enqueue grading job." };
	}

	const w = await triggerPracticeWorkerInBackground();
	if (!w.ok) {
		logSupabaseError("adminRegradeTest.triggerWorker", new Error(w.message), { testId });
	}
	return { ok: true };
}
