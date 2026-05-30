"use client";

import dynamic from "next/dynamic";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	chapterTopicDisplayLabel,
	difficultyDisplayLabel,
	optionEntries,
	type SessionStudentAnswer,
	questionTypeLabel,
} from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

import { QuestionVisual } from "../visuals/question-visual";
import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { difficultyClass } from "./shared";

const LazyLatexText = dynamic(
	() => import("../latex-text").then((m) => m.LatexText),
	{ ssr: false },
);

const PracticeRichAnswerEditor = dynamic(
	() =>
		import("../practice-rich-answer-editor").then((m) => ({
			default: m.PracticeRichAnswerEditor,
		})),
	{
		loading: () => (
			<div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-4 py-8 text-center text-muted-foreground text-sm">
				Loading editor…
			</div>
		),
	},
);

export type QuestionCardProps = {
	active: PracticeSessionQuestion;
	activeIdx: number;
	totalQuestions: number;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	skipped: Record<string, boolean>;
	submitting: boolean;
	onMcqChange: (q: PracticeSessionQuestion, letter: string) => void;
	onTextChange: (q: PracticeSessionQuestion, value: string) => void;
	onFlagToggle: (q: PracticeSessionQuestion, next: boolean) => void;
	onToggleSkip: (q: PracticeSessionQuestion) => void;
	onOpenReport: () => void;
	onPrev: () => void;
	onNext: () => void;
	onOpenSubmit: () => void;
};

export function QuestionCard({
	active,
	activeIdx,
	totalQuestions,
	answers,
	flagged,
	skipped,
	submitting,
	onMcqChange,
	onTextChange,
	onFlagToggle,
	onToggleSkip,
	onOpenReport,
	onPrev,
	onNext,
	onOpenSubmit,
}: QuestionCardProps) {
	const activeAnswer = answers[active.id];

	return (
		<Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden shadow-sm">
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-y-contain">
				<div className="flex min-w-0 flex-col">
					<CardHeader className="shrink-0 space-y-3 pb-3">
						<div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
							<div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
								<Badge
									variant="outline"
									className="border-border/60 bg-muted/30 text-muted-foreground shrink-0 font-mono tabular-nums font-normal"
								>
									Q{active.question_number}
								</Badge>
								<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium whitespace-nowrap opacity-90">
											Difficulty:
										</span>
										{active.difficulty_level ?
											<Badge
												variant="outline"
												className={cn(
													"border-border/50 font-semibold tracking-tight",
													difficultyClass(active.difficulty_level),
												)}
											>
												{difficultyDisplayLabel(active.difficulty_level)}
											</Badge>
										:	<Badge
												variant="outline"
												className="border-border/50 text-muted-foreground bg-muted/25 font-normal"
											>
												—
											</Badge>}
									</div>
									<div className="flex min-w-0 max-w-full items-center gap-2">
										<span className="shrink-0 text-xs font-medium whitespace-nowrap opacity-90">
											Question type:
										</span>
										<Badge
											variant="outline"
											className="border-border/50 bg-muted/25 text-foreground/90 shrink-0 font-normal"
										>
											{questionTypeLabel(active.question_type)}
										</Badge>
									</div>
									<div className="flex min-w-0 max-w-full items-center gap-2">
										<span className="shrink-0 text-xs font-medium whitespace-nowrap opacity-90">
											Chapter/topic:
										</span>
										<Badge
											variant="outline"
											className="border-border/50 bg-muted/25 text-foreground/90 max-w-[min(100%,24rem)] truncate font-normal"
											title={chapterTopicDisplayLabel(active.chapter_name, active.topic_name)}
										>
											{chapterTopicDisplayLabel(active.chapter_name, active.topic_name)}
										</Badge>
									</div>
								</div>
							</div>
							<div
								className="flex min-h-7 shrink-0 flex-wrap items-center gap-2 opacity-95"
								role="group"
								aria-label="Review options"
							>
								<span className="flex size-7 shrink-0 items-center justify-center">
									<BookmarkIcon
										className={cn(
											"size-4",
											flagged[active.id] ?
												"text-amber-600 dark:text-amber-400"
											:	"text-muted-foreground/80",
										)}
										aria-hidden
									/>
								</span>
								<span className="flex h-7 shrink-0 items-center">
									<input
										type="checkbox"
										id={`review-${active.id}`}
										checked={flagged[active.id] ?? false}
										onChange={(e) => onFlagToggle(active, e.target.checked)}
										className="border-input/55 size-4 shrink-0 rounded"
									/>
								</span>
								<Label
									htmlFor={`review-${active.id}`}
									className="text-muted-foreground hover:text-foreground/80 cursor-pointer text-xs font-medium whitespace-nowrap"
								>
									Mark for review
								</Label>
								<Button
									type="button"
									variant={skipped[active.id] ? "secondary" : "ghost"}
									size="sm"
									onClick={() => onToggleSkip(active)}
									className={cn(
										"h-7 px-2 text-xs font-normal",
										skipped[active.id] ?
											"bg-muted/50 text-muted-foreground"
										:	"text-muted-foreground hover:text-foreground/90",
									)}
								>
									{skipped[active.id] ? "Skipped" : "Skip"}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={onOpenReport}
									className="text-muted-foreground hover:text-foreground/90 h-7 px-2 text-xs font-normal"
								>
									Report
								</Button>
							</div>
						</div>
						<CardTitle className="text-foreground max-w-prose text-balance text-base font-semibold leading-relaxed tracking-tight medium:text-lg">
							<LazyLatexText text={active.question_text} />
						</CardTitle>
						<QuestionVisual visual={active.visual} />
					</CardHeader>
					<Separator className="shrink-0" />
					<CardContent
						key={active.id}
						className="motion-safe:animate-in motion-safe:fade-in-0 flex shrink-0 flex-col gap-6 pb-6 pt-5 motion-safe:duration-200 motion-reduce:animate-none"
					>
						{active.question_type === "multiple_choice" && active.options ?
							<FieldSet>
								<FieldLegend variant="label" className="text-foreground text-sm font-medium">
									Select an answer
								</FieldLegend>
								<FieldGroup className="gap-3">
									{optionEntries(active.options).map(([letter, text]) => {
										const id = `mcq-${active.id}-${letter}`;
										const selected =
											activeAnswer?.kind === "mcq" && activeAnswer.value === letter;
										return (
											<Field key={letter} orientation="horizontal" className="items-start gap-3">
												<input
													type="radio"
													name={`mcq-${active.id}`}
													id={id}
													checked={selected}
													onChange={() => onMcqChange(active, letter)}
													className="mt-1 size-4 border-input"
												/>
												<FieldLabel htmlFor={id} className="flex-1 cursor-pointer leading-snug">
													<span className="border-foreground/15 bg-muted text-foreground/90 mr-2 inline-flex size-7 items-center justify-center rounded-md border-2 font-mono text-xs font-semibold tabular-nums dark:border-border">
														{letter}
													</span>
													<LazyLatexText text={text} />
												</FieldLabel>
											</Field>
										);
									})}
								</FieldGroup>
							</FieldSet>
						:	null}

						{active.question_type === "fill_in_blank" ?
							<FieldSet>
								<FieldLegend variant="label" className="text-foreground text-sm font-medium">
									Your answer
								</FieldLegend>
								<Input
									data-practice-answer-field="true"
									value={activeAnswer?.kind === "text" ? activeAnswer.value : ""}
									onChange={(e) => onTextChange(active, e.target.value)}
									placeholder="One word or short phrase…"
									className="max-w-xl border-2"
									autoComplete="off"
								/>
							</FieldSet>
						:	null}

						{active.question_type === "short_answer" || active.question_type === "long_answer" ?
							<FieldSet className="gap-4">
								<FieldLegend variant="label" className="text-foreground shrink-0 text-sm font-medium">
									Your answer
								</FieldLegend>
								{(() => {
									const value = activeAnswer?.kind === "text" ? activeAnswer.value : "";
									const softCap = active.question_type === "long_answer" ? 4000 : 2000;
									return (
										<PracticeRichAnswerEditor
											key={active.id}
											value={value}
											onChange={(html) => onTextChange(active, html)}
											placeholder={
												active.question_type === "long_answer" ?
													"Write your answer in full…"
												:	"Type your response…"
											}
											variant={active.question_type === "long_answer" ? "long" : "short"}
											softCap={softCap}
										/>
									);
								})()}
							</FieldSet>
						:	null}

						{active.question_type === "numerical" ?
							<FieldSet>
								<FieldLegend variant="label" className="text-foreground text-sm font-medium">
									Your answer
								</FieldLegend>
								<Input
									data-practice-answer-field="true"
									inputMode="decimal"
									value={activeAnswer?.kind === "numerical" ? activeAnswer.value : ""}
									onChange={(e) => onTextChange(active, e.target.value)}
									placeholder="Enter a number (units if stated in the question)"
									className="max-w-md border-2"
								/>
							</FieldSet>
						:	null}
					</CardContent>
				</div>
			</div>
			<CardFooter className="border-border bg-background flex w-full flex-wrap items-center justify-between gap-2 border-t-2 dark:bg-card">
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={activeIdx <= 0}
						onClick={onPrev}
					>
						<ChevronLeftIcon className="size-4" aria-hidden />
						Previous
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={activeIdx >= totalQuestions - 1}
						onClick={onNext}
					>
						Next
						<ChevronRightIcon className="size-4" aria-hidden />
					</Button>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full medium:ms-auto medium:w-auto"
					onClick={onOpenSubmit}
					disabled={submitting}
				>
					Submit test
				</Button>
			</CardFooter>
		</Card>
	);
}
