"use client";

import Link from "next/link";
import { ArrowUpRight, Target, TrendingUp } from "lucide-react";

import { cardSurfaceFrameClassName } from "@/components/ui/card";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import { cn } from "@/lib/utils";

function studentPerformanceHref(subjectId: string | "all") {
	if (subjectId === "all") return "/teacher/student-performance";
	const q = new URLSearchParams({ subject: subjectId });
	return `/teacher/student-performance?${q.toString()}`;
}

function formatPercent(value: number | null) {
	return value == null ? "No score yet" : `${Math.round(value)}%`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

function LoadingState() {
	return (
		<div className="mt-5 grid gap-5 medium:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-hidden>
			<div className="space-y-3">
				<div className="h-10 w-28 animate-pulse rounded-lg bg-muted/60" />
				<div className="h-4 w-48 animate-pulse rounded bg-muted/50" />
				<div className="h-4 w-36 animate-pulse rounded bg-muted/40" />
			</div>
			<div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
				<div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
				<div className="h-5 w-56 animate-pulse rounded bg-muted/60" />
				<div className="h-4 w-full animate-pulse rounded bg-muted/40" />
			</div>
		</div>
	);
}

type Props = {
	subjectId: string | "all";
	scopeLabel: string;
	activeOrganizationName: string | null;
	linkedStudentCount: number;
	summary: TeacherClassPerformanceSummary | null;
	error: string | null;
	pending: boolean;
	className?: string;
};

export function TeacherDashboardClassPerformanceCard({
	subjectId,
	scopeLabel,
	activeOrganizationName,
	linkedStudentCount,
	summary,
	error,
	pending,
	className,
}: Props) {
	const noStudents = summary?.studentsInScope === 0;
	const hasAverage = summary?.classAveragePercent != null;
	const opportunity = summary?.upliftOpportunity ?? null;

	return (
		<section
			className={cn(cardSurfaceFrameClassName, "flex min-h-[min(40vh,20rem)] flex-col p-6 text-left", className)}
			aria-busy={pending}
			aria-live="polite"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-sm font-medium text-foreground">Class performance</p>
					<p className="mt-1 text-muted-foreground text-xs leading-snug">Scope: {scopeLabel}</p>
				</div>
				<TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
			</div>

			{error ? (
				<p className="mt-3 text-destructive text-xs" role="alert">
					{error}
				</p>
			) : null}

			{pending && summary == null ? (
				<LoadingState />
			) : noStudents ? (
				<div className="mt-6 max-w-2xl space-y-3">
					<p className="text-2xl font-semibold tracking-tight text-foreground">No students in scope</p>
					<p className="text-muted-foreground text-sm leading-normal">
						{activeOrganizationName
							? `No learners match these filters for ${activeOrganizationName}. Adjust the scope or review your teaching placement.`
							: linkedStudentCount > 0
								? "Your linked students do not match this scope yet. Adjust the filters or add another learner."
								: "Link students first, then this card will show the recent class average and the strongest topic to revisit."}
					</p>
					<Link href="/teacher/students" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
						Manage linked students
						<ArrowUpRight className="size-3.5" aria-hidden />
					</Link>
				</div>
			) : (
				<div className="mt-5 grid min-h-0 flex-1 gap-5 medium:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
					<div className="flex min-w-0 flex-col">
						<p className="text-muted-foreground text-xs">Recent class average</p>
						<p className="mt-2 text-4xl font-semibold tracking-tight text-foreground tabular-nums">
							{formatPercent(summary?.classAveragePercent ?? null)}
						</p>
						<p className="mt-3 text-muted-foreground text-sm leading-normal">
							{hasAverage && summary ? (
								<>
									{summary.studentsWithRecentScores} of {summary.studentsInScope} students have recent graded work.
									Latest {summary.recentWindowSize} items per student are used.
								</>
							) : (
								"No graded work is available for this scope yet. Publish an assignment or wait for practice tests to be graded."
							)}
						</p>
						<Link
							href={studentPerformanceHref(subjectId)}
							className="mt-auto inline-flex w-fit items-center gap-1 pt-5 text-sm underline underline-offset-4"
						>
							View student performance
							<ArrowUpRight className="size-3.5" aria-hidden />
						</Link>
					</div>

					<div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-4">
						<div className="flex items-start gap-2">
							<Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
							<div className="min-w-0">
								<p className="text-sm font-medium text-foreground">Score uplift opportunity</p>
								{opportunity ? (
									<div className="mt-3 space-y-3">
										<div>
											<p className="line-clamp-2 text-base font-medium leading-snug text-foreground">
												{opportunity.topicName}
											</p>
											<p className="mt-1 text-muted-foreground text-xs">{opportunity.subjectName}</p>
										</div>
										<p className="text-muted-foreground text-sm leading-normal">
											Average {Math.round(opportunity.averagePercent)}% across{" "}
											{pluralize(opportunity.studentsTested, "student")};{" "}
											{pluralize(opportunity.studentsBelowSupportLine, "student")} below 60%.
										</p>
										<p className="text-muted-foreground text-xs leading-normal">
											Use this topic for the next review block or targeted practice set.
										</p>
									</div>
								) : (
									<p className="mt-3 text-muted-foreground text-sm leading-normal">
										There is not enough tested topic data in this scope to recommend a focused review area yet.
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
