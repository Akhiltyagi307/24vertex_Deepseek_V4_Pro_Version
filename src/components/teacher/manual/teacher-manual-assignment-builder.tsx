"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
	publishManualAssignmentAction,
	saveManualAssignmentDraftAction,
	updatePublishedManualAssignmentAction,
	type ManualAssignmentActionState,
} from "@/app/teacher/(protected)/assignments/manual-actions";
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

const inputClass =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

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

	return (
		<div className="space-y-8 rounded-2xl border border-border/70 bg-card p-5 medium:p-7">
			{isEditingPublished ? (
				<p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-amber-900 text-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
					Editing a published assignment. Changes apply only to students who haven&apos;t started yet; students who
					already started or finished keep their original test.
				</p>
			) : null}

			<section className="space-y-4">
				<label className="block space-y-1">
					<span className="font-medium text-foreground text-sm">Title</span>
					<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={inputClass} />
				</label>
				<label className="block space-y-1">
					<span className="font-medium text-foreground text-sm">Instructions (optional)</span>
					<textarea
						rows={3}
						value={instructions}
						onChange={(e) => setInstructions(e.target.value)}
						className={cn(inputClass, "resize-y")}
					/>
				</label>
				<div className="grid gap-4 medium:grid-cols-3">
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Subject</span>
						<NativeSelect
							value={subjectId}
							onChange={(e) => setSubjectId(e.target.value)}
							disabled={isEditingPublished}
							className="rounded-lg border border-input"
						>
							{subjectsCatalog.map((s) => (
								<option key={s.id} value={s.id}>
									Grade {s.grade} · {s.name}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Time limit</span>
						<NativeSelect
							value={timeLimit}
							onChange={(e) => setTimeLimit(Number(e.target.value))}
							className="rounded-lg border border-input"
						>
							{DURATION_OPTIONS.map((d) => (
								<option key={d.value} value={d.value}>
									{d.label}
								</option>
							))}
						</NativeSelect>
					</label>
					<label className="block space-y-1">
						<span className="font-medium text-foreground text-sm">Difficulty (label)</span>
						<NativeSelect
							value={difficulty}
							onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
							className="rounded-lg border border-input"
						>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</NativeSelect>
					</label>
				</div>
				<label className="block space-y-1">
					<span className="font-medium text-foreground text-sm">Due date (optional)</span>
					<input
						type="datetime-local"
						value={dueAt}
						onChange={(e) => setDueAt(e.target.value)}
						className={cn(inputClass, "max-w-xs")}
					/>
				</label>
			</section>

			<Separator />

			<section className="space-y-4">
				<h3 className="font-medium text-foreground text-sm">Questions ({questions.length})</h3>
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
					className="rounded-lg border border-dashed border-border px-4 py-2 text-sm text-foreground hover:bg-muted/40"
				>
					+ Add question
				</button>
			</section>

			{!isEditingPublished ? (
				<>
					<Separator />
					<section className="space-y-3">
						<h3 className="font-medium text-foreground text-sm">Students</h3>
						<div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/15 p-3">
							{studentsForSubject.length === 0 ? (
								<p className="text-muted-foreground text-sm">No students on your roster for this subject.</p>
							) : (
								studentsForSubject.map((s) => (
									<label
										key={s.id}
										className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-background/80"
									>
										<input
											type="checkbox"
											checked={selectedStudentIds.includes(s.id)}
											onChange={() =>
												setSelectedStudentIds((prev) =>
													prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
												)
											}
											className="size-4"
										/>
										<span>
											{s.fullName}{" "}
											<span className="text-muted-foreground text-xs">
												· Grade {s.grade ?? "—"} · Sec {s.section ?? "—"}
											</span>
										</span>
									</label>
								))
							)}
						</div>
					</section>
				</>
			) : null}

			{state && state.message ? (
				<p
					className={cn("text-sm", state.ok ? "text-foreground" : "text-destructive")}
					role={state.ok ? undefined : "alert"}
				>
					{state.message}
				</p>
			) : null}

			<div className="flex flex-wrap items-center gap-3 border-border/50 border-t pt-6">
				<button
					type="button"
					onClick={onPublish}
					disabled={!canPublish}
					className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
				>
					{pending ? "Working…" : isEditingPublished ? "Save changes" : "Publish assignment"}
				</button>
				{!isEditingPublished ? (
					<button
						type="button"
						onClick={onSaveDraft}
						disabled={pending}
						className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input px-5 text-sm font-medium text-foreground hover:bg-muted/40 disabled:opacity-60"
					>
						Save draft
					</button>
				) : null}
				{!isEditingPublished && selectedStudentIds.length === 0 ? (
					<span className="text-muted-foreground text-xs">Select at least one student to publish.</span>
				) : null}
			</div>
		</div>
	);
}
