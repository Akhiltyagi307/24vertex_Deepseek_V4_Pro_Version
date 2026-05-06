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
import type { DoubtChatTopicRow } from "@/lib/doubt/loaders";
import type { groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import { cn } from "@/lib/utils";

type ChapterGroup = ReturnType<typeof groupTopicRowsByChapter>[number];

import { PickerField, ScopeSteps } from "./picker-field";
import type { Enrolled } from "./types";

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
	onPickSubject,
	onPickChapter,
	onPickTopic,
	onStartChat,
}: ScopePickerProps) {
	return (
		<div className="flex w-full min-w-0 flex-col gap-6">
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
							topic: Boolean(topicId),
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
								{sortedSubjects.map((s) => (
									<SelectItem key={s.id} value={s.id}>
										{s.name}
									</SelectItem>
								))}
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
								{chapters.map((ch) => (
									<SelectItem key={ch.key} value={ch.key}>
										<span className="truncate">
											<span className="text-foreground">{ch.label}</span>
											<span className="text-muted-foreground"> — {ch.topics[0]?.unitName}</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</PickerField>

					<PickerField
						icon={FileText}
						label="Topic"
						htmlFor="doubt-topic"
						locked={!chapterKey || loadTopicsPending}
					>
						<Select
							id="doubt-topic"
							value={topicId}
							onValueChange={(v) => onPickTopic(v ?? null)}
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
												: "Pick a topic…";
									return (
										<SelectValue placeholder={topicPlaceholder}>
											{(v) =>
												v == null
													? topicPlaceholder
													: (topicsInChapter.find((t) => t.id === v)?.topicName ?? topicPlaceholder)
											}
										</SelectValue>
									);
								})()}
							</SelectTrigger>
							<SelectContent>
								{topicsInChapter.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.topicName}
									</SelectItem>
								))}
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
					<p className="text-muted-foreground text-[12px] leading-snug">
						The tutor only answers within this topic.
					</p>
					<Button
						type="button"
						size="lg"
						className="h-10 gap-1.5 px-4 font-medium shadow-sm medium:w-auto"
						onClick={onStartChat}
						disabled={!subjectId || !topicId || startPending}
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
