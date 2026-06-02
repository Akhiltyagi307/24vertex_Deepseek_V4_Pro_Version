import { notifyTestReportPdfReadyEmails, notifyTestReportReady } from "@/lib/notifications/report-ready";
import { notifyAssignmentGraded } from "@/lib/notifications/assignment-events";
import { materializeAssignedPracticeTest } from "@/lib/admin/assignment-generation";
import { materializeReviewPracticeTest } from "@/lib/practice/review-generation";
import { materializeStudentGeneratedTest } from "@/lib/practice/student-generation";
import { safeParseGenerationInput } from "@/lib/practice/practice-generation-pipeline";
import {
	gradePracticeTestWithAi,
	recordGradingFailure,
	renderAndUploadPracticeReportPdf,
} from "@/lib/practice/ai-grade-practice-test";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { pLimit } from "@/lib/practice/ai-retry";
import {
	PRACTICE_JOB_WORKER_DEFAULT_BATCH_LIMIT,
	PRACTICE_JOB_WORKER_MAX_BATCH_LIMIT,
} from "@/lib/practice/practice-worker-constants";
import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { logPracticeObs } from "@/lib/server/practice-observability";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient, type ServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Per-job wall-clock caps by type. Grade/PDF can legitimately exceed a tight
 * budget on large tests; PDF renders especially benefit from headroom. Jobs
 * that exceed these limits are retried via existing backoff + reclaim.
 */
function perJobTimeoutMs(jobType: ClaimedJob["job_type"]): number {
	switch (jobType) {
		case "grade":
			return 120_000;
		case "pdf":
			return 165_000;
		case "email":
			return 75_000;
		case "tracker_update":
			return 90_000;
		case "assign_generate_test":
			return 180_000;
		case "review_generate":
			return 180_000;
		case "student_generate_test":
			return 180_000;
		default:
			return 90_000;
	}
}

/** Recognizes `in_app_emitted` across JSONB round-trips and legacy rows. */
function practiceEmailPayloadSaysInAppEmitted(payload: Record<string, unknown>): boolean {
	const v = payload.in_app_emitted;
	return v === true || v === "true";
}

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
	job_type: "grade" | "pdf" | "auto_submit" | "email" | "tracker_update" | "assign_generate_test" | "review_generate" | "student_generate_test";
	test_id: string | null;
	student_id: string;
	assignment_submission_id?: string | null;
	attempts: number;
	max_attempts: number;
	payload: Record<string, unknown>;
};

function backoffMinutes(attempts: number): number {
	// 1 min, 2, 4, 8, ...; capped at 30 min.
	return Math.min(30, Math.max(1, 2 ** (attempts - 1)));
}

async function markJobDone(admin: ServiceRoleClient, jobId: string, workerId: string) {
	// Fence on claimed_by: if this job was reclaimed and re-claimed by another
	// worker, claimed_by no longer matches and this update hits 0 rows — so a
	// slow worker that finishes after reclaim cannot overwrite the new owner's
	// result (review finding M1, part 2).
	const { data, error } = await admin
		.from("practice_jobs")
		.update({ status: "done", error: null, updated_at: new Date().toISOString() })
		.eq("id", jobId)
		.eq("claimed_by", workerId)
		.select("id");
	if (error) {
		throw new Error(error.message ?? "Could not mark practice job as done.");
	}
	if (!data || data.length === 0) {
		logPracticeObs({ phase: "practice_job_done_fenced", jobId, workerId });
	}
}

async function markJobFailure(admin: ServiceRoleClient, job: ClaimedJob, message: string, workerId: string) {
	const isDead = job.attempts >= job.max_attempts;
	const next = new Date(Date.now() + backoffMinutes(job.attempts) * 60_000);
	// Fence on claimed_by (see markJobDone): a worker whose job was reclaimed by
	// another worker must not rewrite its status or fire dead-letter side effects.
	const { data, error } = await admin
		.from("practice_jobs")
		.update({
			status: isDead ? "dead" : "pending",
			error: message.slice(0, 2000),
			run_after: isDead ? new Date().toISOString() : next.toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", job.id)
		.eq("claimed_by", workerId)
		.select("id");
	if (error) {
		throw new Error(error.message ?? "Could not reschedule the practice job.");
	}
	if (!data || data.length === 0) {
		logPracticeObs({ phase: "practice_job_failure_fenced", jobId: job.id, workerId });
		return;
	}
	if (isDead && job.job_type === "assign_generate_test") {
		const submissionId =
			job.assignment_submission_id ??
			(typeof job.payload?.assignment_submission_id === "string" ? job.payload.assignment_submission_id : null);
		if (submissionId) {
			const { error: submissionError } = await admin
				.from("assignment_submissions")
				.update({
					lifecycle_status: "failed_generation",
					error: message.slice(0, 2000),
					updated_at: new Date().toISOString(),
				})
				.eq("id", submissionId)
				.in("lifecycle_status", ["pending_materialize", "failed_generation"]);
			if (submissionError) {
				logSupabaseError("markJobFailure.assignment_generation_dead", submissionError, {
					jobId: job.id,
					assignmentSubmissionId: submissionId,
				});
			}
		}
	}
}

async function handleGradeJob(job: ClaimedJob): Promise<{ ok: true } | { ok: false; message: string }> {
	if (!job.test_id) {
		return { ok: false, message: "Grade job missing test_id." };
	}
	const admin = createServiceRoleClient();

	const { data: testRow, error: testErr } = await admin
		.from("tests")
		.select("id, student_id, subject_id, duration_seconds, time_limit_seconds, status, assignment_submission_id")
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
		if (typeof testRow.assignment_submission_id === "string" && testRow.assignment_submission_id) {
			const { error: submissionErr } = await admin
				.from("assignment_submissions")
				.update({
					lifecycle_status: "grading_failed",
					error: result.message.slice(0, 2000),
					updated_at: new Date().toISOString(),
				})
				.eq("id", testRow.assignment_submission_id);
			if (submissionErr) {
				logSupabaseError("handleGradeJob.assignment_submission_grading_failed", submissionErr, {
					testId: job.test_id,
					assignmentSubmissionId: testRow.assignment_submission_id,
				});
			}
		}
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

	if (typeof testRow.assignment_submission_id === "string" && testRow.assignment_submission_id) {
		const { data: gradedTest, error: gradedTestErr } = await admin
			.from("tests")
			.select("total_score")
			.eq("id", job.test_id)
			.maybeSingle();
		if (gradedTestErr) {
			logSupabaseError("handleGradeJob.tests.score_read", gradedTestErr, {
				testId: job.test_id,
			});
		}
		const { error: submissionUpdateErr } = await admin
			.from("assignment_submissions")
			.update({
				lifecycle_status: "graded",
				graded_at: new Date().toISOString(),
				score: gradedTest?.total_score ?? null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", testRow.assignment_submission_id);
		if (submissionUpdateErr) {
			logSupabaseError("handleGradeJob.assignment_submissions.update", submissionUpdateErr, {
				testId: job.test_id,
				assignmentSubmissionId: testRow.assignment_submission_id,
			});
		}
		const { data: assignmentRow, error: assignmentRowErr } = await admin
			.from("assignment_submissions")
			.select("assignment_id, assignments(title)")
			.eq("id", testRow.assignment_submission_id)
			.maybeSingle();
		if (assignmentRowErr) {
			logSupabaseError("handleGradeJob.assignment_submissions.assignment_read", assignmentRowErr, {
				testId: job.test_id,
				assignmentSubmissionId: testRow.assignment_submission_id,
			});
		} else {
			await notifyAssignmentGraded({
				assignmentId: (assignmentRow?.assignment_id as string | undefined) ?? "",
				submissionId: testRow.assignment_submission_id,
				studentId: job.student_id,
				title:
					typeof assignmentRow?.assignments === "object" &&
					assignmentRow.assignments !== null &&
					"title" in assignmentRow.assignments &&
					typeof assignmentRow.assignments.title === "string" ?
						assignmentRow.assignments.title
					:	"Practice assignment",
				score: gradedTest?.total_score ?? null,
			});
		}
	}

	// Queue the PDF render as a follow-up job so grading isn't blocked by it.
	const { error: enqueueError } = await admin.rpc("practice_enqueue_job", {
		p_job_type: "pdf",
		p_test_id: job.test_id,
		p_payload: {},
		p_run_after: new Date().toISOString(),
	});
	if (!enqueueError) {
		// Grading finished mid-invocation; PDF was not in the batch we claimed.
		// Wake another worker pass so PDF/email do not depend solely on pg_cron
		// (cron often targets prod while dev DB queues never drain locally).
		void triggerPracticeWorkerInBackground()
			.then((r) => {
				if (!r.ok) {
					logServerError("handleGradeJob.triggerPracticeWorkerInBackground", r.message, {
						testId: job.test_id,
					});
				}
			})
			.catch((err) => {
				logServerError("handleGradeJob.triggerPracticeWorkerInBackground", err, {
					testId: job.test_id,
				});
			});
	}
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
					submittedAtIso: pdfResult.submittedAtIso,
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
	if (!job.test_id) {
		return { ok: false, message: "Tracker update job missing test_id." };
	}
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
	if (!job.test_id) {
		return { ok: false, message: "PDF job missing test_id." };
	}
	const result = await renderAndUploadPracticeReportPdf(job.test_id);
	if (!result.ok) {
		return { ok: false, message: result.message };
	}
	// In-app "report ready" is emitted as soon as the PDF exists so bell timing
	// is independent of email queue lag or provider retries.
	try {
		await notifyTestReportReady({
			studentId: result.studentId,
			testId: job.test_id,
			subjectName: result.subjectName,
			overallPercent: result.overallPercent,
			submittedAtIso: result.submittedAtIso,
		});
	} catch (err) {
		logServerError("handlePdfJob.in_app_notify", err, {
			testId: job.test_id,
			jobId: job.id,
		});
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
			in_app_emitted: true,
		},
		p_run_after: new Date().toISOString(),
	});
	if (enqueueError) {
		logSupabaseError("handlePdfJob.email_enqueue", enqueueError, {
			testId: job.test_id,
		});
		// Inline fallback so an enqueue glitch doesn't silently drop emails.
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
	} else {
		void triggerPracticeWorkerInBackground()
			.then((r) => {
				if (!r.ok) {
					logServerError("handlePdfJob.triggerPracticeWorkerInBackground", r.message, {
						testId: job.test_id,
					});
				}
			})
			.catch((err) => {
				logServerError("handlePdfJob.triggerPracticeWorkerInBackground", err, {
					testId: job.test_id,
				});
			});
	}
	return { ok: true };
}

async function handleEmailJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (!job.test_id) {
		return { ok: false, message: "Email job missing test_id." };
	}
	const payload = job.payload as {
		student_id?: string;
		subject_name?: string;
		overall_percent?: number | null;
		storage_path?: string;
		in_app_emitted?: boolean;
	};
	// `practice_enqueue_job` snapshots `student_id` from `tests` — prefer that over JSON
	// payload so a corrupted payload cannot send under the wrong student.
	if (!job.student_id) {
		return { ok: false, message: "Email job missing authoritative student_id." };
	}
	const studentId = job.student_id;
	const payloadStudentId = typeof payload?.student_id === "string" ? payload.student_id.trim() : "";
	if (payloadStudentId && payloadStudentId !== studentId) {
		logServerError("handleEmailJob.payload_student_mismatch", new Error("payload student_id ≠ job.student_id"), {
			jobId: job.id,
			testId: job.test_id,
			payloadStudentId,
			jobStudentId: studentId,
		});
	}

	// Email body/PDF facts are resolved from Postgres at send time; payload fields are hints only.
	const payloadSubjectName = typeof payload?.subject_name === "string" ? payload.subject_name.trim() : "";
	const payloadStoragePath = typeof payload?.storage_path === "string" ? payload.storage_path.trim() : "";

	// Email is intentionally decoupled from bell emission (sent in `handlePdfJob`).
	// Backward-compat: legacy queued jobs (pre-deploy) won't have
	// `in_app_emitted=true`, so emit here once to avoid dropping those cards.
	if (!practiceEmailPayloadSaysInAppEmitted(job.payload as Record<string, unknown>)) {
		try {
			await notifyTestReportReady({
				studentId,
				testId: job.test_id,
				subjectName: payloadSubjectName || "Subject",
				overallPercent: payload?.overall_percent ?? null,
			});
		} catch (err) {
			logServerError("handleEmailJob.legacy_in_app_notify", err, {
				testId: job.test_id,
				jobId: job.id,
			});
		}
	}

	const result = await notifyTestReportPdfReadyEmails({
		testId: job.test_id,
		studentId,
		subjectName: payloadSubjectName || "Subject",
		overallPercent: payload?.overall_percent ?? null,
		storagePath: payloadStoragePath || null,
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

async function handleReviewGenerateJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const studentId = job.student_id;
	const payload = job.payload;
	const subjectId = typeof payload.subject_id === "string" ? payload.subject_id : null;
	const topicId = typeof payload.topic_id === "string" ? payload.topic_id : null;
	const trackerId = typeof payload.tracker_id === "string" ? payload.tracker_id : null;
	if (!studentId || !subjectId || !topicId || !trackerId) {
		return { ok: false, message: "review_generate payload missing student/subject/topic/tracker" };
	}
	const result = await materializeReviewPracticeTest({ studentId, subjectId, topicId, trackerId });
	return result.ok ? { ok: true } : { ok: false, message: result.message };
}

async function handleStudentGenerateJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const payload = job.payload as { client_request_id?: unknown; input?: unknown };
	const clientRequestId = typeof payload?.client_request_id === "string" ? payload.client_request_id : null;
	if (!clientRequestId) {
		return { ok: false, message: "student_generate_test payload missing client_request_id." };
	}
	const parsed = safeParseGenerationInput(payload?.input);
	if (!parsed.success) {
		return { ok: false, message: "student_generate_test payload failed validation." };
	}
	const result = await materializeStudentGeneratedTest({
		studentId: job.student_id,
		clientRequestId,
		input: parsed.data,
	});
	return result.ok ? { ok: true } : { ok: false, message: result.message };
}

async function handleAssignGenerateTestJob(
	job: ClaimedJob,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const submissionId =
		job.assignment_submission_id ??
		(typeof job.payload?.assignment_submission_id === "string" ? job.payload.assignment_submission_id : null);
	if (!submissionId) {
		return { ok: false, message: "Assignment generation job missing assignment_submission_id." };
	}
	const result = await materializeAssignedPracticeTest(submissionId);
	if (!result.ok) return result;
	return { ok: true };
}

async function runPracticeJobs(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const parsedLimit = Number.parseInt(
		url.searchParams.get("limit") ?? String(PRACTICE_JOB_WORKER_DEFAULT_BATCH_LIMIT),
		10,
	);
	const limit = Math.max(
		1,
		Math.min(
			PRACTICE_JOB_WORKER_MAX_BATCH_LIMIT,
			Number.isFinite(parsedLimit) ? parsedLimit : PRACTICE_JOB_WORKER_DEFAULT_BATCH_LIMIT,
		),
	);
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
		p_job_types: ["grade", "pdf", "email", "tracker_update", "assign_generate_test", "review_generate", "student_generate_test"],
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
				: job.job_type === "assign_generate_test" ? handleAssignGenerateTestJob(job)
				: job.job_type === "review_generate" ? handleReviewGenerateJob(job)
				: job.job_type === "student_generate_test" ? handleStudentGenerateJob(job)
				: Promise.resolve({ ok: false as const, message: `Unsupported job_type ${job.job_type}` });

			// Per-job timeout: a stuck AI call cannot block the whole worker
			// invocation. Timed-out jobs land in markJobFailure and get retried
			// with the existing exponential backoff.
			const out = await withTimeout(handlerPromise, perJobTimeoutMs(job.job_type), job.job_type);

			if (out.ok) {
				await markJobDone(admin, job.id, workerId);
				return { id: job.id, ok: true as const, type: job.job_type };
			}
			await markJobFailure(admin, job, out.message, workerId);
			return { id: job.id, ok: false as const, type: job.job_type, message: out.message };
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Unknown worker error";
			try {
				await markJobFailure(admin, job, msg, workerId);
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
