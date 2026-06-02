"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AlertTriangleIcon, CheckIcon, Loader2Icon } from "lucide-react";

import { retryPracticeGrading } from "../../../../app/student/practice/session-actions";
import { PracticeProgressChecklist } from "@/components/student/practice/practice-progress-checklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GridLoader } from "@/components/ui/grid-loader";
import {
	GRADING_BUCKETS,
	GRADING_PROGRESS_BUCKET_INDEX,
	computeGradingDoneThrough,
} from "@/lib/practice/grading-progress-buckets";
import { jobStatusHint, sanitizeGradingErrorForUi } from "@/lib/practice/grading-error-ui";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type PracticeGradingProgressProps = {
	testId: string;
	subjectId: string;
	subjectName: string;
	initialStatus: "grading" | "grading_failed";
	totalQuestions: number | null;
};

type Phase = "grading" | "failed" | "graded";

/** Show an extra action if grading takes longer than this (worker trigger / cron may need a nudge). */
const STUCK_REQUEUE_AFTER_SECONDS = 150;

/** Polling backs off after this so realtime can drive most updates. */
const GRADING_POLL_FAST_MS = 2_000;
const GRADING_POLL_SLOW_MS = 5_000;
const GRADING_POLL_BACKOFF_AFTER_MS = 30_000;

function formatElapsed(totalSeconds: number): string {
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return s === 0 ? `${m} min` : `${m} min ${s}s`;
}

function statusToPhase(s: string): Phase {
	if (s === "graded") return "graded";
	if (s === "grading_failed") return "failed";
	return "grading";
}

export function PracticeGradingProgressView({
	testId,
	subjectId,
	subjectName,
	initialStatus,
	totalQuestions,
}: PracticeGradingProgressProps) {
	const router = useRouter();
	const [phase, setPhase] = React.useState<Phase>(statusToPhase(initialStatus));
	const [actionBusy, setActionBusy] = React.useState(false);
	const [retryError, setRetryError] = React.useState<string | null>(null);
	/** Rebased when a new grading attempt starts after "Try again" from failure. */
	const [sessionClockStart, setSessionClockStart] = React.useState(() => Date.now());
	const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
	const [jobInfo, setJobInfo] = React.useState<{
		status: string;
		errorSanitized: string;
	} | null>(null);
	const [reportErrorHint, setReportErrorHint] = React.useState("");
	const [pollIntervalMs, setPollIntervalMs] = React.useState(GRADING_POLL_FAST_MS);
	const [gradingProgress, setGradingProgress] = React.useState<{ graded: number; total: number } | null>(null);
	const [doneThrough, setDoneThrough] = React.useState(0);
	const lastRealtimeAtRef = React.useRef(0);

	React.useEffect(() => {
		setPollIntervalMs(GRADING_POLL_FAST_MS);
		const t = window.setTimeout(() => {
			setPollIntervalMs(GRADING_POLL_SLOW_MS);
		}, GRADING_POLL_BACKOFF_AFTER_MS);
		return () => window.clearTimeout(t);
	}, [testId]);

	React.useEffect(() => {
		if (phase !== "grading") return;
		const id = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - sessionClockStart) / 1000));
		}, 1000);
		return () => window.clearInterval(id);
	}, [phase, sessionClockStart]);

	React.useEffect(() => {
		if (phase !== "grading") return;
		const graded = gradingProgress?.graded ?? null;
		const total = gradingProgress?.total ?? totalQuestions;
		const next = computeGradingDoneThrough({
			graded,
			total,
			elapsedSeconds,
		});
		setDoneThrough((prev) => Math.max(prev, next));
	}, [phase, gradingProgress, totalQuestions, elapsedSeconds]);

	// Realtime on `tests` plus polling for status, `practice_jobs`, and `test_reports` hints.
	React.useEffect(() => {
		const supabase = createBrowserSupabase();
		let cancelled = false;

		const applyStatus = (raw: string | null | undefined) => {
			if (!raw) return;
			setPhase(statusToPhase(raw));
		};

		const pollOnce = async (opts?: { skipIfRecentRealtime?: boolean }) => {
			if (cancelled) return;
			if (opts?.skipIfRecentRealtime) {
				const sinceRt = Date.now() - lastRealtimeAtRef.current;
				if (sinceRt < 3_000 && lastRealtimeAtRef.current > 0) {
					return;
				}
			}
			const [testRes, jobRes, reportRes] = await Promise.all([
				supabase.from("tests").select("status").eq("id", testId).maybeSingle(),
				supabase
					.from("practice_jobs")
					.select("status, error, payload")
					.eq("test_id", testId)
					.eq("job_type", "grade")
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle(),
				supabase.from("test_reports").select("grading_error").eq("test_id", testId).maybeSingle(),
			]);
			applyStatus(testRes.data?.status as string | undefined);
			if (jobRes.data) {
				const errRaw = jobRes.data.error as string | null;
				setJobInfo({
					status: String(jobRes.data.status),
					errorSanitized: sanitizeGradingErrorForUi(errRaw),
				});
			} else {
				setJobInfo(null);
			}
			const rawPayload = (jobRes.data as { payload?: unknown } | null)?.payload;
			const gp = (rawPayload as { grading?: { graded?: unknown; total?: unknown } } | null | undefined)?.grading;
			if (gp && typeof gp.graded === "number" && typeof gp.total === "number" && gp.total > 0) {
				const graded = Math.min(gp.graded, gp.total);
				const total = gp.total;
				setGradingProgress((prev) => ({ graded: Math.max(prev?.graded ?? 0, graded), total }));
			}
			const ge = reportRes.data?.grading_error;
			setReportErrorHint(sanitizeGradingErrorForUi(typeof ge === "string" ? ge : null));
		};

		const channel = supabase
			.channel(`practice-grading-${testId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "tests",
					filter: `id=eq.${testId}`,
				},
				(payload) => {
					if (cancelled) return;
					lastRealtimeAtRef.current = Date.now();
					const next = (payload.new as { status?: string } | null)?.status;
					applyStatus(next);
				},
			)
			.subscribe();

		void pollOnce();
		const pollId = window.setInterval(() => void pollOnce({ skipIfRecentRealtime: true }), pollIntervalMs);

		return () => {
			cancelled = true;
			window.clearInterval(pollId);
			void supabase.removeChannel(channel);
		};
	}, [testId, pollIntervalMs]);

	React.useEffect(() => {
		if (phase !== "graded") return;
		const target = `/student/reports?subject=${encodeURIComponent(subjectId)}&test=${encodeURIComponent(testId)}`;
		router.replace(target);
	}, [phase, router, subjectId, testId]);

	const runRequeue = React.useCallback(
		async (opts?: { resetSessionClock?: boolean }) => {
			setRetryError(null);
			setActionBusy(true);
			try {
				const res = await retryPracticeGrading({ testId });
				if (!res.ok) {
					setRetryError(res.message);
					return;
				}
				setPhase("grading");
				setDoneThrough(0);
				if (opts?.resetSessionClock) {
					setSessionClockStart(Date.now());
					setElapsedSeconds(0);
				}
			} finally {
				setActionBusy(false);
			}
		},
		[testId],
	);

	const jobStatusLine = jobInfo ? jobStatusHint(jobInfo.status) : "";
	const showJobErrorInGrading =
		phase === "grading" &&
		Boolean(jobInfo?.errorSanitized) &&
		(jobInfo?.status === "dead" || jobInfo?.status === "pending");

	const failedDetail = phase === "failed" ? (reportErrorHint || jobInfo?.errorSanitized || "") : "";

	const showStuckNudge = phase === "grading" && elapsedSeconds >= STUCK_REQUEUE_AFTER_SECONDS;

	const gradedCount = gradingProgress?.graded ?? null;
	const gradedTotal = gradingProgress?.total ?? totalQuestions;
	const progressDetail =
		gradedCount !== null && gradedTotal != null && gradedTotal > 0 ?
			`Graded ${Math.min(gradedCount, gradedTotal)} of ${gradedTotal}`
		:	gradedTotal != null ?
			`${gradedTotal} questions`
		:	null;

	return (
		<div
			className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/85 px-6 backdrop-blur-sm"
			aria-busy={phase === "grading"}
		>
			{phase === "grading" ?
				<>
					<div
						className="flex w-full max-w-xs flex-col items-center gap-6"
						role="status"
						aria-live="polite"
					>
						<GridLoader size="md" />
						<PracticeProgressChecklist
							buckets={GRADING_BUCKETS}
							doneThrough={doneThrough}
							progressBucketIndex={GRADING_PROGRESS_BUCKET_INDEX}
							progressDetail={progressDetail}
							ariaLabel={`Grading ${subjectName}`}
							className="w-full"
						/>
					</div>
					<p className="text-muted-foreground px-4 text-center text-sm">
						This usually takes a minute or two.
						{elapsedSeconds > 0 ?
							<span className="mt-1 block text-xs tabular-nums">Elapsed {formatElapsed(elapsedSeconds)}</span>
						:	null}
					</p>
					{jobStatusLine ?
						<p className="text-muted-foreground max-w-xs px-4 text-center text-xs">{jobStatusLine}</p>
					:	null}
					{showJobErrorInGrading && jobInfo?.errorSanitized ?
						<p className="text-muted-foreground/90 max-w-xs px-4 text-center text-xs leading-snug">
							{jobInfo.errorSanitized}
						</p>
					:	null}
					{showStuckNudge ?
						<div className="flex max-w-xs flex-col items-center gap-2">
							<p className="text-muted-foreground text-center text-sm">Still waiting? Nudge the grader to run again.</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={actionBusy}
								onClick={() => void runRequeue()}
							>
								{actionBusy ?
									<>
										<Loader2Icon className="mr-2 size-4 animate-spin" />
										Re-sending…
									</>
								:	"Re-send to grader"}
							</Button>
						</div>
					:	null}
				</>
			: null}

			{phase === "failed" ?
				<div className="flex w-full max-w-md flex-col items-center gap-5" role="alert">
					<div
						className={cn(
							"flex size-14 items-center justify-center rounded-full",
							"border-destructive/40 bg-destructive/10 text-destructive border-2",
						)}
						aria-hidden
					>
						<AlertTriangleIcon className="size-6" />
					</div>
					<Alert variant="destructive" className="w-full">
						<AlertTitle>Couldn&apos;t complete grading</AlertTitle>
						<AlertDescription>
							The grading service didn&apos;t finish. Your responses are still saved—try again, or return to
							practice and contact support if this continues.
						</AlertDescription>
					</Alert>
					{jobStatusLine ?
						<p className="text-muted-foreground max-w-sm text-center text-sm">{jobStatusLine}</p>
					: null}
					{failedDetail ?
						<p className="text-muted-foreground/90 max-w-sm text-center text-sm leading-snug">{failedDetail}</p>
					: null}
					{retryError ?
						<Alert variant="destructive" className="w-full">
							<AlertDescription>{retryError}</AlertDescription>
						</Alert>
					: null}
					<Button
						type="button"
						size="default"
						className="w-full max-w-xs"
						disabled={actionBusy}
						onClick={() => void runRequeue({ resetSessionClock: true })}
					>
						{actionBusy ?
							<>
								<Loader2Icon className="mr-2 size-4 animate-spin" />
								Queuing retry…
							</>
						:	"Try again"}
					</Button>
				</div>
			: null}

			{phase === "graded" ?
				<div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
					<div
						className="flex size-14 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-600/10"
						aria-hidden
					>
						<CheckIcon className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
					</div>
					<p className="text-foreground text-base font-medium">Opening your report…</p>
				</div>
			: null}
		</div>
	);
}
