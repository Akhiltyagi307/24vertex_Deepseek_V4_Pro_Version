"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { panelRaisedInputClass } from "@/app/student/settings/_settings-form-styles";
import {
	publishManualAssignmentAction,
	saveManualAssignmentDraftAction,
	updatePublishedManualAssignmentAction,
	type ManualAssignmentActionState,
} from "@/app/teacher/(protected)/assignments/manual-actions";
import { AssignmentDueDatetimeField } from "@/components/teacher/assignment-due-datetime-field";
import {
	ManualQuestionEditor,
	emptyManualQuestionDraft,
	type ManualQuestionDraft,
} from "@/components/teacher/manual/manual-question-editor";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { manualDraftToQuestionInput } from "@/lib/assignments/manual-helpers";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [
	{ value: 1800, label: "30 minutes" },
	{ value: 2700, label: "45 minutes" },
	{ value: 3600, label: "1 hour" },
	{ value: 5400, label: "1.5 hours" },
	{ value: 7200, label: "2 hours" },
	{ value: 10800, label: "3 hours" },
];

/**
 * Stored due date is a UTC ISO string; `datetime-local` needs a local
 * `YYYY-MM-DDTHH:mm` value (no zone/seconds) or it renders blank. Mirrors the
 * AI form's `dateToDueAtFieldValue`, so the submitted format round-trips.
 */
function isoToDueAtFieldValue(iso: string | null | undefined): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (!Number.isFinite(date.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Friendly fallback shown when a manual action throws (DB error, concurrent edit, …). */
function manualActionErrorMessage(): string {
	return "Something went wrong saving your assignment. Your work is still here — please try again.";
}

export type ManualBuilderEditTarget = {
	assignmentId: string;
	status: "draft" | "published";
	title: string;
	instructions: string | null;
	subjectId: string;
	timeLimitSeconds: number;
	difficulty: "easy" | "medium" | "hard";
	dueAt: string | null;
	drafts: ManualQuestionDraft[];
};

const inputFocusRing =
	"outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

export function TeacherManualAssignmentBuilder({
	subjectsCatalog,
	topicsCatalog,
	students,
	editTarget,
}: {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	editTarget?: ManualBuilderEditTarget;
}) {
	const router = useRouter();
	const isEditingPublished = editTarget?.status === "published";

	// Hydration-stable question ids. A module-level counter drifts on the server
	// across requests, so the SSR'd radio `name="correct-<id>"` mismatches the
	// client's freshly-reset counter → hydration error. useId() gives a per-instance
	// base identical on server and client; the ref only advances client-side as
	// questions are added. The base is also distinct from the edit page's
	// `q-<index>` seed ids, so newly-added and loaded questions never collide.
	const questionIdBase = React.useId();
	const questionSeqRef = React.useRef(0);
	const makeQuestionId = () => `${questionIdBase}q${questionSeqRef.current++}`;

	const [title, setTitle] = React.useState(editTarget?.title ?? "");
	const [instructions, setInstructions] = React.useState(editTarget?.instructions ?? "");
	const [subjectId, setSubjectId] = React.useState(editTarget?.subjectId ?? subjectsCatalog[0]?.id ?? "");
	const [timeLimit, setTimeLimit] = React.useState(editTarget?.timeLimitSeconds ?? 3600);
	const [difficulty, setDifficulty] = React.useState<"easy" | "medium" | "hard">(editTarget?.difficulty ?? "medium");
	const [dueAt, setDueAt] = React.useState(() => isoToDueAtFieldValue(editTarget?.dueAt));
	const [draftId, setDraftId] = React.useState<string | null>(editTarget?.assignmentId ?? null);
	const [questions, setQuestions] = React.useState<ManualQuestionDraft[]>(
		editTarget?.drafts.length ? editTarget.drafts : [emptyManualQuestionDraft(makeQuestionId())],
	);
	const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);
	const [pending, setPending] = React.useState(false);
	const [state, setState] = React.useState<ManualAssignmentActionState | null>(null);

	const topicsForSubject = React.useMemo(
		() => topicsCatalog.filter((t) => t.subjectId === subjectId),
		[topicsCatalog, subjectId],
	);
	const subjectGrade = React.useMemo(
		() => subjectsCatalog.find((s) => s.id === subjectId)?.grade ?? null,
		[subjectsCatalog, subjectId],
	);
	const studentsForSubject = React.useMemo(
		() => (subjectGrade == null ? students : students.filter((s) => s.grade === subjectGrade)),
		[students, subjectGrade],
	);

	// When the subject (and thus the grade filter) changes, drop any selected
	// students who are no longer visible, so hidden stale recipients can't be
	// published invisibly.
	const studentIdsForSubject = React.useMemo(
		() => new Set(studentsForSubject.map((s) => s.id)),
		[studentsForSubject],
	);
	React.useEffect(() => {
		setSelectedStudentIds((prev) => {
			const next = prev.filter((id) => studentIdsForSubject.has(id));
			return next.length === prev.length ? prev : next;
		});
	}, [studentIdsForSubject]);

	function buildPayloadQuestions() {
		return questions.map(manualDraftToQuestionInput);
	}

	const canPublish = !pending && (isEditingPublished || selectedStudentIds.length > 0);

	async function onSaveDraft() {
		setPending(true);
		setState(null);
		try {
			const res = await saveManualAssignmentDraftAction({
				assignment_id: draftId,
				title,
				instructions: instructions || null,
				subject_id: subjectId,
				difficulty,
				time_limit_seconds: timeLimit,
				due_at: dueAt || null,
				questions: buildPayloadQuestions(),
				student_ids: selectedStudentIds,
			});
			setState(res);
			if (res.ok) {
				if (res.assignmentId) setDraftId(res.assignmentId);
				router.refresh();
			}
		} catch {
			setState({ ok: false, message: manualActionErrorMessage() });
		} finally {
			setPending(false);
		}
	}

	async function onPublish() {
		setPending(true);
		setState(null);
		try {
			const res = isEditingPublished
				? await updatePublishedManualAssignmentAction({
						assignment_id: editTarget!.assignmentId,
						title,
						instructions: instructions || null,
						subject_id: subjectId,
						difficulty,
						time_limit_seconds: timeLimit,
						due_at: dueAt || null,
						questions: buildPayloadQuestions(),
					})
				: await publishManualAssignmentAction(
						{
							title,
							instructions: instructions || null,
							subject_id: subjectId,
							difficulty,
							time_limit_seconds: timeLimit,
							due_at: dueAt || null,
							questions: buildPayloadQuestions(),
							student_ids: selectedStudentIds,
						},
						draftId ?? undefined,
					);
			setState(res);
			if (res.ok) router.refresh();
		} catch {
			setState({ ok: false, message: manualActionErrorMessage() });
		} finally {
			setPending(false);
		}
	}

	const inputClass = cn(panelRaisedInputClass, "w-full rounded-lg border border-input", inputFocusRing);

	return (
		<div className="space-y-10 rounded-2xl border border-border/70 bg-card p-5 shadow-sm medium:space-y-11 medium:p-7">
			{isEditingPublished ? (
				<p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
					Editing a published assignment. Changes apply only to students who haven&apos;t started yet; students who
					already started or finished keep their original test.
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-5 border-border/50 border-b pb-8">
				<div
					className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/16"
					aria-hidden
				>
					<ClipboardList className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="font-semibold text-foreground text-lg tracking-tight">New assignment</h2>
				</div>
			</div>

			<section className="space-y-5" aria-labelledby="manual-basics-heading">
				<div className="flex items-center gap-3">
					<h3 id="manual-basics-heading" className="shrink-0 font-medium text-foreground text-sm">
						Basics
					</h3>
					<Separator className="flex-1" />
				</div>
				<div className="space-y-5">
					<label className="block space-y-2">
						<span className="font-medium text-foreground text-sm">Title</span>
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={300}
							placeholder="Algebra checkpoint"
							className={inputClass}
						/>
					</label>
					<label className="block space-y-2">
						<span className="font-medium text-foreground text-sm">Instructions</span>
						<span className="sr-only">Optional</span>
						<textarea
							rows={4}
							value={instructions}
							onChange={(e) => setInstructions(e.target.value)}
							placeholder="Tell students how to approach this test."
							className={cn(inputClass, "min-h-[6.5rem] resize-y")}
						/>
					</label>
				</div>
			</section>

			<section className="space-y-5" aria-labelledby="manual-test-heading">
				<div className="flex items-center gap-3">
					<h3 id="manual-test-heading" className="shrink-0 font-medium text-foreground text-sm">
						Test design
					</h3>
					<Separator className="flex-1" />
				</div>
				<div className="grid gap-5 medium:grid-cols-2">
					<label className="block min-w-0 space-y-2">
						<span className="font-medium text-foreground text-sm">Subject</span>
						<NativeSelect
							value={subjectId}
							onChange={(e) => setSubjectId(e.target.value)}
							disabled={isEditingPublished}
							className={cn("max-w-full rounded-lg border border-input", inputFocusRing)}
						>
							{subjectsCatalog.map((s) => (
								<option key={s.id} value={s.id}>
									Grade {s.grade} · {s.name}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block min-w-0 space-y-2">
						<span className="font-medium text-foreground text-sm">Duration</span>
						<NativeSelect
							value={timeLimit}
							onChange={(e) => setTimeLimit(Number(e.target.value))}
							className={cn("rounded-lg border border-input", inputFocusRing)}
						>
							{DURATION_OPTIONS.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block min-w-0 space-y-2">
						<span className="font-medium text-foreground text-sm">Difficulty</span>
						<NativeSelect
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
							className={cn("rounded-lg border border-input", inputFocusRing)}
						>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</NativeSelect>
					</label>
				</div>
			</section>

			<section className="space-y-5" aria-labelledby="manual-due-heading">
				<div className="flex items-center gap-3">
					<h3 id="manual-due-heading" className="shrink-0 font-medium text-foreground text-sm">
						Due date
					</h3>
					<Separator className="flex-1" />
				</div>
				<AssignmentDueDatetimeField
					id="teacher-manual-due"
					labelledByHeadingId="manual-due-heading"
					className="min-w-0"
					value={dueAt}
					onValueChange={setDueAt}
				/>
			</section>

			<section className="space-y-5" aria-labelledby="manual-questions-heading">
				<div className="flex items-center gap-3">
					<h3 id="manual-questions-heading" className="shrink-0 font-medium text-foreground text-sm">
						Questions
					</h3>
					<Separator className="flex-1" />
				</div>
				<p className="text-right text-muted-foreground text-xs tabular-nums" aria-live="polite">
					{questions.length} question{questions.length === 1 ? "" : "s"}
				</p>
				<div className="space-y-5">
					{questions.map((q, i) => (
						<ManualQuestionEditor
							key={q.id}
							index={i}
							draft={q}
							topics={topicsForSubject}
							onChange={(next) => setQuestions((prev) => prev.map((p) => (p.id === q.id ? next : p)))}
							onRemove={() => setQuestions((prev) => prev.filter((p) => p.id !== q.id))}
						/>
					))}
					<button
						type="button"
						onClick={() => setQuestions((prev) => [...prev, emptyManualQuestionDraft(makeQuestionId())])}
						className="w-full rounded-lg border border-dashed border-border/70 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/40"
					>
						+ Add question
					</button>
				</div>
			</section>

			{!isEditingPublished ? (
				<section className="space-y-5" aria-labelledby="manual-roster-heading">
					<div className="flex items-center gap-3">
						<h3 id="manual-roster-heading" className="shrink-0 font-medium text-foreground text-sm">
							Students
						</h3>
						<Separator className="flex-1" />
					</div>
					<div className="space-y-5">
						{studentsForSubject.length > 0 ? (
							<p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
								{subjectGrade != null ? `Grade ${subjectGrade} · ` : ""}
								Recipients {selectedStudentIds.length}
							</p>
						) : null}
						<div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/15 p-3 dark:bg-muted/10">
							{studentsForSubject.length === 0 ? (
								<p className="text-muted-foreground text-sm">No students on your roster for this subject.</p>
							) : (
								studentsForSubject.map((s) => (
									<label
										key={s.id}
										className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-background/80"
									>
										<input
											type="checkbox"
											checked={selectedStudentIds.includes(s.id)}
											onChange={() =>
												setSelectedStudentIds((prev) =>
													prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
												)
											}
											className="size-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
										/>
										<span className="min-w-0">
											<span className="block truncate font-medium text-foreground">{s.fullName}</span>
											<span className="text-muted-foreground text-xs">
												Grade {s.grade ?? "—"} · Section {s.section ?? "—"}
											</span>
										</span>
									</label>
								))
							)}
						</div>
					</div>
				</section>
			) : null}

			{state && state.message ? (
				<p
					className={cn("text-sm", state.ok ? "text-foreground" : "text-destructive")}
					role={state.ok ? undefined : "alert"}
				>
					{state.message}
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-3 border-border/50 border-t pt-8">
				<button
					type="button"
					onClick={onPublish}
					disabled={!canPublish}
					className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-[colors,opacity] duration-150 ease-out hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{pending ? "Working…" : isEditingPublished ? "Save changes" : "Publish assignment"}
				</button>
				{!isEditingPublished ? (
					<button
						type="button"
						onClick={onSaveDraft}
						disabled={pending}
						className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
					>
						Save draft
					</button>
				) : null}
				{!isEditingPublished && selectedStudentIds.length === 0 ? (
					<p className="text-muted-foreground text-xs">Select at least one student to publish.</p>
				) : null}
			</div>
		</div>
	);
}
