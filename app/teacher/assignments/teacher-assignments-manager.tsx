"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardListIcon } from "lucide-react";

import { createTeacherAssignmentAction, type CreateTeacherAssignmentState } from "./actions";
import type {
	AssignmentTopicCatalogRow,
	TeacherAssignmentSummaryRow,
} from "@/lib/assignments/queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-queries";

type Props = {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	assignments: TeacherAssignmentSummaryRow[];
};

const initialState: CreateTeacherAssignmentState = { ok: false, message: "" };

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className="inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{pending ? "Publishing…" : "Publish assignment"}
		</button>
	);
}

function metricLabel(value: number, label: string) {
	return (
		<div className="rounded-lg border border-border/70 bg-background px-3 py-2">
			<div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
			<div className="text-xs text-muted-foreground">{label}</div>
		</div>
	);
}

export function TeacherAssignmentsManager({
	subjectsCatalog,
	topicsCatalog,
	students,
	assignments,
}: Props) {
	const [state, formAction] = useActionState(createTeacherAssignmentAction, initialState);
	const [subjectId, setSubjectId] = React.useState(subjectsCatalog[0]?.id ?? "");
	const topicsForSubject = topicsCatalog.filter((topic) => topic.subjectId === subjectId);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 py-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Practice assignments</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						Assign AI-generated practice tests to selected students. You choose the subject and topics; each
						student receives their own generated test.
					</p>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<form
					action={formAction}
					className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
				>
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:text-violet-300">
							<ClipboardListIcon className="size-5" aria-hidden="true" />
						</div>
						<div>
							<h2 className="font-semibold">Create assignment</h2>
							<p className="text-sm text-muted-foreground">Materialization jobs are staggered automatically.</p>
						</div>
					</div>

					<label className="block space-y-1.5">
						<span className="text-sm font-medium">Title</span>
						<input
							name="title"
							required
							maxLength={300}
							placeholder="Algebra checkpoint"
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
						/>
					</label>

					<label className="block space-y-1.5">
						<span className="text-sm font-medium">Instructions</span>
						<textarea
							name="instructions"
							rows={3}
							placeholder="Tell students how to approach this test."
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
						/>
					</label>

					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">Subject</span>
							<select
								name="subject_id"
								value={subjectId}
								onChange={(event) => setSubjectId(event.target.value)}
								required
								className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
							>
								{subjectsCatalog.map((subject) => (
									<option key={subject.id} value={subject.id}>
										Grade {subject.grade} · {subject.name}
									</option>
								))}
							</select>
						</label>

						<label className="block space-y-1.5">
							<span className="text-sm font-medium">Difficulty</span>
							<select
								name="difficulty"
								defaultValue="medium"
								className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
							>
								<option value="easy">Easy</option>
								<option value="medium">Medium</option>
								<option value="hard">Hard</option>
							</select>
						</label>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">Duration</span>
							<select
								name="time_limit_seconds"
								defaultValue="3600"
								className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
							>
								<option value="3600">1 hour · 15 questions</option>
								<option value="10800">3 hours · 30 questions</option>
							</select>
						</label>
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">Due date</span>
							<input
								name="due_at"
								type="datetime-local"
								className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-violet-500"
							/>
						</label>
					</div>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Topics</legend>
						<div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border/80 bg-muted/15 p-3">
							{topicsForSubject.length === 0 ? (
								<p className="text-sm text-muted-foreground">No active topics found for this subject.</p>
							) : (
								topicsForSubject.map((topic) => (
									<label key={topic.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background">
										<input name="topic_ids" type="checkbox" value={topic.id} className="mt-1" />
										<span>
											<span className="font-medium">{topic.topicName}</span>
											<span className="block text-xs text-muted-foreground">
												{topic.unitName} · {topic.chapterName}
											</span>
										</span>
									</label>
								))
							)}
						</div>
					</fieldset>

					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Students</legend>
						<div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border/80 bg-muted/15 p-3">
							{students.length === 0 ? (
								<p className="text-sm text-muted-foreground">No reachable students yet.</p>
							) : (
								students.map((student) => (
									<label key={student.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background">
										<input name="student_ids" type="checkbox" value={student.id} />
										<span className="min-w-0">
											<span className="block truncate font-medium">{student.fullName}</span>
											<span className="text-xs text-muted-foreground">
												Grade {student.grade ?? "—"} · Section {student.section ?? "—"}
											</span>
										</span>
									</label>
								))
							)}
						</div>
					</fieldset>

					{state.message ? (
						<p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
					) : null}

					<SubmitButton />
				</form>

				<section className="space-y-4">
					{assignments.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
							<p className="font-medium">No assignments yet</p>
							<p className="mt-2 text-sm text-muted-foreground">
								Published assignments and completion analytics will appear here.
							</p>
						</div>
					) : (
						assignments.map((assignment) => (
							<article key={assignment.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
								<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<h2 className="font-semibold">{assignment.title}</h2>
										<p className="text-sm text-muted-foreground">
											{assignment.subjectName ?? "Subject"} · {assignment.config.topic_ids.length} topic
											{assignment.config.topic_ids.length === 1 ? "" : "s"}
										</p>
									</div>
									<p className="text-xs text-muted-foreground">
										{assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleString()}` : "No due date"}
									</p>
								</div>
								<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
									{metricLabel(assignment.counts.assigned, "Assigned")}
									{metricLabel(assignment.counts.ready, "Ready")}
									{metricLabel(
										assignment.counts.inProgress +
											assignment.counts.submitted +
											assignment.counts.grading +
											assignment.counts.graded +
											assignment.counts.gradingFailed,
										"Taken",
									)}
									{metricLabel(assignment.counts.grading + assignment.counts.submitted + assignment.counts.gradingFailed, "Grading")}
									{metricLabel(assignment.counts.graded, "Graded")}
								</div>
								{assignment.averageScore != null ? (
									<p className="mt-3 text-sm text-muted-foreground">
										Average score:{" "}
										<span className="font-mono text-foreground tabular-nums">{assignment.averageScore.toFixed(1)}%</span>
									</p>
								) : null}
							</article>
						))
					)}
				</section>
			</div>
		</div>
	);
}
