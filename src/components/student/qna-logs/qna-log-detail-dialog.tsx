"use client";

import dynamic from "next/dynamic";
import {
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleDashedIcon,
	CircleSlashIcon,
	XCircleIcon,
} from "lucide-react";

import { McqOptionsReadonly } from "./mcq-options-readonly";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { questionTypeLabel } from "@/lib/practice/practice-session-utils";
import {
	buildVerdictNarrative,
	verdictHeadline,
	verdictTone,
	type QnaLogVoice,
} from "@/lib/student/qna-logs/qna-log-verdict";
import type { QnaLogDetail } from "@/lib/student/qna-logs/types";
import { cn } from "@/lib/utils";

const LazyLatexText = dynamic(
	() => import("@/components/student/practice/latex-text").then((module) => module.LatexText),
	{ ssr: false },
);

const LazyQuestionVisual = dynamic(
	() => import("@/components/student/practice/visuals/question-visual").then((module) => module.QuestionVisual),
	{ ssr: false },
);

type Props = {
	open: boolean;
	detail: QnaLogDetail | null;
	loading: boolean;
	navPending: boolean;
	canPrev: boolean;
	canNext: boolean;
	positionLabel: string;
	errorMessage: string | null;
	voice: QnaLogVoice;
	onOpenChange: (open: boolean) => void;
	onNavigate: (dir: "prev" | "next") => void;
};

function sourceLabel(source: QnaLogDetail["source"]): string {
	return source === "assignment" ? "Assignment" : "Practice";
}

function VerdictIcon({ performance, className }: { performance: QnaLogDetail["performance"]; className?: string }) {
	const Icon =
		performance === "correct" ? CheckCircle2Icon
		: performance === "incorrect" ? XCircleIcon
		: performance === "partial" ? CircleSlashIcon
		: CircleDashedIcon;
	return <Icon className={className} aria-hidden="true" />;
}

function VerdictHeader({ detail, voice }: { detail: QnaLogDetail; voice: QnaLogVoice }) {
	const tone = verdictTone(detail.performance);
	const headline = verdictHeadline(detail.performance, voice);
	const timestamp = detail.dateIso ? formatDateTimeMediumShortInAppTimeZone(detail.dateIso) : null;

	return (
		<header className="space-y-2">
			<div className="flex flex-col gap-3 medium:flex-row medium:items-start medium:justify-between">
				<div className="flex min-w-0 flex-wrap items-center gap-3">
					<span
						className={cn(
							"inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium tabular-nums medium:h-8 medium:text-sm",
							tone.chip,
						)}
					>
						<VerdictIcon
							performance={detail.performance}
							className="size-3.5 shrink-0 medium:size-4"
						/>
						{headline}
					</span>
					<div className="min-w-0 space-y-1 pt-0.5">
						<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
							<span>Q{detail.questionNumber}</span>
							<span aria-hidden="true">·</span>
							<span>{sourceLabel(detail.source)}</span>
							<span aria-hidden="true">·</span>
							<span>{questionTypeLabel(detail.questionType)}</span>
						</p>
						<p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm text-foreground/85">
							<span className="truncate font-medium" title={detail.subjectName}>
								{detail.subjectName}
							</span>
							<span className="text-muted-foreground/70" aria-hidden="true">
								›
							</span>
							<span className="truncate" title={detail.chapterName ?? "—"}>
								{detail.chapterName ?? "—"}
							</span>
							<span className="text-muted-foreground/70" aria-hidden="true">
								›
							</span>
							<span className="truncate text-muted-foreground" title={detail.topicName}>
								{detail.topicName}
							</span>
						</p>
					</div>
				</div>
				{timestamp ? (
					<time
						dateTime={detail.dateIso ?? undefined}
						className="shrink-0 text-xs tabular-nums text-muted-foreground medium:self-start medium:pt-1.5"
					>
						{timestamp}
					</time>
				) : null}
			</div>
		</header>
	);
}

function VerdictBlock({ detail, voice }: { detail: QnaLogDetail; voice: QnaLogVoice }) {
	const tone = verdictTone(detail.performance);
	const narrative = buildVerdictNarrative(detail, voice);

	if (narrative.kind === "graded-mcq") {
		return (
			<section
				className={cn(
					"rounded-lg border px-4 py-3.5",
					tone.surface,
				)}
			>
				<p className={cn("text-base font-medium leading-relaxed", tone.heading)}>
					{narrative.sentence}
				</p>
			</section>
		);
	}

	if (narrative.kind === "graded-text") {
		return (
			<section className={cn("rounded-lg border", tone.surface)}>
				<div className="grid grid-cols-1 gap-px medium:grid-cols-2">
					<div className="space-y-1.5 px-4 py-3">
						<p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
							{narrative.chosenLabel}
						</p>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
							{narrative.chosenAnswer}
						</p>
					</div>
					<div className="space-y-1.5 px-4 py-3 medium:border-l medium:border-border/40">
						<p className={cn("text-[11px] font-medium uppercase tracking-[0.06em]", tone.heading)}>
							{narrative.correctLabel}
						</p>
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
							{narrative.correctAnswer}
						</p>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className={cn("space-y-2 rounded-lg border px-4 py-3", tone.surface)}>
			<p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
				{narrative.chosenLabel}
			</p>
			<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
				{narrative.chosenAnswer}
			</p>
			<p className="pt-1 text-xs text-muted-foreground">{narrative.note}</p>
		</section>
	);
}

function CoachNotes({ feedback }: { feedback: NonNullable<QnaLogDetail["aiFeedback"]> }) {
	return (
		<section className="space-y-3">
			<h3 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
				Coach notes
			</h3>
			<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
				{feedback.analysis}
			</p>
			{feedback.stepByStep ? (
				<div className="space-y-2 border-t border-border/60 pt-3">
					<h4 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
						Walk through it
					</h4>
					<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
						{feedback.stepByStep}
					</p>
				</div>
			) : null}
		</section>
	);
}

export function QnaLogDetailDialog({
	open,
	detail,
	loading,
	navPending,
	canPrev,
	canNext,
	positionLabel,
	errorMessage,
	voice,
	onOpenChange,
	onNavigate,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(90vh,56rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0 medium:max-w-4xl">
				<DialogHeader className="border-b border-border px-4 py-3 medium:px-5">
					<DialogTitle>Question details</DialogTitle>
				</DialogHeader>

				<div className="flex-1 space-y-6 overflow-y-auto p-4 pb-6 medium:p-5 medium:pb-7">
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading question details…</p>
					) : errorMessage ? (
						<p className="text-sm text-destructive">{errorMessage}</p>
					) : !detail ? (
						<p className="text-sm text-muted-foreground">Question details are unavailable.</p>
					) : (
						<>
							<VerdictHeader detail={detail} voice={voice} />

							<section className="space-y-2 border-t border-border/60 pt-5">
								<h3 className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
									Question
								</h3>
								<div className="text-base leading-relaxed text-foreground">
									<LazyLatexText text={detail.questionText} />
								</div>
								{detail.visual ? (
									<div className="pt-1">
										<LazyQuestionVisual visual={detail.visual} />
									</div>
								) : null}
							</section>

							{detail.questionType === "multiple_choice" ? (
								<div className="border-t border-border/60 pt-5">
									<McqOptionsReadonly
										options={detail.options}
										selectedKey={detail.studentSelectedKey}
										correctKey={detail.correctOptionKey}
										testStatus={detail.testStatus}
									/>
								</div>
							) : null}

							<div className="border-t border-border/60 pt-5">
								<VerdictBlock detail={detail} voice={voice} />
							</div>

							{detail.aiFeedback ? (
								<div className="border-t border-border/60 pt-5">
									<CoachNotes feedback={detail.aiFeedback} />
								</div>
							) : null}
						</>
					)}
				</div>

				<footer className="flex flex-col gap-2 rounded-b-xl border-t border-border bg-muted/40 px-4 py-3 medium:flex-row medium:items-center medium:justify-between medium:px-5">
					<p className="text-xs tabular-nums text-muted-foreground">
						{positionLabel}
						<span className="hidden text-muted-foreground/70 medium:inline"> · use ← → to navigate</span>
					</p>
					<div className="flex items-center gap-2 self-end medium:self-auto">
						<Button
							type="button"
							variant="outline"
							size="sm"
							aria-keyshortcuts="ArrowLeft"
							disabled={!canPrev || navPending || loading}
							onClick={() => onNavigate("prev")}
						>
							<ChevronLeftIcon className="size-4" />
							Previous
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							aria-keyshortcuts="ArrowRight"
							disabled={!canNext || navPending || loading}
							onClick={() => onNavigate("next")}
						>
							Next
							<ChevronRightIcon className="size-4" />
						</Button>
					</div>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
