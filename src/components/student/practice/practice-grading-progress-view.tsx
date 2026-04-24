"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AlertTriangleIcon, CheckCircleIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import { retryPracticeGrading } from "../../../../app/student/practice/session-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridLoader } from "@/components/ui/grid-loader";
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
	const [retrying, setRetrying] = React.useState(false);
	const [retryError, setRetryError] = React.useState<string | null>(null);
	const [startedAt] = React.useState(() => Date.now());
	const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

	// Rotating status copy (slightly slower so each line is readable).
	React.useEffect(() => {
		if (phase !== "grading") return;
		const id = window.setInterval(() => {
			setRotatingIndex((i) => (i + 1) % GRADING_STATUS_MESSAGES.length);
		}, 3200);
		return () => window.clearInterval(id);
	}, [phase]);

	React.useEffect(() => {
		if (phase !== "grading") return;
		const id = window.setInterval(() => {
			setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		}, 1000);
		return () => window.clearInterval(id);
	}, [phase, startedAt]);

	// Realtime on `tests` plus fast polling so we pick up `graded` even if Realtime is off.
	React.useEffect(() => {
		const supabase = createBrowserSupabase();
		let cancelled = false;

		const applyStatus = (raw: string | null | undefined) => {
			if (!raw) return;
			setPhase(statusToPhase(raw));
		};

		const pollOnce = async () => {
			if (cancelled) return;
			const { data } = await supabase.from("tests").select("status").eq("id", testId).maybeSingle();
			applyStatus(data?.status as string | undefined);
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
					const next = (payload.new as { status?: string } | null)?.status;
					applyStatus(next);
				},
			)
			.subscribe();

		void pollOnce();
		const pollId = window.setInterval(() => void pollOnce(), 1_500);

		return () => {
			cancelled = true;
			window.clearInterval(pollId);
			void supabase.removeChannel(channel);
		};
	}, [testId]);

	React.useEffect(() => {
		if (phase !== "graded") return;
		const target = `/student/reports?subject=${encodeURIComponent(subjectId)}&test=${encodeURIComponent(testId)}`;
		router.replace(target);
	}, [phase, router, subjectId, testId]);

	const onRetry = React.useCallback(async () => {
		setRetryError(null);
		setRetrying(true);
		try {
			const res = await retryPracticeGrading({ testId });
			if (!res.ok) {
				setRetryError(res.message);
				return;
			}
			setPhase("grading");
			setRotatingIndex(0);
		} finally {
			setRetrying(false);
		}
	}, [testId]);

	return (
		<div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-lg flex-col justify-center gap-6 p-6 sm:p-8">
			<Card className="border-border bg-card/80 shadow-md ring-1 ring-border/60 dark:shadow-none dark:ring-border/40">
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
							<p className="text-muted-foreground text-sm tabular-nums">
								{totalQuestions != null ? `${totalQuestions} questions · ` : ""}
								Elapsed {formatElapsed(elapsedSeconds)}
							</p>
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
							{retryError ? (
								<Alert variant="destructive" className="w-full">
									<AlertDescription>{retryError}</AlertDescription>
								</Alert>
							) : null}
							<Button
								type="button"
								size="lg"
								className="w-full sm:w-auto"
								disabled={retrying}
								onClick={() => void onRetry()}
							>
								{retrying ? (
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
