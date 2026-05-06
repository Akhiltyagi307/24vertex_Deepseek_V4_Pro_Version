import { notifyTestReportPdfReadyEmails, notifyTestReportReady } from "@/lib/notifications/report-ready";
import {
	gradePracticeTestWithAi,
	recordGradingFailure,
	renderAndUploadPracticeReportPdf,
} from "@/lib/practice/ai-grade-practice-test";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { pLimit } from "@/lib/practice/ai-retry";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logPracticeObs } from "@/lib/server/practice-observability";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Per-job wall-clock cap. The function-level maxDuration is 300s; without a
 * per-job cap, one stuck AI grading call can starve the rest of the batch by
 * eating the whole budget. 90s is generous (typical grade chunk is 10-25s)
 * but fast enough that the worker can move on and reschedule the stuck job.
 */
const PER_JOB_TIMEOUT_MS = 90_000;

class JobTimeoutError extends Error {
	constructor(jobType: string, ms: number) {
		super(`Job ${jobType} exceeded ${ms}ms timeout`);
		this.name = "JobTimeoutError";
	}
}

function withTimeout<T>(promise: Promise<T>, ms: number, jobType: string): Promise<T> {
	let t: ReturnType<typeof setTimeout>;
	const timeoutPromise = new Promise<never>((_, reject) => {
		t = setTimeout(() => reject(new JobTimeoutError(jobType, ms)), ms);
	});
	return Promise.race([
		promise.finally(() => clearTimeout(t)),
		timeoutPromise,
	]);
}

type ClaimedJob = {
	id: string;
	job_type: "grade" | "pdf" | "auto_submit" | "email" | "tracker_update";
	test_id: string;
	student_id: string;
	attempts: number;
	max_attempts: number;
	payload: Record<string, unknown>;
};

function backoffMinutes(attempts: number): number {
	// 1 min, 2, 4, 8, ...; capped at 30 min.
	return Math.min(30, Math.max(1, 2 ** (attempts - 1)));
}

async function markJobDone(jobId: string) {
	const admin = createServiceRoleClient();
	const { error } = await admin
		.from("practice_jobs")
		.update({ status: "done", error: null, updated_at: new Date().toISOString() })
		.eq("id", jobId);
	if (error) {
		throw new Error(error.message ?? "Could not mark practice job as done.");
	}
}

async function markJobFailure(job: ClaimedJob, message: string) {
	const admin = createServiceRoleClient();
	const isDead = job.attempts >= job.max_attempts;
	const next = new Date(Date.now() + backoffMinutes(job.attempts) * 60_000);
	const { error } = await admin
		.from("practice_jobs")
		.update({
			status: isDead ? "dead" : "pending",
			error: message.slice(0, 2000),
			run_after: isDead ? new Date().toISOString() : next.toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", job.id);
	if (error) {
		throw new Error(error.message ?? "Could not reschedule the practice job.");
	}
}

async function handleGradeJob(job: ClaimedJob): Promise<{ ok: true } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();

	const { data: testRow, error: testErr } = await admin
		.from("tests")
		.select("id, student_id, subject_id, duration_seconds, time_limit_seconds, status")
		.eq("id", job.test_id)
		.maybeSingle();
	if (testErr || !testRow) {
		return { ok: false, message: "Test not found." };
	}
	if (testRow.status === "graded") {
		return { ok: true };
	}
	// Accept both 'grading' (new Phase 2 path) and 'in_progress' (auto_submit handoff
	// not yet flipped) — the grading function doesn't depend on status.

	const elapsed =
		typeof testRow.duration_seconds === "number" && testRow.duration_seconds > 0
			? testRow.duration_seconds
			: typeof testRow.time_limit_seconds === "number"
				? testRow.time_limit_seconds
				: 0;

	const result = await gradePracticeTestWithAi(job.student_id, job.test_id, elapsed, { jobId: job.id });
	if (!result.ok) {
		logServerError("handleGradeJob.gradePracticeTestWithAi", new Error(result.message), {
			testId: job.test_id,
			jobId: job.id,
		});
		await admin
			.from("tests")
			.update({ status: "grading_failed", updated_at: new Date().toISOString() })
			.eq("id", job.test_id);
		await recordGradingFailure(admin, job.student_id, job.test_id, result.message);
		void recordPracticeEvent(
			admin,
			"practice_grading_failed",
			{ test_id: job.test_id, message: result.message },
			{ studentId: job.student_id },
		);
		return { ok: false, message: result.message };
	}

	void recordPracticeEvent(
		admin,
		"practice_graded",
		{ test_id: job.test_id },
		{ studentId: job.student_id },
	);

	// Queue the PDF render as a follow-up job so grading isn't blocked by it.
	const { error: enqueueError } = await admin.rpc("practice_enqueue_job", {
		p_job_type: "pdf",
		p_test_id: job.test_id,
		p_payload: {},
		p_run_after: new Date().toISOString(),
	});
	if (enqueueError) {
		logSupabaseError("handleGradeJob.practice_enqueue_job", enqueueError, {
			testId: job.test_id,
			jobType: "pdf",
		});
		const pdfResult = await renderAndUploadPracticeReportPdf(job.test_id);
		if (!pdfResult.ok) {
			logServerError("handleGradeJob.renderAndUploadPracticeReportPdf", new Error(pdfResult.message), {
				testId: job.test_id,
			});
			// Test is already `graded` at this point; do not mark the grade job failed so a stuck row
			// will not block the queue or confuse diagnostics.
		} else {
			// Inline fallback after PDF enqueue failure. Mirror handleEmailJob:
			// fire the in-app bell first (idempotent), then attempt emails.
			try {
				await notifyTestReportReady({
					studentId: pdfResult.studentId,
					testId: job.test_id,
					subjectName: pdfResult.subjectName,
					overallPercent: pdfResult.overallPercent,
				});
			} catch (err) {
				logServerError("handleGradeJob.fallback_in_app_notify", err, {
					testId: job.test_id,
					jobId: job.id,
				});
			}
			void notifyTestReportPdfReadyEmails({
				testId: job.test_id,
				studentId: pdfResult.studentId,
				subjectName: pdfResult.subjectName,
				overallPercent: pdfResult.overallPercent,
				storagePath: pdfResult.storagePath,
			});
		}
	}

	return { ok: true };
}

async function handleTrackerUpdateJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();
	const payload = job.payload as {
		student_id?: string;
		subject_id?: string;
		now?: string;
		items?: Array<{ topic_id: string; average_score: number; n_incorrect: number }>;
	};
	if (
		!payload?.student_id ||
		!payload?.subject_id ||
		!payload?.now ||
		!Array.isArray(payload.items) ||
		payload.items.length === 0
	) {
		return { ok: false, message: "Tracker update payload missing required fields." };
	}
	const { error } = await admin.rpc("practice_update_trackers_bulk", {
		p_student_id: payload.student_id,
		p_subject_id: payload.subject_id,
		p_current_test_id: job.test_id,
		p_now: payload.now,
		p_items: payload.items,
	});
	if (error) {
		logSupabaseError("handleTrackerUpdateJob.practice_update_trackers_bulk", error, {
			testId: job.test_id,
			jobId: job.id,
		});
		return { ok: false, message: error.message ?? "Tracker update failed." };
	}
	return { ok: true };
}

async function handlePdfJob(job: ClaimedJob): Promise<{ ok: true } | { ok: false; message: string }> {
	const result = await renderAndUploadPracticeReportPdf(job.test_id);
	if (!result.ok) {
		return { ok: false, message: result.message };
	}
	// Enqueue an email job rather than sending inline. This routes email
	// retries through the same backoff / dead-letter machinery as grade
	// and pdf jobs, instead of fire-and-forget without retry.
	const admin = createServiceRoleClient();
	const { error: enqueueError } = await admin.rpc("practice_enqueue_job", {
		p_job_type: "email",
		p_test_id: job.test_id,
		p_payload: {
			student_id: result.studentId,
			subject_name: result.subjectName,
			overall_percent: result.overallPercent,
			storage_path: result.storagePath,
		},
		p_run_after: new Date().toISOString(),
	});
	if (enqueueError) {
		logSupabaseError("handlePdfJob.email_enqueue", enqueueError, {
			testId: job.test_id,
		});
		// Inline fallback so an enqueue glitch doesn't silently drop emails OR
		// the in-app bell. Same in-app-then-email order as handleEmailJob.
		try {
			await notifyTestReportReady({
				studentId: result.studentId,
				testId: job.test_id,
				subjectName: result.subjectName,
				overallPercent: result.overallPercent,
			});
		} catch (err) {
			logServerError("handlePdfJob.fallback_in_app_notify", err, {
				testId: job.test_id,
				jobId: job.id,
			});
		}
		const inline = await notifyTestReportPdfReadyEmails({
			testId: job.test_id,
			studentId: result.studentId,
			subjectName: result.subjectName,
			overallPercent: result.overallPercent,
			storagePath: result.storagePath,
		});
		if (!inline.ok) {
			logServerError(
				"handlePdfJob.inline_email_fallback_failed",
				new Error(inline.reason),
				{ testId: job.test_id },
			);
		}
	}
	return { ok: true };
}

async function handleEmailJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const payload = job.payload as {
		student_id?: string;
		subject_name?: string;
		overall_percent?: number | null;
		storage_path?: string;
	};
	if (!payload?.student_id || !payload?.subject_name || typeof payload?.storage_path !== "string") {
		// Permanently malformed — mark as failure but don't retry forever.
		return { ok: false, message: "Email job payload missing required fields." };
	}

	// In-app "report ready" goes out FIRST so the bell lights up even if the
	// email half hits a transient SMTP failure and re-queues. Both calls are
	// idempotent (per-recipient dedup row in `notifications`), so retries
	// don't produce duplicate cards.
	try {
		await notifyTestReportReady({
			studentId: payload.student_id,
			testId: job.test_id,
			subjectName: payload.subject_name,
			overallPercent: payload.overall_percent ?? null,
		});
	} catch (err) {
		logServerError("handleEmailJob.in_app_notify", err, {
			testId: job.test_id,
			jobId: job.id,
		});
	}

	const result = await notifyTestReportPdfReadyEmails({
		testId: job.test_id,
		studentId: payload.student_id,
		subjectName: payload.subject_name,
		overallPercent: payload.overall_percent ?? null,
		storagePath: payload.storage_path,
	});
	if (result.ok) return { ok: true };
	if (result.permanentlyFailed) {
		// Don't retry permanent failures. Bump attempts to max so it falls
		// to dead on the next markJobFailure.
		logServerError(
			"handleEmailJob.permanent_failure",
			new Error(result.reason),
			{ testId: job.test_id, jobId: job.id },
		);
		return { ok: false, message: `permanent: ${result.reason}` };
	}
	return { ok: false, message: result.reason };
}

async function runPracticeJobs(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const limit = Math.max(1, Math.min(20, Number.parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));
	const workerId = `vercel-${process.env.VERCEL_REGION ?? "local"}-${crypto.randomUUID().slice(0, 8)}`;
	const workerStarted = Date.now();

	const admin = createServiceRoleClient();

	// `practice_claim_jobs` only picks `pending`. Workloads that die mid-run leave rows stuck in
	// `running` forever; reclaim them so grading can complete after deploys or timeouts.
	const { data: reclaimed, error: reclaimErr } = await admin.rpc("practice_reclaim_stale_running_jobs");
	if (reclaimErr) {
		logSupabaseError("runPracticeJobs.practice_reclaim_stale_running_jobs", reclaimErr, { workerId });
	} else if (typeof reclaimed === "number" && reclaimed > 0) {
		logPracticeObs({
			phase: "practice_jobs_reclaim",
			workerId,
			reclaimed,
		});
	}

	const { data: jobs, error } = await admin.rpc("practice_claim_jobs", {
		p_worker_id: workerId,
		p_job_types: ["grade", "pdf", "email", "tracker_update"],
		p_limit: limit,
	});

	if (error) {
		logSupabaseError("runPracticeJobs.practice_claim_jobs", error, { workerId });
		return Response.json({ ok: false, message: "Could not claim jobs." }, { status: 500 });
	}

	const claimed = (jobs ?? []) as ClaimedJob[];
	const jobWorkerConcurrency = 2;

	const processOne = async (job: ClaimedJob) => {
		try {
			const handlerPromise =
				job.job_type === "grade" ? handleGradeJob(job)
				: job.job_type === "pdf" ? handlePdfJob(job)
				: job.job_type === "email" ? handleEmailJob(job)
				: job.job_type === "tracker_update" ? handleTrackerUpdateJob(job)
				: Promise.resolve({ ok: false as const, message: `Unsupported job_type ${job.job_type}` });

			// Per-job timeout: a stuck AI call cannot block the whole worker
			// invocation. Timed-out jobs land in markJobFailure and get retried
			// with the existing exponential backoff.
			const out = await withTimeout(handlerPromise, PER_JOB_TIMEOUT_MS, job.job_type);

			if (out.ok) {
				await markJobDone(job.id);
				return { id: job.id, ok: true as const, type: job.job_type };
			}
			await markJobFailure(job, out.message);
			return { id: job.id, ok: false as const, type: job.job_type, message: out.message };
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Unknown worker error";
			try {
				await markJobFailure(job, msg);
			} catch (markError) {
				logServerError("runPracticeJobs.markJobFailure", markError, {
					jobId: job.id,
					jobType: job.job_type,
				});
			}
			return { id: job.id, ok: false as const, type: job.job_type, message: msg };
		}
	};

	const results = await pLimit(
		jobWorkerConcurrency,
		claimed.map((job) => () => processOne(job)),
	);

	const nOk = results.filter((r) => r.ok).length;
	logPracticeObs({
		phase: "practice_jobs_worker",
		workerId,
		claimed: claimed.length,
		processed: results.length,
		succeeded: nOk,
		failed: results.length - nOk,
		durationMs: Date.now() - workerStarted,
	});

	return Response.json({ ok: true, processed: results.length, results });
}

/**
 * Background worker. Triggered by Supabase pg_cron + pg_net (GET/POST) and by a
 * fire-and-forget fetch (POST) from the submit action for low-latency startup.
 */
export async function POST(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runPracticeJobs(request);
}

export async function GET(request: Request) {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;
	return runPracticeJobs(request);
}
