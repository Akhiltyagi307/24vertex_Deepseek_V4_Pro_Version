"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { panelRaisedInputClass } from "@/app/student/settings/_settings-form-styles";
import { AssignmentPublishedSuccessDialog } from "@/components/teacher/assignment-published-success-dialog";
import { AssignmentDueDatetimeField } from "@/components/teacher/assignment-due-datetime-field";
import { TeacherAssignmentTopicMatrix } from "@/components/teacher/teacher-assignment-topic-matrix";
import { practiceTopicMatrixCheckCircleClass } from "@/components/student/practice/practice-test-wizard/types";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { createTeacherAssignmentAction, type CreateTeacherAssignmentState } from "./actions";
import { previewEligibleStudentIdsForPracticeAssignment } from "./student-eligibility-actions";
import { fetchAssignableStudentPerformanceBands } from "./student-band-filters-actions";
import {
	arrayShallowEqual,
	ASSIGNMENT_SECTION_FILTER_NONE,
	filterAssignmentCandidateStudents,
	isAssignmentBandFilterActive,
	type AssignmentBandCheckState,
	type AssignmentBandFilterId,
} from "@/lib/assignments/recipient-selection";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import {
	buildSubjectCatalogPillSelectModel,
	type SubjectCatalogRow,
} from "@/lib/teachers/subject-catalog-label";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";
import { cn } from "@/lib/utils";

type Props = {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	/** Defaults the grade picker to the teacher’s roster grade when available. */
	initialGrade?: number | null;
};

function assignmentGradeOptions(
	subjectsCatalog: SubjectCatalogRow[],
	students: TeacherPerformanceStudentRow[],
): number[] {
	const merged = new Set<number>();
	for (const subject of subjectsCatalog) merged.add(subject.grade);
	for (const student of students) {
		if (student.grade != null) merged.add(student.grade);
	}
	const list = [...merged].sort((a, b) => a - b);
	return list.length > 0 ? list : [9];
}

function resolveInitialAssignmentGrade(
	subjectsCatalog: SubjectCatalogRow[],
	students: TeacherPerformanceStudentRow[],
	initialGrade?: number | null,
): number {
	const options = assignmentGradeOptions(subjectsCatalog, students);
	if (initialGrade != null && options.includes(initialGrade)) return initialGrade;
	const fromFirstSubject = subjectsCatalog[0]?.grade;
	if (fromFirstSubject != null && options.includes(fromFirstSubject)) return fromFirstSubject;
	return options[0] ?? 9;
}

function firstSubjectIdForGrade(subjectsCatalog: SubjectCatalogRow[], grade: number): string {
	return subjectsCatalog.find((subject) => subject.grade === grade)?.id ?? subjectsCatalog[0]?.id ?? "";
}

const initialState: CreateTeacherAssignmentState = { ok: false, message: "" };

const ASSIGNMENT_STUDENT_BAND_FILTER_OPTIONS: { id: AssignmentBandFilterId; label: string }[] = [
	{ id: "at_risk", label: "At risk" },
	{ id: "near_target", label: "Near target" },
	{ id: "needs_support", label: "Needs support" },
];

function SubmitButton({
	disabled,
}: {
	disabled: boolean;
}) {
	const { pending } = useFormStatus();
	const blocked = pending || disabled;
	return (
		<button
			type="submit"
			disabled={blocked}
			className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-[colors,opacity] duration-150 ease-out hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{pending ? "Publishing…" : "Publish assignment"}
		</button>
	);
}

export function TeacherAssignmentsManager({
	subjectsCatalog,
	topicsCatalog,
	students,
	initialGrade,
}: Props) {
	const router = useRouter();
	const [successDialogOpen, setSuccessDialogOpen] = React.useState(false);
	const [publishedSummary, setPublishedSummary] = React.useState<{
		title: string;
		studentCount: number;
	} | null>(null);
	const [state, formAction] = useActionState(createTeacherAssignmentAction, initialState);
	const [formKey, setFormKey] = React.useState(0);
	const gradeOptions = React.useMemo(
		() => assignmentGradeOptions(subjectsCatalog, students),
		[subjectsCatalog, students],
	);
	const [gradePick, setGradePick] = React.useState(() =>
		resolveInitialAssignmentGrade(subjectsCatalog, students, initialGrade),
	);
	const [subjectId, setSubjectId] = React.useState(() =>
		firstSubjectIdForGrade(
			subjectsCatalog,
			resolveInitialAssignmentGrade(subjectsCatalog, students, initialGrade),
		),
	);
	const subjectsForGrade = React.useMemo(
		() => subjectsCatalog.filter((subject) => subject.grade === gradePick),
		[subjectsCatalog, gradePick],
	);
	const assignmentSubjectGroups = React.useMemo(
		() => buildSubjectCatalogPillSelectModel(subjectsForGrade, { includeAll: false }).optionGroups,
		[subjectsForGrade],
	);
	const studentsForGrade = React.useMemo(
		() => students.filter((student) => student.grade === gradePick),
		[students, gradePick],
	);
	const topicsForSubject = React.useMemo(
		() => topicsCatalog.filter((topic) => topic.subjectId === subjectId),
		[topicsCatalog, subjectId],
	);
	const [selectedTopicIds, setSelectedTopicIds] = React.useState<Set<string>>(() => new Set());
	const [chapterVersion, setChapterVersion] = React.useState(0);
	const [studentSectionFilter, setStudentSectionFilter] = React.useState("");
	const [bandChecks, setBandChecks] = React.useState<AssignmentBandCheckState>({
		at_risk: false,
		near_target: false,
		needs_support: false,
	});
	const [bandByStudentId, setBandByStudentId] = React.useState<
		Record<string, TeacherPerformanceBandId | null>
	>({});
	const [bandsPending, setBandsPending] = React.useState(false);
	const [bandsError, setBandsError] = React.useState<string | null>(null);
	const [eligibilityPending, setEligibilityPending] = React.useState(false);
	const [eligibilityError, setEligibilityError] = React.useState<string | null>(null);
	const [eligibleStudentIds, setEligibleStudentIds] = React.useState<string[]>([]);
	const [manualSelectionEnabled, setManualSelectionEnabled] = React.useState(false);
	const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);

	const sortedAssignableStudentIds = React.useMemo(
		() => [...studentsForGrade.map((s) => s.id)].sort(),
		[studentsForGrade],
	);
	const studentIdsFetchKey = sortedAssignableStudentIds.join(",");
	const studentOrderById = React.useMemo(
		() => new Map(studentsForGrade.map((student, index) => [student.id, index])),
		[studentsForGrade],
	);
	const selectedTopicIdsArray = React.useMemo(() => Array.from(selectedTopicIds), [selectedTopicIds]);
	const selectedTopicIdsFetchKey = React.useMemo(
		() => [...selectedTopicIdsArray].sort().join(","),
		[selectedTopicIdsArray],
	);

	const performanceBandFilterActive = React.useMemo(
		() => isAssignmentBandFilterActive(bandChecks),
		[bandChecks],
	);

	const distinctStudentSections = React.useMemo(() => {
		const seen = new Set<string>();
		for (const s of studentsForGrade) {
			const sec = (s.section ?? "").trim();
			if (sec) seen.add(sec);
		}
		return [...seen].sort((a, b) => a.localeCompare(b));
	}, [studentsForGrade]);

	const hasStudentsWithoutSection = React.useMemo(
		() => studentsForGrade.some((s) => !(s.section ?? "").trim()),
		[studentsForGrade],
	);

	const filteredStudents = React.useMemo(
		() =>
			filterAssignmentCandidateStudents({
				students: studentsForGrade,
				sectionFilter: studentSectionFilter,
				bandByStudentId,
				bandChecks,
				bandsPending,
			}),
		[studentsForGrade, studentSectionFilter, bandByStudentId, bandChecks, bandsPending],
	);
	const filteredStudentIds = React.useMemo(() => filteredStudents.map((student) => student.id), [filteredStudents]);
	const filteredStudentsFetchKey = React.useMemo(() => filteredStudentIds.join(","), [filteredStudentIds]);
	const filteredStudentIdSet = React.useMemo(() => new Set(filteredStudentIds), [filteredStudentIds]);
	const visibleStudentCount = filteredStudents.length;
	const eligibleStudentIdsFetchKey = React.useMemo(() => eligibleStudentIds.join(","), [eligibleStudentIds]);
	const eligibleStudentIdSet = React.useMemo(() => new Set(eligibleStudentIds), [eligibleStudentIds]);
	const selectedStudentIdSet = React.useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
	const recipientSyncPending = bandsPending || eligibilityPending;
	const submitDisabled = recipientSyncPending || selectedStudentIds.length === 0;

	const sectionFilterDisabled =
		studentsForGrade.length === 0 ||
		(distinctStudentSections.length === 0 && !hasStudentsWithoutSection);

	const resetAssignmentScopeSelections = React.useCallback(() => {
		setChapterVersion((v) => v + 1);
		setSelectedTopicIds(new Set());
		setBandChecks({ at_risk: false, near_target: false, needs_support: false });
		setManualSelectionEnabled(false);
		setSelectedStudentIds([]);
		setEligibleStudentIds([]);
		setEligibilityError(null);
		setStudentSectionFilter("");
	}, []);

	React.useEffect(() => {
		resetAssignmentScopeSelections();
	}, [subjectId, gradePick, resetAssignmentScopeSelections]);

	React.useEffect(() => {
		let cancelled = false;
		if (!subjectId || studentsForGrade.length === 0) {
			setBandByStudentId({});
			setBandsPending(false);
			setBandsError(null);
			return;
		}
		setBandsPending(true);
		setBandsError(null);
		void (async () => {
			const res = await fetchAssignableStudentPerformanceBands({
				subjectId,
				studentIds: sortedAssignableStudentIds,
			});
			if (cancelled) return;
			if ("error" in res) {
				setBandsError(res.error);
				setBandByStudentId({});
			} else {
				setBandsError(null);
				setBandByStudentId(res.bands);
			}
			setBandsPending(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [subjectId, studentIdsFetchKey, sortedAssignableStudentIds, studentsForGrade.length]);

	React.useEffect(() => {
		let cancelled = false;
		if (!subjectId || studentsForGrade.length === 0) {
			setEligibilityPending(false);
			setEligibilityError(null);
			setEligibleStudentIds((prev) => (prev.length === 0 ? prev : []));
			return;
		}
		if (bandsPending) {
			setEligibilityPending(true);
			return () => {
				cancelled = true;
			};
		}
		if (filteredStudentIds.length === 0) {
			setEligibilityPending(false);
			setEligibilityError(null);
			setEligibleStudentIds((prev) => (prev.length === 0 ? prev : []));
			return;
		}
		if (selectedTopicIdsArray.length === 0) {
			setEligibilityPending(false);
			setEligibilityError(null);
			setEligibleStudentIds((prev) =>
				arrayShallowEqual(prev, filteredStudentIds) ? prev : filteredStudentIds,
			);
			return;
		}

		setEligibilityPending(true);
		setEligibilityError(null);
		const timer = window.setTimeout(() => {
			void (async () => {
				const res = await previewEligibleStudentIdsForPracticeAssignment({
					subjectId,
					topicIds: selectedTopicIdsArray,
					candidateStudentIds: filteredStudentIds,
				});
				if (cancelled) return;
				if ("error" in res) {
					setEligibilityError(res.error);
					setEligibleStudentIds((prev) => (prev.length === 0 ? prev : []));
				} else {
					const nextEligible = res.eligibleStudentIds.filter((id) => filteredStudentIdSet.has(id));
					setEligibilityError(null);
					setEligibleStudentIds((prev) =>
						arrayShallowEqual(prev, nextEligible) ? prev : nextEligible,
					);
				}
				setEligibilityPending(false);
			})();
		}, 180);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [
		subjectId,
		selectedTopicIdsArray,
		selectedTopicIdsFetchKey,
		filteredStudentIds,
		filteredStudentIdSet,
		filteredStudentsFetchKey,
		bandsPending,
		studentsForGrade.length,
	]);

	React.useEffect(() => {
		if (manualSelectionEnabled) return;
		setSelectedStudentIds((prev) => (arrayShallowEqual(prev, eligibleStudentIds) ? prev : eligibleStudentIds));
	}, [manualSelectionEnabled, eligibleStudentIds, eligibleStudentIdsFetchKey]);

	React.useEffect(() => {
		if (!manualSelectionEnabled) return;
		setSelectedStudentIds((prev) => {
			const next = prev.filter((id) => eligibleStudentIdSet.has(id));
			return arrayShallowEqual(prev, next) ? prev : next;
		});
	}, [manualSelectionEnabled, eligibleStudentIdSet, eligibleStudentIdsFetchKey]);

	const toggleStudentSelection = React.useCallback(
		(studentId: string) => {
			if (!manualSelectionEnabled || !eligibleStudentIdSet.has(studentId)) return;
			setSelectedStudentIds((prev) => {
				if (prev.includes(studentId)) return prev.filter((id) => id !== studentId);
				const next = [...prev, studentId];
				next.sort(
					(a, b) =>
						(studentOrderById.get(a) ?? Number.MAX_SAFE_INTEGER) -
						(studentOrderById.get(b) ?? Number.MAX_SAFE_INTEGER),
				);
				return next;
			});
		},
		[eligibleStudentIdSet, manualSelectionEnabled, studentOrderById],
	);

	React.useEffect(() => {
		if (!state.ok || !state.assignmentId || !state.title || state.studentCount == null) return;
		router.refresh();
		setPublishedSummary({ title: state.title, studentCount: state.studentCount });
		setSuccessDialogOpen(true);
		setFormKey((k) => k + 1);
		setSelectedTopicIds(new Set());
		setManualSelectionEnabled(false);
		setSelectedStudentIds([]);
		setEligibleStudentIds([]);
		setEligibilityError(null);
	}, [state.ok, state.assignmentId, state.title, state.studentCount, router]);

	const handleCreateAnother = React.useCallback(() => {
		setSuccessDialogOpen(false);
		setPublishedSummary(null);
	}, []);

	const inputFocusRing =
		"outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 py-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Practice assignments</h1>
				<p className="max-w-[65ch] text-muted-foreground text-sm leading-relaxed">
					Assign AI-generated practice tests to students on your roster. Each learner gets their own generated
					test from the topics you choose.
				</p>
			</div>

			<form
				key={formKey}
				action={formAction}
				className="space-y-10 rounded-2xl border border-border/70 bg-card p-5 shadow-sm medium:space-y-11 medium:p-7"
			>
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

						<section className="space-y-5" aria-labelledby="assign-basics-heading">
							<div className="flex items-center gap-3">
								<h3 id="assign-basics-heading" className="shrink-0 font-medium text-foreground text-sm">
									Basics
								</h3>
								<Separator className="flex-1" />
							</div>
							<div className="space-y-5">
								<label className="block space-y-2">
									<span className="font-medium text-foreground text-sm">Title</span>
									<input
										name="title"
										required
										maxLength={300}
										placeholder="Algebra checkpoint"
										className={cn(panelRaisedInputClass, "w-full rounded-lg border border-input", inputFocusRing)}
									/>
								</label>

								<label className="block space-y-2">
									<span className="font-medium text-foreground text-sm">Instructions</span>
									<span className="sr-only">Optional</span>
									<textarea
										name="instructions"
										rows={4}
										placeholder="Tell students how to approach this test."
										className={cn(
											panelRaisedInputClass,
											"min-h-[6.5rem] w-full resize-y rounded-lg border border-input",
											inputFocusRing,
										)}
									/>
								</label>
							</div>
						</section>

						<section className="space-y-5" aria-labelledby="assign-test-heading">
							<div className="flex items-center gap-3">
								<h3 id="assign-test-heading" className="shrink-0 font-medium text-foreground text-sm">
									Test design
								</h3>
								<Separator className="flex-1" />
							</div>

							<div className="space-y-5">
								<div className="grid gap-5 medium:grid-cols-2">
									<label className="block min-w-0 space-y-2">
										<span className="font-medium text-foreground text-sm">Grade</span>
										<NativeSelect
											value={gradePick}
											onChange={(e) => {
												const nextGrade = Number(e.target.value);
												setGradePick(nextGrade);
												setSubjectId(firstSubjectIdForGrade(subjectsCatalog, nextGrade));
											}}
											required
											className={cn("max-w-full rounded-lg border border-input", inputFocusRing)}
											aria-label="Grade"
										>
											{gradeOptions.map((grade) => (
												<option key={grade} value={grade}>
													Grade {grade}
												</option>
											))}
										</NativeSelect>
									</label>

									<label className="block min-w-0 space-y-2">
										<span className="font-medium text-foreground text-sm">Subject</span>
										<NativeSelect
											key={gradePick}
											name="subject_id"
											value={subjectId}
											onChange={(e) => setSubjectId(e.target.value)}
											required
											disabled={subjectsForGrade.length === 0}
											className={cn("max-w-full rounded-lg border border-input", inputFocusRing)}
										>
											{subjectsForGrade.length === 0 ?
												<option value="">No subjects for this grade</option>
											:	assignmentSubjectGroups.map((group) => (
													<optgroup key={group.heading} label={group.heading}>
														{group.options.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</optgroup>
												))
											}
										</NativeSelect>
									</label>

									<label className="block min-w-0 space-y-2">
										<span className="font-medium text-foreground text-sm">Difficulty</span>
										<NativeSelect
											name="difficulty"
											defaultValue="medium"
											required
											className={cn("rounded-lg border border-input", inputFocusRing)}
										>
											<option value="easy">Easy</option>
											<option value="medium">Medium</option>
											<option value="hard">Hard</option>
										</NativeSelect>
									</label>

									<label className="block min-w-0 space-y-2">
										<span className="font-medium text-foreground text-sm">Duration</span>
										<NativeSelect
											name="time_limit_seconds"
											defaultValue="3600"
											required
											className={cn("rounded-lg border border-input", inputFocusRing)}
										>
											<option value="3600">1 hour · 15 questions</option>
											<option value="10800">3 hours · 30 questions</option>
										</NativeSelect>
									</label>

									<div className="block min-w-0 space-y-2">
										<span className="font-medium text-foreground text-sm">Section</span>
										<span className="sr-only">Filter students by class section</span>
										<NativeSelect
											value={studentSectionFilter}
											disabled={sectionFilterDisabled}
											onChange={(e) => setStudentSectionFilter(e.target.value)}
											className={cn(
												"rounded-lg border border-input",
												inputFocusRing,
												sectionFilterDisabled && "cursor-not-allowed opacity-60",
											)}
											aria-label="Filter students by section"
										>
											<option value="">All sections</option>
											{hasStudentsWithoutSection ? (
												<option value={ASSIGNMENT_SECTION_FILTER_NONE}>No section on profile</option>
											) : null}
											{distinctStudentSections.map((sec) => (
												<option key={sec} value={sec}>
													Section {sec}
												</option>
											))}
										</NativeSelect>
									</div>
								</div>
							</div>
						</section>

						<section className="space-y-5" aria-labelledby="assign-performance-heading">
							<div className="flex items-center gap-3">
								<h3
									id="assign-performance-heading"
									className="shrink-0 font-medium text-foreground text-sm"
								>
									Filter students by performance{" "}
									<span className="font-normal text-muted-foreground">(optional)</span>
								</h3>
								<Separator className="flex-1" />
							</div>
							<div className="space-y-5">
								<fieldset
									disabled={studentsForGrade.length === 0 || !subjectId || bandsPending}
									className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-60"
									aria-labelledby="assign-performance-heading"
								>
									{bandsError ? (
										<p className="text-destructive text-xs" role="alert">
											{bandsError}
										</p>
									) : null}
									<div className="flex flex-wrap gap-x-8 gap-y-4">
										{ASSIGNMENT_STUDENT_BAND_FILTER_OPTIONS.map(({ id, label }) => (
											<label
												key={id}
												className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
											>
												<input
													type="checkbox"
													checked={bandChecks[id]}
													onChange={() =>
														setBandChecks((prev) => ({
															...prev,
															[id]: !prev[id],
														}))
													}
													aria-label={`Filter roster: ${label}`}
													className={practiceTopicMatrixCheckCircleClass}
												/>
												<span>{label}</span>
											</label>
										))}
									</div>
									{bandsPending ? (
										<p className="text-muted-foreground text-xs">Loading performance bands…</p>
									) : null}
								</fieldset>
							</div>
						</section>

						<section className="space-y-5" aria-labelledby="assign-due-heading">
							<div className="flex items-center gap-3">
								<h3 id="assign-due-heading" className="shrink-0 font-medium text-foreground text-sm">
									Due date
								</h3>
								<Separator className="flex-1" />
							</div>
							<AssignmentDueDatetimeField
								id="teacher-assign-due"
								labelledByHeadingId="assign-due-heading"
								className="min-w-0"
							/>
						</section>

						<section className="space-y-5" aria-labelledby="assign-topics-heading">
							<div className="flex items-center gap-3">
								<h3 id="assign-topics-heading" className="shrink-0 font-medium text-foreground text-sm">
									Topics
								</h3>
								<Separator className="flex-1" />
							</div>
							<div className="space-y-5">
								<p className="text-right text-muted-foreground text-xs tabular-nums" aria-live="polite">
									{selectedTopicIds.size} selected
								</p>

								{Array.from(selectedTopicIds).map((id) => (
									<input key={id} type="hidden" name="topic_ids" value={id} />
								))}

								<TeacherAssignmentTopicMatrix
									topics={topicsForSubject}
									subjectId={subjectId}
									selectedTopicIds={selectedTopicIds}
									onSelectedTopicIdsChange={setSelectedTopicIds}
									chapterVersion={chapterVersion}
								/>
							</div>
						</section>

						<section className="space-y-5" aria-labelledby="assign-roster-heading">
							<div className="flex items-center gap-3">
								<h3 id="assign-roster-heading" className="shrink-0 font-medium text-foreground text-sm">
									Students
								</h3>
								<Separator className="flex-1" />
							</div>
							<div className="space-y-5">
								{selectedStudentIds.map((id) => (
									<input key={id} type="hidden" name="student_ids" value={id} />
								))}
								{studentsForGrade.length > 0 ? (
									<div className="flex flex-wrap items-center justify-between gap-3">
										<p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
											Grade {gradePick} · Showing {visibleStudentCount} of {studentsForGrade.length} · Recipients{" "}
											{selectedStudentIds.length}
										</p>
										{manualSelectionEnabled ? (
											<button
												type="button"
												className="text-link text-xs underline-offset-4 hover:underline"
												onClick={() => setManualSelectionEnabled(false)}
											>
												Reset to filtered recipients
											</button>
										) : (
											<button
												type="button"
												className="text-link text-xs underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
												disabled={eligibleStudentIds.length === 0}
												onClick={() => setManualSelectionEnabled(true)}
											>
												Customize selection
											</button>
										)}
									</div>
								) : null}
								{eligibilityError ? (
									<p className="text-destructive text-xs" role="alert">
										{eligibilityError}
									</p>
								) : null}
								{recipientSyncPending ? (
									<p className="text-muted-foreground text-xs">Syncing recipients from current filters…</p>
								) : null}
								<div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/15 p-3 dark:bg-muted/10">
									{studentsForGrade.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											No students on your roster for grade {gradePick}.
										</p>
									) : visibleStudentCount === 0 ? (
										<p className="text-muted-foreground text-sm leading-relaxed">
											{performanceBandFilterActive && !bandsPending ? (
												<>
													No students match these filters. Adjust the section, clear performance filters, or
													note learners without graded work in this subject won&apos;t appear when a band is
													selected.
												</>
											) : (
												<>
													No students match this section. Pick another section or{" "}
													<button
														type="button"
														className="text-link underline-offset-4 hover:underline"
														onClick={() => setStudentSectionFilter("")}
													>
														show all sections
													</button>
													.
												</>
											)}
										</p>
									) : null}
									{studentsForGrade.length === 0
										? null
										: filteredStudents.map((student) => {
												const isEligible =
													!eligibilityError &&
													!recipientSyncPending &&
													eligibleStudentIdSet.has(student.id);
												return (
													<label
														key={student.id}
														className={cn(
															"flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-background/80",
															!isEligible && "cursor-not-allowed opacity-60",
														)}
													>
														<input
															type="checkbox"
															checked={selectedStudentIdSet.has(student.id)}
															onChange={() => toggleStudentSelection(student.id)}
															disabled={!manualSelectionEnabled || !isEligible}
															className={cn(
																"size-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring",
																!manualSelectionEnabled && "cursor-not-allowed",
															)}
														/>
														<span className="min-w-0">
															<span className="block truncate font-medium text-foreground">
																{student.fullName}
															</span>
															<span className="text-muted-foreground text-xs">
																Grade {student.grade ?? "—"} · Section {student.section ?? "—"}
															</span>
														</span>
													</label>
												);
											})}
								</div>
							</div>
						</section>

						{!state.ok && state.message ? (
							<p className="text-destructive text-sm" role="alert">
								{state.message}
							</p>
						) : null}

						<div className="flex flex-wrap items-center gap-3 border-border/50 border-t pt-8">
							<SubmitButton
								disabled={submitDisabled || subjectsForGrade.length === 0 || !subjectId}
							/>
							{submitDisabled || subjectsForGrade.length === 0 || !subjectId ?
								<p className="text-muted-foreground text-xs">
									{subjectsForGrade.length === 0 || !subjectId ?
										"Pick a grade with at least one subject."
									: recipientSyncPending ?
										"Recipients are still syncing."
									:	"Select at least one eligible student to publish."}
								</p>
							: null}
						</div>
			</form>

			{publishedSummary ?
				<AssignmentPublishedSuccessDialog
					open={successDialogOpen}
					onOpenChange={setSuccessDialogOpen}
					title={publishedSummary.title}
					studentCount={publishedSummary.studentCount}
					onCreateAnother={handleCreateAnother}
				/>
			:	null}
		</div>
	);
}
