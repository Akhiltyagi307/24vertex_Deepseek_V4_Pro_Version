"use client";

import {
	BookMarked,
	BookOpen,
	ChevronRight,
	FileText,
	Lightbulb,
	Loader2,
	Sparkles,
} from "lucide-react";

import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import type { DoubtChatTopicRow, DoubtPickerPerformance } from "@/lib/doubt/loaders";
import type { SubjectStatusLabel, TrackerStatus } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

import { PickerField, ScopeSteps } from "./picker-field";
import type { Enrolled } from "./types";

type ChapterGroup = ReturnType<typeof groupTopicRowsByChapter>[number];

const WHOLE_CHAPTER = "__whole_chapter__";

const SUBJECT_SCORE_TOOLTIP =
	"Average practice score across topics you've attempted in this subject.";

const SUBJECT_MIX_TOOLTIP =
	"Overall topic mix in this subject from your practice tracker (strong, developing, or needs improvement).";

const SUBJECT_DROPDOWN_HINT =
	"% is your average practice score on topics you've tried in that subject. The second badge reflects your overall topic mix there (strong, developing, or needs improvement).";

const pillBase = "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums";

function formatTopicStatus(s: TrackerStatus | undefined): string {
	if (!s || s === "not_tested") return "Not tested";
	if (s === "good") return "Strong";
	if (s === "satisfactory") return "Developing";
	return "Needs improvement";
}

function subjectMixPill(
	label: SubjectStatusLabel | undefined,
): { text: string; className: string } {
	if (!label) {
		return { text: "—", className: cn(pillBase, "bg-muted text-muted-foreground") };
	}
	if (label === "Good") {
		return {
			text: "Strong",
			className: cn(
				pillBase,
				"bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
			),
		};
	}
	if (label === "Satisfactory") {
		return {
			text: "Developing",
			className: cn(
				pillBase,
				"bg-amber-500/15 text-amber-900 dark:text-amber-200",
			),
		};
	}
	return {
		text: "Needs improvement",
		className: cn(pillBase, "bg-red-500/10 text-red-800 dark:text-red-300"),
	};
}

function chapterPerfKey(subjectId: string, ch: ChapterGroup) {
	return `${subjectId}:${ch.unitNumber}:${ch.chapterNumber}`;
}

export type ScopePickerProps = {
	sortedSubjects: Enrolled[];
	chapters: ChapterGroup[];
	topicsInChapter: DoubtChatTopicRow[];
	subjectId: string | null;
	chapterKey: string | null;
	topicId: string | null;
	loadTopicsPending: boolean;
	startPending: boolean;
	createError: string | null;
	doubtPickerPerformance: DoubtPickerPerformance;
	onPickSubject: (id: string | null) => void;
	onPickChapter: (key: string | null) => void;
	onPickTopic: (id: string | null) => void;
	onStartChat: () => void;
};

export function ScopePicker({
	sortedSubjects,
	chapters,
	topicsInChapter,
	subjectId,
	chapterKey,
	topicId,
	loadTopicsPending,
	startPending,
	createError,
	doubtPickerPerformance,
	onPickSubject,
	onPickChapter,
	onPickTopic,
	onStartChat,
}: ScopePickerProps) {
	const topicSelectValue = topicId ?? WHOLE_CHAPTER;

	const scopeHint =
		topicId && topicsInChapter.some((t) => t.id === topicId)
			? "The tutor stays within the topic you selected."
			: "The tutor stays within the whole chapter you selected (optional: narrow to one topic).";

	return (
		<div className="flex w-full min-w-0 flex-col gap-6 medium:w-1/2">
			<div className="flex min-w-0 w-full flex-col items-start gap-3">
				<div
					aria-hidden
					className="border-emerald-500/25 bg-emerald-500/10 flex size-10 items-center justify-center rounded-xl border text-emerald-600 dark:text-emerald-400"
				>
					<Sparkles className="size-5" strokeWidth={1.75} />
				</div>
				<div className="min-w-0 w-full space-y-1.5">
					<h1 className="text-foreground text-[22px] font-semibold tracking-tight medium:text-[24px]">
						Start a new chat
					</h1>
					<PageHeaderSubtext variant="wrap">
						Choose your subject and chapter first so the tutor answers only within that syllabus scope, including explanations, examples, and practice questions.
					</PageHeaderSubtext>
				</div>
			</div>

			<div
				className={cn(
					cardSurfaceFrameClassName,
					"bg-card/40 shadow-sm",
					"divide-border/60 divide-y",
				)}
			>
				<div className="flex items-center justify-between gap-3 px-4 py-2.5 medium:px-5">
					<p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
						Scope
					</p>
					<ScopeSteps
						done={{
							subject: Boolean(subjectId),
							chapter: Boolean(chapterKey),
							topic: Boolean(chapterKey),
						}}
					/>
				</div>

				<div className="space-y-4 px-4 py-4 medium:px-5 medium:py-5">
					<PickerField icon={BookOpen} label="Subject" htmlFor="doubt-subject">
						<Select
							id="doubt-subject"
							value={subjectId}
							onValueChange={(v) => {
								onPickSubject(v ?? null);
							}}
						>
							<SelectTrigger aria-label="Subject">
								<SelectValue placeholder="Pick a subject…">
									{(v) =>
										v == null
											? "Pick a subject…"
											: (sortedSubjects.find((s) => s.id === v)?.name ?? "Pick a subject…")
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<p className="text-muted-foreground border-border/50 mb-0.5 border-b px-2 py-2 text-[11px] leading-snug">
									{SUBJECT_DROPDOWN_HINT}
								</p>
								{sortedSubjects.map((s) => {
									const perf = doubtPickerPerformance.bySubjectId[s.id];
									const hasScore = perf?.avgScorePercent != null;
									const scoreLabel = hasScore ? `${perf.avgScorePercent}%` : "—";
									const mix = subjectMixPill(perf?.dominantStatus);
									return (
										<SelectItem key={s.id} value={s.id}>
											<span className="flex w-full min-w-0 items-center gap-2">
												<span className="min-w-0 flex-1 truncate">{s.name}</span>
												<span className="flex max-w-[min(11.5rem,48%)] shrink-0 flex-wrap items-center justify-end gap-1">
													<span
														title={SUBJECT_SCORE_TOOLTIP}
														className={cn(
															pillBase,
															hasScore ?
																"bg-muted/80 text-foreground"
															:	"bg-muted text-muted-foreground",
														)}
													>
														{scoreLabel}
													</span>
													<span
														title={mix.text === "—" ? undefined : SUBJECT_MIX_TOOLTIP}
														className={mix.className}
													>
														{mix.text}
													</span>
												</span>
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</PickerField>

					<PickerField
						icon={BookMarked}
						label="Chapter"
						htmlFor="doubt-chapter"
						locked={!subjectId || loadTopicsPending}
					>
						<Select
							id="doubt-chapter"
							value={chapterKey}
							onValueChange={(v) => onPickChapter(v ?? null)}
							disabled={!subjectId || loadTopicsPending || chapters.length === 0}
						>
							<SelectTrigger aria-label="Chapter">
								{(() => {
									const chapterPlaceholder = !subjectId
										? "Pick a subject first"
										: loadTopicsPending
											? "Loading chapters…"
											: chapters.length === 0
												? "No chapters available"
												: "Pick a chapter…";
									return (
										<SelectValue placeholder={chapterPlaceholder}>
											{(v) =>
												v == null
													? chapterPlaceholder
													: (chapters.find((ch) => ch.key === v)?.label ?? chapterPlaceholder)
											}
										</SelectValue>
									);
								})()}
							</SelectTrigger>
							<SelectContent>
								{chapters.map((ch) => {
									const needsImprovement =
										subjectId ?
											(doubtPickerPerformance.needsImprovementCountByChapterKey[
												chapterPerfKey(subjectId, ch)
											] ?? 0)
										:	0;
									const improvementTitle =
										needsImprovement > 0 ?
											"Topics in this chapter where your latest practice is developing or below target (not yet strong)."
										:	"No topics tested in this chapter yet, or all your practiced topics here are already strong.";
									const improvementLabel =
										needsImprovement === 0 ? "No topics tested"
										: needsImprovement === 1 ? "1 topic needs improvement"
										: `${needsImprovement} topics need improvement`;
									return (
										<SelectItem key={ch.key} value={ch.key}>
											<span className="flex w-full min-w-0 items-center gap-2">
												<span className="min-w-0 flex-1 truncate">
													<span className="text-foreground">{ch.label}</span>
													<span className="text-muted-foreground"> — {ch.topics[0]?.unitName}</span>
												</span>
												<span
													title={improvementTitle}
													className={cn(
														pillBase,
														"shrink-0 whitespace-nowrap",
														needsImprovement > 0 ?
															"bg-amber-500/15 text-amber-900 dark:text-amber-200"
														:	"bg-muted text-muted-foreground",
													)}
												>
													{improvementLabel}
												</span>
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</PickerField>

					<PickerField
						icon={FileText}
						label="Topic (optional)"
						htmlFor="doubt-topic"
						locked={!chapterKey || loadTopicsPending}
					>
						<Select
							id="doubt-topic"
							value={topicSelectValue}
							onValueChange={(v) => {
								if (v == null || v === WHOLE_CHAPTER) {
									onPickTopic(null);
								} else {
									onPickTopic(v);
								}
							}}
							disabled={!chapterKey || loadTopicsPending || topicsInChapter.length === 0}
						>
							<SelectTrigger aria-label="Topic">
								{(() => {
									const topicPlaceholder = !chapterKey
										? "Pick a chapter first"
										: loadTopicsPending
											? "Loading topics…"
											: topicsInChapter.length === 0
												? "No topics in this chapter"
												: "Whole chapter or pick a topic…";
									return (
										<SelectValue placeholder={topicPlaceholder}>
											{(v) => {
												if (v == null || v === WHOLE_CHAPTER) return "Whole chapter";
												return (
													topicsInChapter.find((t) => t.id === v)?.topicName ?? topicPlaceholder
												);
											}}
										</SelectValue>
									);
								})()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={WHOLE_CHAPTER}>
									<span className="text-foreground font-medium">Whole chapter</span>
									<span className="text-muted-foreground block text-[11px]">
										All syllabus topics in this chapter
									</span>
								</SelectItem>
								{topicsInChapter.map((t) => {
									const st = doubtPickerPerformance.topicStatusById[t.id];
									const stLabel = formatTopicStatus(st);
									return (
										<SelectItem key={t.id} value={t.id}>
											<span className="flex w-full min-w-0 items-center gap-2">
												<span className="min-w-0 flex-1 truncate">{t.topicName}</span>
												<span
													className={cn(
														pillBase,
														st === "good" &&
															"bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
														st === "satisfactory" &&
															"bg-amber-500/15 text-amber-900 dark:text-amber-200",
														st === "bad" && "bg-red-500/10 text-red-800 dark:text-red-300",
														(st === "not_tested" || !st) &&
															"bg-muted text-muted-foreground",
													)}
												>
													{stLabel}
												</span>
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</PickerField>

					{createError ? (
						<Alert variant="destructive" className="rounded-lg">
							<AlertDescription>{createError}</AlertDescription>
						</Alert>
					) : null}
				</div>

				<div className="flex flex-col-reverse items-stretch gap-2.5 px-4 py-3 medium:flex-row medium:items-center medium:justify-between medium:px-5">
					<p className="text-muted-foreground text-[12px] leading-snug">{scopeHint}</p>
					<Button
						type="button"
						size="lg"
						className="h-10 gap-1.5 px-4 font-medium shadow-sm medium:w-auto"
						onClick={onStartChat}
						disabled={!subjectId || !chapterKey || startPending}
					>
						{startPending ? (
							<>
								<Loader2 className="size-4 animate-spin" aria-hidden />
								Starting…
							</>
						) : (
							<>
								Start chat
								<ChevronRight className="size-4" strokeWidth={2.25} aria-hidden />
							</>
						)}
					</Button>
				</div>
			</div>

			<div className="border-border/50 bg-muted/20 flex items-start gap-3 rounded-lg border p-3.5">
				<Lightbulb
					className="text-muted-foreground/80 mt-0.5 size-4 shrink-0"
					strokeWidth={1.75}
					aria-hidden
				/>
				<div className="text-muted-foreground text-[12.5px] leading-relaxed">
					<span className="text-foreground font-medium">Good prompts are specific.</span>{" "}
					Try <span className="text-foreground">&ldquo;Summarise in 3 lines,&rdquo;</span>{" "}
					<span className="text-foreground">&ldquo;Explain the main theme,&rdquo;</span> or{" "}
					<span className="text-foreground">&ldquo;Give me 5 practice questions.&rdquo;</span>
				</div>
			</div>
		</div>
	);
}
