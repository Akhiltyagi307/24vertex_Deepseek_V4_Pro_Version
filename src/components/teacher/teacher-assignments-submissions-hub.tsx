"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, EyeIcon, InboxIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type {
	StudentSubmissionPerfRow,
	TeacherSubmissionAssignmentBundle,
	TopicSubmissionAggRow,
} from "@/lib/assignments/teacher-submissions-hub-types";
import type { TeacherAssignmentSubmissionRow } from "@/lib/assignments/queries";
import type { TrackerTopicStatus } from "@/lib/practice/topic-rollup";
import { cn } from "@/lib/utils";

const HANDED_IN = new Set(["submitted", "grading", "graded"]);

type Props = {
	bundles: TeacherSubmissionAssignmentBundle[];
};

type SheetVariant = "assigned" | "submitted" | "notSubmitted";

type AnalyticsState =
	| null
	| {
			bundle: TeacherSubmissionAssignmentBundle;
			step: "pick" | "topic" | "student";
	  };

function lifecycleShortLabel(status: string): string {
	const map: Record<string, string> = {
		pending_materialize: "Preparing test",
		ready: "Ready to start",
		in_progress: "In progress",
		submitted: "Submitted",
		grading: "Grading",
		graded: "Graded",
		failed_generation: "Generation failed",
		grading_failed: "Grading failed",
		late: "Late",
		excused: "Excused",
	};
	return map[status] ?? status.replaceAll("_", " ");
}

function submissionStatusBadgeVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "graded":
			return "default";
		case "failed_generation":
		case "grading_failed":
			return "destructive";
		case "ready":
		case "pending_materialize":
			return "outline";
		default:
			return "secondary";
	}
}

function topicPerfBadgeVariant(status: TrackerTopicStatus): "default" | "secondary" | "destructive" {
	if (status === "good") return "default";
	if (status === "bad") return "destructive";
	return "secondary";
}

function MetaChip({ label, value }: { label: string; value: string }) {
	return (
		<span className="inline-flex max-w-full flex-col gap-0.5 rounded-lg bg-muted/35 px-3 py-2 dark:bg-muted/20">
			<span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">{label}</span>
			<span className="truncate font-medium text-foreground text-sm">{value}</span>
		</span>
	);
}

function StatTrigger({
	label,
	value,
	onPress,
}: {
	label: string;
	value: number;
	onPress: () => void;
}) {
	return (
		<button
			type="button"
			className="min-w-[7.5rem] rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left transition-[border-color,background-color] duration-150 ease-out hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted/10"
			onClick={onPress}
		>
			<div className="text-muted-foreground text-[11px] font-medium tracking-wide">{label}</div>
			<div className="mt-1 font-mono text-2xl font-semibold text-foreground tabular-nums">{value}</div>
		</button>
	);
}

function filterRowsForSheet(bundle: TeacherSubmissionAssignmentBundle, variant: SheetVariant): TeacherAssignmentSubmissionRow[] {
	const subs = bundle.submissions;
	if (variant === "assigned") return subs;
	if (variant === "submitted") return subs.filter((s) => HANDED_IN.has(s.lifecycleStatus));
	return subs.filter((s) => !HANDED_IN.has(s.lifecycleStatus));
}

function sheetTitleParts(variant: SheetVariant): { title: string; description: string } {
	switch (variant) {
		case "assigned":
			return {
				title: "Assigned students",
				description: "Everyone this assignment was published for.",
			};
		case "submitted":
			return {
				title: "Submitted",
				description: "Learners who handed in and are in grading or complete.",
			};
		default:
			return {
				title: "Not submitted yet",
				description: "Still preparing, in progress, or waiting to start.",
			};
	}
}

export function TeacherAssignmentsSubmissionsHub({ bundles }: Props) {
	const [sheet, setSheet] = React.useState<
		null | { bundle: TeacherSubmissionAssignmentBundle; variant: SheetVariant }
	>(null);
	const [analytics, setAnalytics] = React.useState<AnalyticsState>(null);
	const [reportViewer, setReportViewer] = React.useState<null | StudentSubmissionPerfRow>(null);
	const [reportPage, setReportPage] = React.useState(0);

	React.useEffect(() => {
		setReportPage(0);
	}, [reportViewer?.studentId]);

	const sheetRows = sheet ? filterRowsForSheet(sheet.bundle, sheet.variant) : [];
	const sheetCopy = sheet ? sheetTitleParts(sheet.variant) : { title: "", description: "" };

	if (bundles.length === 0) {
		return (
			<div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-14 text-center dark:bg-muted/5">
				<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
					<InboxIcon className="size-6" aria-hidden />
				</div>
				<p className="font-medium text-foreground">No submissions yet</p>
				<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
					When you publish an assignment, each student&apos;s progress and status show up here.
				</p>
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col gap-5">
				{bundles.map((bundle) => (
					<article
						key={bundle.assignmentId}
						className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-border/40"
					>
						<div className="flex flex-col gap-5 p-5 medium:flex-row medium:items-start medium:justify-between medium:gap-8 medium:p-6">
							<div
								className="min-w-0 flex-1 cursor-pointer rounded-xl outline-none transition-colors hover:bg-muted/15 focus-visible:ring-2 focus-visible:ring-ring medium:-m-2 medium:p-2"
								role="button"
								tabIndex={0}
								onClick={() => setAnalytics({ bundle, step: "pick" })}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										setAnalytics({ bundle, step: "pick" });
									}
								}}
							>
								<h2 className="font-semibold text-foreground text-lg tracking-tight">{bundle.title}</h2>
								{bundle.dueAt ?
									<p className="mt-1 text-muted-foreground text-sm">
										Due {new Date(bundle.dueAt).toLocaleString()}
									</p>
								:	null}
								<div className="mt-4 flex flex-wrap gap-3">
									<MetaChip label="Subject" value={bundle.subjectName ?? "—"} />
									<MetaChip
										label="Grade"
										value={bundle.subjectGrade != null ? String(bundle.subjectGrade) : "—"}
									/>
									<MetaChip label="Section" value={bundle.sectionsLabel} />
								</div>
								<p className="mt-3 text-muted-foreground text-xs leading-relaxed">
									Click this card for topic or student performance summaries.
								</p>
							</div>

							<div className="flex shrink-0 flex-wrap gap-3 medium:flex-nowrap medium:justify-end">
								<StatTrigger
									label="Assigned"
									value={bundle.counts.assigned}
									onPress={() => setSheet({ bundle, variant: "assigned" })}
								/>
								<StatTrigger
									label="Submitted"
									value={bundle.counts.submitted}
									onPress={() => setSheet({ bundle, variant: "submitted" })}
								/>
								<StatTrigger
									label="Not submitted"
									value={bundle.counts.notSubmitted}
									onPress={() => setSheet({ bundle, variant: "notSubmitted" })}
								/>
							</div>
						</div>
					</article>
				))}
			</div>

			<Sheet open={sheet != null} onOpenChange={(open) => !open && setSheet(null)}>
				<SheetContent side="right" className="w-full max-w-[min(100vw-1rem,26rem)] gap-0 p-0 medium:max-w-md">
					<SheetHeader className="border-border border-b p-5 text-left">
						<SheetTitle className="text-lg">{sheetCopy.title}</SheetTitle>
						<SheetDescription>{sheetCopy.description}</SheetDescription>
						{sheet ?
							<p className="mt-2 text-muted-foreground text-xs">
								Assignment: <span className="font-medium text-foreground">{sheet.bundle.title}</span>
							</p>
						:	null}
					</SheetHeader>
					<div className="flex max-h-[calc(100vh-9rem)] flex-col gap-2 overflow-y-auto p-4">
						{sheetRows.length === 0 ?
							<p className="text-muted-foreground text-sm">No students in this list.</p>
						:	sheetRows.map((row) => (
								<div
									key={`${sheet!.bundle.assignmentId}-${row.studentId}-${sheet!.variant}`}
									className="rounded-xl border border-border/60 bg-muted/15 px-3 py-3 dark:bg-muted/10"
								>
									<p className="font-medium text-foreground">{row.studentFullName}</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										Grade {row.studentGrade ?? "—"} · Section {row.studentSection ?? "—"}
									</p>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<Badge variant={submissionStatusBadgeVariant(row.lifecycleStatus)} className="font-normal">
											{lifecycleShortLabel(row.lifecycleStatus)}
										</Badge>
										{row.score != null && row.score !== "" ?
											<span className="font-mono text-muted-foreground text-xs tabular-nums">
												{Number(row.score).toFixed(1)}%
											</span>
										:	null}
									</div>
								</div>
							))
						}
					</div>
				</SheetContent>
			</Sheet>

			<Dialog
				open={analytics != null}
				onOpenChange={(open) => {
					if (!open) setAnalytics(null);
				}}
			>
				<DialogContent
					showCloseButton
					className="max-h-[min(90vh,920px)] gap-0 overflow-y-auto p-0 medium:max-w-[min(96vw,52rem)]"
				>
					{analytics?.step === "pick" ?
						<>
							<DialogHeader className="p-5 pb-4">
								<DialogTitle className="text-xl">{analytics.bundle.title}</DialogTitle>
								<DialogDescription>Pick a lens for this assignment.</DialogDescription>
							</DialogHeader>
							<div className="grid gap-3 border-border border-t px-5 py-5 medium:grid-cols-2">
								<Button
									type="button"
									variant="outline"
									className="h-auto min-h-[5.5rem] flex-col items-start gap-1 whitespace-normal rounded-xl px-4 py-4 text-left"
									onClick={() => setAnalytics({ ...analytics, step: "topic" })}
								>
									<span className="font-semibold text-foreground">Performance by topic</span>
									<span className="text-muted-foreground text-xs font-normal leading-snug">
										Cumulative scores and good or satisfactory or bad counts per syllabus topic (graded
										tests only).
									</span>
								</Button>
								<Button
									type="button"
									variant="outline"
									className="h-auto min-h-[5.5rem] flex-col items-start gap-1 whitespace-normal rounded-xl px-4 py-4 text-left"
									onClick={() => setAnalytics({ ...analytics, step: "student" })}
								>
									<span className="font-semibold text-foreground">Performance by student</span>
									<span className="text-muted-foreground text-xs font-normal leading-snug">
										One row per learner with PDF download and an in-browser preview.
									</span>
								</Button>
							</div>
						</>
					:	null}

					{analytics?.step === "topic" ?
						<TopicPerformancePanel
							bundle={analytics.bundle}
							onBack={() => setAnalytics({ ...analytics, step: "pick" })}
							onClose={() => setAnalytics(null)}
						/>
					:	null}

					{analytics?.step === "student" ?
						<StudentPerformancePanel
							bundle={analytics.bundle}
							onOpenReport={(s) => {
								setReportViewer(s);
								setAnalytics(null);
							}}
							onBack={() => setAnalytics({ ...analytics, step: "pick" })}
							onClose={() => setAnalytics(null)}
						/>
					:	null}
				</DialogContent>
			</Dialog>

			<Dialog open={reportViewer != null} onOpenChange={(open) => !open && setReportViewer(null)}>
				<DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 medium:max-w-[min(96vw,44rem)]">
					{reportViewer ?
						<>
							<DialogHeader className="border-border border-b p-5 pb-4">
								<DialogTitle>{reportViewer.studentFullName}</DialogTitle>
								<DialogDescription>
									Page {reportPage + 1} of 2 · Performance preview, then printable PDF layout.
								</DialogDescription>
							</DialogHeader>

							<div className="flex items-center justify-between border-border border-b bg-muted/20 px-4 py-2 dark:bg-muted/10">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={reportPage <= 0}
									onClick={() => setReportPage((p) => Math.max(0, p - 1))}
								>
									<ChevronLeftIcon className="size-4" aria-hidden />
									Previous
								</Button>
								<span className="text-muted-foreground text-xs tabular-nums">{reportPage + 1} / 2</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={reportPage >= 1}
									onClick={() => setReportPage((p) => Math.min(1, p + 1))}
								>
									Next
									<ChevronRightIcon className="size-4" aria-hidden />
								</Button>
							</div>

							<div className="max-h-[calc(90vh-11rem)] overflow-y-auto p-5">
								{reportPage === 0 ?
									<ReportAnalyticsPreview student={reportViewer} />
								:	reportViewer.testId ?
									<div className="space-y-2">
										<p className="text-muted-foreground text-xs leading-relaxed">
											Embedded PDF matches the downloadable report. Use browser controls to zoom if needed.
										</p>
										<iframe
											title={`Report PDF for ${reportViewer.studentFullName}`}
											className="h-[min(68vh,560px)] w-full rounded-xl border border-border bg-background"
											src={`/api/teacher/reports/${reportViewer.testId}/pdf?view=1`}
										/>
									</div>
								:	<p className="text-muted-foreground text-sm">No graded test PDF is available yet.</p>}
							</div>

							<div className="flex flex-wrap gap-2 border-border border-t bg-muted/15 p-4 dark:bg-muted/10">
								{reportViewer.testId ?
									<a
										className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1")}
										href={`/api/teacher/reports/${reportViewer.testId}/pdf`}
										download
										target="_blank"
										rel="noreferrer"
									>
										<DownloadIcon className="size-4" aria-hidden />
										Download PDF
									</a>
								:	null}
								<Button type="button" variant="secondary" size="sm" onClick={() => setReportViewer(null)}>
									Close
								</Button>
							</div>
						</>
					:	null}
				</DialogContent>
			</Dialog>
		</>
	);
}

function TopicPerformancePanel({
	bundle,
	onBack,
	onClose,
}: {
	bundle: TeacherSubmissionAssignmentBundle;
	onBack: () => void;
	onClose: () => void;
}) {
	const rows = bundle.topicAnalytics;
	const hasSamples = rows.some((r) => r.sampleStudents > 0);

	return (
		<>
			<DialogHeader className="border-border border-b p-5 pb-4">
				<DialogTitle>Performance by topic</DialogTitle>
				<DialogDescription>{bundle.title}</DialogDescription>
			</DialogHeader>
			<div className="overflow-x-auto px-5 py-4">
				{!hasSamples ?
					<p className="text-muted-foreground text-sm leading-relaxed">
						No graded topic breakdowns yet. As soon as tests finish grading, roll-ups appear here using each
						report&apos;s topic scores.
					</p>
				:	<table className="w-full min-w-[40rem] border-collapse text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/40 text-left dark:bg-muted/20">
								<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
									Topic
								</th>
								<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
									Cumulative %
								</th>
								<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
									Bad
								</th>
								<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
									Satisfactory
								</th>
								<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
									Good
								</th>
								<th scope="col" className="px-3 py-3 font-medium text-muted-foreground text-xs">
									Graded n
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<TopicPerfRow key={row.topicId} row={row} />
							))}
						</tbody>
					</table>
				}
			</div>
			<div className="flex flex-wrap gap-2 border-border border-t bg-muted/15 px-5 py-4 dark:bg-muted/10">
				<Button type="button" variant="outline" size="sm" onClick={onBack}>
					Back
				</Button>
				<Button type="button" variant="secondary" size="sm" onClick={onClose}>
					Close
				</Button>
			</div>
		</>
	);
}

function TopicPerfRow({ row }: { row: TopicSubmissionAggRow }) {
	return (
		<tr className="border-border border-b last:border-b-0 hover:bg-muted/20">
			<th scope="row" className="max-w-[14rem] px-3 py-3 text-left align-middle font-normal text-foreground leading-snug">
				{row.topicName}
			</th>
			<td className="px-3 py-3 align-middle font-mono text-xs tabular-nums">
				{row.cumulativePercent != null ? `${row.cumulativePercent.toFixed(1)}%` : "—"}
			</td>
			<td className="px-3 py-3 align-middle font-mono text-xs tabular-nums">{row.badCount}</td>
			<td className="px-3 py-3 align-middle font-mono text-xs tabular-nums">{row.satisfactoryCount}</td>
			<td className="px-3 py-3 align-middle font-mono text-xs tabular-nums">{row.goodCount}</td>
			<td className="px-3 py-3 align-middle text-muted-foreground text-xs tabular-nums">{row.sampleStudents}</td>
		</tr>
	);
}

function StudentPerformancePanel({
	bundle,
	onOpenReport,
	onBack,
	onClose,
}: {
	bundle: TeacherSubmissionAssignmentBundle;
	onOpenReport: (s: StudentSubmissionPerfRow) => void;
	onBack: () => void;
	onClose: () => void;
}) {
	const rows = bundle.studentsPerformance;

	return (
		<>
			<DialogHeader className="border-border border-b p-5 pb-4">
				<DialogTitle>Performance by student</DialogTitle>
				<DialogDescription>{bundle.title}</DialogDescription>
			</DialogHeader>
			<div className="overflow-x-auto px-2 py-4 medium:px-5">
				<table className="w-full min-w-[36rem] border-collapse text-sm">
					<thead>
						<tr className="border-border border-b bg-muted/40 text-left dark:bg-muted/20">
							<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
								Student
							</th>
							<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
								Section
							</th>
							<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
								Status
							</th>
							<th scope="col" className="px-3 py-3 font-medium text-foreground text-xs">
								Score
							</th>
							<th scope="col" className="px-3 py-3 font-medium text-muted-foreground text-xs">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.studentId} className="border-border border-b last:border-b-0 hover:bg-muted/15">
								<td className="px-3 py-3 align-middle font-medium text-foreground">{row.studentFullName}</td>
								<td className="px-3 py-3 align-middle text-muted-foreground text-xs">{row.studentSection ?? "—"}</td>
								<td className="px-3 py-3 align-middle">
									<Badge variant={submissionStatusBadgeVariant(row.lifecycleStatus)} className="font-normal">
										{lifecycleShortLabel(row.lifecycleStatus)}
									</Badge>
								</td>
								<td className="px-3 py-3 align-middle font-mono text-xs tabular-nums">
									{row.scorePercent != null ? `${row.scorePercent.toFixed(1)}%` : "—"}
								</td>
								<td className="px-3 py-3 align-middle">
									<div className="flex flex-wrap gap-2">
										{row.lifecycleStatus === "graded" && row.testId ?
											<>
												<a
													className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1")}
													href={`/api/teacher/reports/${row.testId}/pdf`}
													download
													target="_blank"
													rel="noreferrer"
												>
													<DownloadIcon className="size-3.5" aria-hidden />
													Download
												</a>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													className="gap-1"
													onClick={() => onOpenReport(row)}
												>
													<EyeIcon className="size-3.5" aria-hidden />
													View
												</Button>
											</>
										:	<span className="text-muted-foreground text-xs">—</span>}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-wrap gap-2 border-border border-t bg-muted/15 px-5 py-4 dark:bg-muted/10">
				<Button type="button" variant="outline" size="sm" onClick={onBack}>
					Back
				</Button>
				<Button type="button" variant="secondary" size="sm" onClick={onClose}>
					Close
				</Button>
			</div>
		</>
	);
}

function ReportAnalyticsPreview({ student }: { student: StudentSubmissionPerfRow }) {
	const overall = student.previewOverallPercent ?? student.scorePercent;

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-border/70 bg-muted/20 p-5 dark:bg-muted/10">
				<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Overall</p>
				<p className="mt-2 font-mono text-4xl font-semibold text-foreground tabular-nums">
					{overall != null ? `${overall.toFixed(1)}%` : "—"}
				</p>
				<p className="mt-2 text-muted-foreground text-xs leading-relaxed">
					Mirrors the headline score from the AI report. Topic rows reflect each syllabus strip inside the PDF.
				</p>
			</div>

			{student.previewTopics.length === 0 ?
				<p className="text-muted-foreground text-sm">No topic breakdown stored on this report yet.</p>
			:	<div className="overflow-x-auto rounded-xl border border-border/70">
					<table className="w-full min-w-[28rem] border-collapse text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/35 text-left dark:bg-muted/15">
								<th scope="col" className="px-3 py-2.5 font-medium text-foreground text-xs">
									Topic
								</th>
								<th scope="col" className="px-3 py-2.5 font-medium text-foreground text-xs">
									Avg %
								</th>
								<th scope="col" className="px-3 py-2.5 font-medium text-foreground text-xs">
									Band
								</th>
							</tr>
						</thead>
						<tbody>
							{student.previewTopics.map((t, i) => (
								<tr key={`${t.topicName}-${i}`} className="border-border border-b last:border-b-0">
									<td className="px-3 py-2.5 align-middle text-foreground">{t.topicName}</td>
									<td className="px-3 py-2.5 align-middle font-mono text-xs tabular-nums">
										{t.averagePercent.toFixed(1)}%
									</td>
									<td className="px-3 py-2.5 align-middle">
										<Badge variant={topicPerfBadgeVariant(t.status)} className="font-normal capitalize">
											{t.status}
										</Badge>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			}
		</div>
	);
}
