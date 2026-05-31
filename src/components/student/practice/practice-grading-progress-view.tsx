"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AlertTriangleIcon, CheckCircleIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import { retryPracticeGrading } from "../../../../app/student/practice/session-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridLoader } from "@/components/ui/grid-loader";
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

const GRADING_STATUS_MESSAGES = [
	"Scoring your answers…",
	"Drafting feedback for each question…",
	"Checking responses against the answer key…",
	"Updating your subject progress…",
	"Finalizing your practice report…",
] as const;

/** How long each status line stays visible before rotating to the next. */
const GRADING_STATUS_ROTATE_MS = 6_000;

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
	const [rotatingIndex, setRotatingIndex] = React.useState(0);
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
	const lastRealtimeAtRef = React.useRef(0);

	React.useEffect(() => {
		setPollIntervalMs(GRADING_POLL_FAST_MS);
		const t = window.setTimeout(() => {
			setPollIntervalMs(GRADING_POLL_SLOW_MS);
		}, GRADING_POLL_BACKOFF_AFTER_MS);
		return () => window.clearTimeout(t);
	}, [testId]);

	// Rotating status copy: each line stays long enough to read comfortably.
	React.useEffect(() => {
		if (phase !== "grading") return;
		const id = window.setInterval(() => {
			setRotatingIndex((i) => (i + 1) % GRADING_STATUS_MESSAGES.length);
		}, GRADING_STATUS_ROTATE_MS);
		return () => window.clearInterval(id);
	}, [phase]);

	React.useEffect(() => {
		if (phase !== "grading") return;
		const id = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - sessionClockStart) / 1000));
		}, 1000);
		return () => window.clearInterval(id);
	}, [phase, sessionClockStart]);

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
				setRotatingIndex(0);
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

	return (
		<div className="flex min-h-[calc(100dvh-8rem)] w-full min-w-0 flex-col items-center justify-center gap-6 p-6 medium:p-8">
			<Card className="w-full min-w-0 max-w-full bg-card/80 shadow-md medium:w-[45%] dark:shadow-none">
				<CardHeader className="gap-2 border-b border-border/60 pb-6">
					<div className="flex items-center gap-2">
						<SparklesIcon className="size-4 text-primary" aria-hidden />
						<p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.08em]">
							Grading in progress
						</p>
					</div>
					<CardTitle className="text-2xl font-semibold tracking-tight">{subjectName}</CardTitle>
					<CardDescription className="text-base leading-relaxed text-muted-foreground">
						{phase === "grading"
							? "We're scoring this practice test and generating your report. Most sessions finish within a minute. When grading completes, you'll be redirected to this subject's report and your latest attempt will be highlighted."
							: phase === "failed"
								? "We couldn’t finish grading this attempt. You can try again below; your answers are saved."
								: "Your report is ready. Taking you there now…"}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-5 pb-8 pt-6">
					{phase === "grading" ? (
						<>
							<div
								className="flex flex-col items-center gap-4"
								role="status"
								aria-live="polite"
								aria-busy="true"
							>
								<GridLoader size="lg" />
								<p
									key={rotatingIndex}
									className="text-foreground max-w-sm text-center text-base font-medium leading-snug motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
								>
									{GRADING_STATUS_MESSAGES[rotatingIndex]}
								</p>
							</div>
							{jobStatusLine ? (
								<p className="text-muted-foreground max-w-sm text-center text-sm">{jobStatusLine}</p>
							) : null}
							{showJobErrorInGrading && jobInfo?.errorSanitized ? (
								<p className="text-muted-foreground/90 max-w-sm text-center text-sm leading-snug">
									{jobInfo.errorSanitized}
								</p>
							) : null}
							<p className="text-muted-foreground text-sm tabular-nums">
								{gradingProgress != null
									? `Graded ${gradingProgress.graded} of ${gradingProgress.total} · `
									: totalQuestions != null
										? `${totalQuestions} questions · `
										: ""}
								Elapsed {formatElapsed(elapsedSeconds)}
							</p>
							{showStuckNudge ? (
								<div className="flex w-full max-w-sm flex-col items-center gap-2">
									<p className="text-muted-foreground text-center text-sm">Still waiting? Nudge the grader to run again.</p>
									<Button
										type="button"
										variant="outline"
										size="default"
										className="w-full medium:w-auto"
										disabled={actionBusy}
										onClick={() => void runRequeue()}
									>
										{actionBusy ? (
											<>
												<Loader2Icon className="mr-2 size-4 animate-spin" />
												Re-sending…
											</>
										) : (
											"Re-send to grader"
										)}
									</Button>
								</div>
							) : null}
						</>
					) : null}

					{phase === "failed" ? (
						<>
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
								<AlertTitle>Couldn’t complete grading</AlertTitle>
								<AlertDescription>
									The grading service didn’t finish. Your responses are still saved—try again, or return to
									practice and contact support if this continues.
								</AlertDescription>
							</Alert>
							{jobStatusLine ? (
								<p className="text-muted-foreground max-w-sm text-center text-sm">{jobStatusLine}</p>
							) : null}
							{failedDetail ? (
								<p className="text-muted-foreground/90 max-w-sm text-center text-sm leading-snug">
									{failedDetail}
								</p>
							) : null}
							{retryError ? (
								<Alert variant="destructive" className="w-full">
									<AlertDescription>{retryError}</AlertDescription>
								</Alert>
							) : null}
							<Button
								type="button"
								size="lg"
								className="w-full medium:w-auto"
								disabled={actionBusy}
								onClick={() => void runRequeue({ resetSessionClock: true })}
							>
								{actionBusy ? (
									<>
										<Loader2Icon className="mr-2 size-4 animate-spin" />
										Queuing retry…
									</>
								) : (
									"Try again"
								)}
							</Button>
						</>
					) : null}

					{phase === "graded" ? (
						<>
							<div
								className="flex size-14 items-center justify-center rounded-full border-2 border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
								aria-hidden
							>
								<CheckCircleIcon className="size-6" />
							</div>
							<p className="text-foreground text-lg font-medium">Opening your report…</p>
						</>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
