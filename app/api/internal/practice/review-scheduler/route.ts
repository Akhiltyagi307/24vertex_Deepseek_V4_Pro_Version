import { getEntitlements } from "@/lib/billing/entitlements";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { decideReviewEnqueue } from "@/lib/practice/review-selection";
import { logServerError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type DueTrackerRow = {
	id: string;
	student_id: string;
	subject_id: string;
	topic_id: string;
};

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const admin = createServiceRoleClient();

	// Kill-switch (mirrors streak_freeze_enabled()).
	const { data: enabled } = await admin.rpc("review_scheduler_enabled");
	if (enabled === false) {
		return Response.json({ ok: true, enqueued: 0, skipped: "disabled" });
	}

	// Due topics. Graduated topics have next_review_at = NULL, so this is exactly
	// the still-being-remediated set; the partial index keeps it cheap.
	const nowIso = new Date().toISOString();
	const { data: dueRows, error: dueErr } = await admin
		.from("performance_tracker")
		.select("id, student_id, subject_id, topic_id")
		.not("next_review_at", "is", null)
		.lte("next_review_at", nowIso)
		.order("next_review_at", { ascending: true })
		.limit(500);
	if (dueErr) {
		logServerError("review-scheduler.due_query", new Error(dueErr.message), {});
		return Response.json({ ok: false, message: "due query failed" }, { status: 500 });
	}
	const due = (dueRows ?? []) as DueTrackerRow[];

	// One review per student per run → with the unique active-job index this
	// enforces ≤1 review/day per student.
	const seenStudents = new Set<string>();
	const startOfDay = new Date();
	startOfDay.setUTCHours(0, 0, 0, 0);
	const startOfDayIso = startOfDay.toISOString();
	let enqueued = 0;

	for (const row of due) {
		if (seenStudents.has(row.student_id)) continue;
		seenStudents.add(row.student_id);
		try {
			const ent = await getEntitlements(admin, row.student_id);
			if (!ent) continue;

			const { count: reviewThisPeriod } = await admin
				.from("tests")
				.select("id", { count: "exact", head: true })
				.eq("student_id", row.student_id)
				.eq("test_type", "review")
				.gte("test_date", ent.currentPeriodStart)
				.lt("test_date", ent.currentPeriodEnd);

			const { count: reviewToday } = await admin
				.from("tests")
				.select("id", { count: "exact", head: true })
				.eq("student_id", row.student_id)
				.eq("test_type", "review")
				.gte("test_date", startOfDayIso);

			const decision = decideReviewEnqueue({
				testsLeft: ent.testsLeft,
				reviewTestsThisPeriod: reviewThisPeriod ?? 0,
				hasReviewActivityToday: (reviewToday ?? 0) > 0,
			});
			if (!decision.enqueue) continue;

			// Unique partial index (student_id, payload->>'topic_id') WHERE pending/running
			// dedupes; a duplicate insert errors and is skipped.
			const { error: insErr } = await admin.from("practice_jobs").insert({
				job_type: "review_generate",
				student_id: row.student_id,
				status: "pending",
				run_after: nowIso,
				payload: { subject_id: row.subject_id, topic_id: row.topic_id, tracker_id: row.id },
			});
			if (!insErr) enqueued += 1;
		} catch (e) {
			logServerError("review-scheduler.student_failed", e as Error, { studentId: row.student_id });
		}
	}

	return Response.json({ ok: true, enqueued });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
