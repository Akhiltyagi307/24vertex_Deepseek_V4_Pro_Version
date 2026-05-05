"use client";

import Link from "next/link";
import { CheckIcon } from "lucide-react";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { getSubjectCardIconConfig } from "@/lib/student/subject-lucide-icon";
import { cn } from "@/lib/utils";

import { clusterSubjectsByGroup } from "./helpers";
import type { PracticeEnrolledSubject, PracticeSubjectProgress } from "./types";

export type StepSubjectProps = {
	enrolledSubjects: PracticeEnrolledSubject[];
	subjectId: string | null;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	onPickSubject: (id: string) => void;
};

export function StepSubject({
	enrolledSubjects,
	subjectId,
	subjectProgressBySubjectId,
	onPickSubject,
}: StepSubjectProps) {
	const subjectClusters = clusterSubjectsByGroup(enrolledSubjects);

	return (
		<div className={cn(cardSurfaceFrameClassName, "space-y-6 p-5 medium:p-7")}>
			<div className="space-y-1.5">
				<h2 className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]">
					Choose a subject
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
					Choose the subject you want to revise. We&apos;ll use your performance tracker for that subject—you
					can go back and change it before you start the test.
				</p>
			</div>
			<FieldSet className="gap-5">
				<FieldLegend variant="label" className="sr-only">
					Subjects
				</FieldLegend>
				<FieldGroup data-slot="radio-group" className="gap-10">
					{subjectClusters.map((cluster, clusterIndex) => (
						<div
							key={
								cluster.groupLabel
									? `${cluster.groupLabel}-${clusterIndex}`
									: `subjects-${clusterIndex}`
							}
							className="flex flex-col gap-4"
						>
							{cluster.groupLabel ? (
								<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
									<p className="text-muted-foreground font-mono text-[12.375px] font-medium tracking-[0.08em] uppercase">
										{cluster.groupLabel}
									</p>
									<p className="text-muted-foreground text-xs tabular-nums">
										{cluster.items.length} subject{cluster.items.length === 1 ? "" : "s"}
									</p>
								</div>
							) : null}
							<div className="grid grid-cols-1 gap-3 medium:grid-cols-2">
								{cluster.items.map((s) => {
									const selected = subjectId === s.id;
									const {
										Icon: SubjectIcon,
										shellClassName,
										iconClassName,
									} = getSubjectCardIconConfig(s.name);
									const progress = subjectProgressBySubjectId[s.id];
									return (
										<button
											key={s.id}
											type="button"
											aria-pressed={selected}
											onClick={() => onPickSubject(s.id)}
											className={cn(
												"flex min-h-[4.25rem] w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow] medium:gap-4 medium:px-4",
												"focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
												selected
													? "border-emerald-600 bg-emerald-600/[0.09] dark:border-emerald-500 dark:bg-emerald-500/12"
													: "border-border bg-background/70 hover:border-emerald-600/40 hover:bg-muted/35 dark:bg-card/50",
											)}
										>
											<span
												className={cn(
													"flex size-10 shrink-0 items-center justify-center rounded-lg border medium:size-11",
													selected
														? "border-emerald-600/35 bg-emerald-600/12 text-emerald-800 ring-1 ring-emerald-600/25 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
														: cn("border-border/80 ring-1", shellClassName),
												)}
												aria-hidden
											>
												<SubjectIcon
													className={cn(
														"size-[1.125rem] medium:size-5",
														selected ?
															"text-emerald-800 dark:text-emerald-200"
														:	iconClassName,
													)}
													strokeWidth={1.75}
												/>
											</span>
											<div className="min-w-0 flex-1">
												<span className="block text-[1.0546875rem] font-medium leading-snug medium:text-base">
													{s.name}
												</span>
												{progress ?
													<span className="text-muted-foreground mt-1 block space-y-0.5 text-xs leading-snug tabular-nums">
														<span className="block">
															{progress.totalQuestions > 0 ?
																<>
																	{progress.answeredCount}/{progress.totalQuestions} answered
																</>
															:	<>{progress.answeredCount} answered</>}
															{typeof progress.topicsCovered === "number" && progress.topicsCovered > 0 ? (
																<>
																	{" · "}
																	{progress.topicsCovered} topic
																	{progress.topicsCovered === 1 ? "" : "s"}
																</>
															) : null}
															{(() => {
																const started = progress.startedAt
																	? Date.parse(progress.startedAt)
																	: 0;
																const limit = progress.timeLimitSeconds ?? 0;
																if (!started || !limit) return null;
																const left = Math.max(
																	0,
																	limit - Math.floor((Date.now() - started) / 1000),
																);
																if (left <= 0) {
																	return (
																		<span className="text-destructive"> · time up</span>
																	);
																}
																const mm = Math.floor(left / 60);
																return (
																	<span>
																		{" · "}
																		{mm}m left
																	</span>
																);
															})()}
															{" · "}
															<Link
																href={`/student/practice/${progress.testId}`}
																className="text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
																onClick={(e) => e.stopPropagation()}
															>
																Continue
															</Link>
														</span>
														{typeof progress.lastTestScore === "number" ? (
															<span className="text-foreground/70 block">
																Last graded: {Math.round(progress.lastTestScore)}%
															</span>
														) : null}
													</span>
												:	null}
											</div>
											<span
												className={cn(
													"flex size-8 shrink-0 items-center justify-center rounded-full border medium:size-9",
													selected
														? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
														: "border-border/70 bg-transparent",
												)}
												aria-hidden
											>
												{selected ? <CheckIcon className="size-4" strokeWidth={2.5} /> : null}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					))}
				</FieldGroup>
			</FieldSet>
		</div>
	);
}
