"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ClipboardList } from "lucide-react";

import { panelRaisedInputClass, tabAccentClass } from "@/app/student/settings/_settings-form-styles";
import { AssignmentDueDatetimeField } from "@/components/teacher/assignment-due-datetime-field";
import { TeacherAssignmentsSubmissionsHub } from "@/components/teacher/teacher-assignments-submissions-hub";
import { TeacherAssignmentTopicMatrix } from "@/components/teacher/teacher-assignment-topic-matrix";
import { practiceTopicMatrixCheckCircleClass } from "@/components/student/practice/practice-test-wizard/types";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { createTeacherAssignmentAction, type CreateTeacherAssignmentState } from "./actions";
import { fetchAssignableStudentPerformanceBands } from "./student-band-filters-actions";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { TeacherSubmissionAssignmentBundle } from "@/lib/assignments/teacher-submissions-hub-types";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-queries";
import { cn } from "@/lib/utils";

type Props = {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	submissionBundles: TeacherSubmissionAssignmentBundle[];
};

const initialState: CreateTeacherAssignmentState = { ok: false, message: "" };

/** Client-only section filter value for students with no section on their profile. */
const SECTION_FILTER_NONE = "__section_none__";

type AssignmentBandFilterId = Extract<
	TeacherPerformanceBandId,
	"at_risk" | "near_target" | "needs_support"
>;

type BandCheckState = Record<AssignmentBandFilterId, boolean>;

const ASSIGNMENT_STUDENT_BAND_FILTER_OPTIONS: { id: AssignmentBandFilterId; label: string }[] = [
	{ id: "at_risk", label: "At risk" },
	{ id: "near_target", label: "Near target" },
	{ id: "needs_support", label: "Needs support" },
];

const ASSIGNMENTS_SMOOTH_TAB_PANEL_CLASS =
	"min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20";

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
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
	submissionBundles,
}: Props) {
	const router = useRouter();
	const [activateTabRequest, setActivateTabRequest] = React.useState<{
		token: number;
		tabId: string;
	} | null>(null);
	const [state, formAction] = useActionState(createTeacherAssignmentAction, initialState);
	const [formKey, setFormKey] = React.useState(0);
	const [subjectId, setSubjectId] = React.useState(subjectsCatalog[0]?.id ?? "");
	const topicsForSubject = React.useMemo(
		() => topicsCatalog.filter((topic) => topic.subjectId === subjectId),
		[topicsCatalog, subjectId],
	);
	const [selectedTopicIds, setSelectedTopicIds] = React.useState<Set<string>>(() => new Set());
	const [chapterVersion, setChapterVersion] = React.useState(0);
	const [studentSectionFilter, setStudentSectionFilter] = React.useState("");
	const [bandChecks, setBandChecks] = React.useState<BandCheckState>({
		at_risk: false,
		near_target: false,
		needs_support: false,
	});
	const [bandByStudentId, setBandByStudentId] = React.useState<
		Record<string, TeacherPerformanceBandId | null>
	>({});
	const [bandsPending, setBandsPending] = React.useState(false);
	const [bandsError, setBandsError] = React.useState<string | null>(null);

	const sortedAssignableStudentIds = React.useMemo(
		() => [...students.map((s) => s.id)].sort(),
		[students],
	);
	const studentIdsFetchKey = sortedAssignableStudentIds.join(",");

	const performanceBandFilterActive =
		bandChecks.at_risk || bandChecks.near_target || bandChecks.needs_support;

	const distinctStudentSections = React.useMemo(() => {
		const seen = new Set<string>();
		for (const s of students) {
			const sec = (s.section ?? "").trim();
			if (sec) seen.add(sec);
		}
		return [...seen].sort((a, b) => a.localeCompare(b));
	}, [students]);

	const hasStudentsWithoutSection = React.useMemo(
		() => students.some((s) => !(s.section ?? "").trim()),
		[students],
	);

	const studentMatchesSectionFilter = React.useCallback(
		(student: TeacherPerformanceStudentRow) => {
			if (!studentSectionFilter) return true;
			const sec = (student.section ?? "").trim();
			if (studentSectionFilter === SECTION_FILTER_NONE) return sec === "";
			return sec === studentSectionFilter;
		},
		[studentSectionFilter],
	);

	const studentMatchesPerformanceBandFilter = React.useCallback(
		(student: TeacherPerformanceStudentRow) => {
			if (!performanceBandFilterActive) return true;
			if (bandsPending) return true;
			const band = bandByStudentId[student.id];
			if (band == null) return false;
			if (bandChecks.at_risk && band === "at_risk") return true;
			if (bandChecks.near_target && band === "near_target") return true;
			if (bandChecks.needs_support && band === "needs_support") return true;
			return false;
		},
		[performanceBandFilterActive, bandsPending, bandByStudentId, bandChecks],
	);

	const studentMatchesRosterFilters = React.useCallback(
		(student: TeacherPerformanceStudentRow) =>
			studentMatchesSectionFilter(student) && studentMatchesPerformanceBandFilter(student),
		[studentMatchesSectionFilter, studentMatchesPerformanceBandFilter],
	);

	const visibleStudentCount = React.useMemo(
		() => students.reduce((n, s) => (studentMatchesRosterFilters(s) ? n + 1 : n), 0),
		[students, studentMatchesRosterFilters],
	);

	const sectionFilterDisabled =
		students.length === 0 || (distinctStudentSections.length === 0 && !hasStudentsWithoutSection);

	React.useEffect(() => {
		setChapterVersion((v) => v + 1);
		setSelectedTopicIds(new Set());
		setBandChecks({ at_risk: false, near_target: false, needs_support: false });
	}, [subjectId]);

	React.useEffect(() => {
		let cancelled = false;
		if (!subjectId || students.length === 0) {
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
	}, [subjectId, studentIdsFetchKey, sortedAssignableStudentIds, students.length]);

	React.useEffect(() => {
		if (!state.ok || !state.message) return;
		router.refresh();
		setFormKey((k) => k + 1);
		setSelectedTopicIds(new Set());
		setActivateTabRequest((prev) => ({
			token: (prev?.token ?? 0) + 1,
			tabId: "submissions",
		}));
	}, [state.ok, state.message, router]);

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

			<SmoothTab
				defaultTabId="create"
				activateTabRequest={activateTabRequest}
				panelClassName={ASSIGNMENTS_SMOOTH_TAB_PANEL_CLASS}
				persistContentPanels
				deferUntilActivatedTabIds={["submissions"]}
				tabListPosition="top"
				items={[
					{
						id: "create",
						title: "Create assignments",
						icon: ClipboardList,
						color: tabAccentClass,
						content: (
							<form
								key={formKey}
								action={formAction}
								className="space-y-8 rounded-2xl border border-border/70 bg-card p-5 shadow-sm medium:p-7"
							>
						<div className="flex flex-wrap items-start gap-4">
							<div
								className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary dark:bg-primary/16"
								aria-hidden
							>
								<ClipboardList className="size-5" />
							</div>
							<div className="min-w-0 flex-1 space-y-1">
								<h2 className="font-semibold text-foreground text-lg tracking-tight">New assignment</h2>
								<p className="text-muted-foreground text-sm leading-relaxed">
									Jobs materialize tests on a short stagger so the queue stays smooth.
								</p>
							</div>
						</div>

						<section className="space-y-4" aria-labelledby="assign-basics-heading">
							<div className="flex items-center gap-2">
								<h3 id="assign-basics-heading" className="font-medium text-foreground text-sm">
									Basics
								</h3>
								<Separator className="flex-1" />
							</div>
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
									rows={3}
									placeholder="Tell students how to approach this test."
									className={cn(panelRaisedInputClass, "w-full resize-y rounded-lg border border-input", inputFocusRing)}
								/>
							</label>
						</section>

						<section className="space-y-4" aria-labelledby="assign-test-heading">
							<div className="flex items-center gap-2">
								<h3 id="assign-test-heading" className="font-medium text-foreground text-sm">
									Test design
								</h3>
								<Separator className="flex-1" />
							</div>

							<div className="grid gap-4 medium:grid-cols-2">
								<label className="block space-y-2">
									<span className="font-medium text-foreground text-sm">Subject</span>
									<NativeSelect
										name="subject_id"
										value={subjectId}
										onChange={(e) => setSubjectId(e.target.value)}
										required
										className={cn("rounded-lg border border-input", inputFocusRing)}
									>
										{subjectsCatalog.map((subject) => (
											<option key={subject.id} value={subject.id}>
												Grade {subject.grade} · {subject.name}
											</option>
										))}
									</NativeSelect>
								</label>

								<label className="block space-y-2">
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

								<label className="block space-y-2">
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

								<div className="block space-y-2">
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
											<option value={SECTION_FILTER_NONE}>No section on profile</option>
										) : null}
										{distinctStudentSections.map((sec) => (
											<option key={sec} value={sec}>
												Section {sec}
											</option>
										))}
									</NativeSelect>
								</div>

								<fieldset
									disabled={students.length === 0 || !subjectId || bandsPending}
									className="medium:col-span-2 space-y-2 disabled:opacity-60"
									aria-label="Filter students by performance band"
								>
									<legend className="font-medium text-foreground text-sm">
										Filter students by performance
									</legend>
									{bandsError ? (
										<p className="text-destructive text-xs" role="alert">
											{bandsError}
										</p>
									) : null}
									<div className="flex flex-wrap gap-x-5 gap-y-2">
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

								<div className="medium:col-span-2">
									<AssignmentDueDatetimeField id="teacher-assign-due" />
								</div>
							</div>
						</section>

						<section className="space-y-3" aria-labelledby="assign-topics-heading">
							<div className="flex flex-wrap items-end justify-between gap-2">
								<div className="space-y-1">
									<h3 id="assign-topics-heading" className="font-medium text-foreground text-sm">
										Topics
									</h3>
									<p className="max-w-[62ch] text-muted-foreground text-xs leading-relaxed">
										Same chapter layout as the student practice test builder. Expand a chapter and tick topics.
									</p>
								</div>
								<p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
									{selectedTopicIds.size} selected
								</p>
							</div>

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
						</section>

						<section className="space-y-3" aria-labelledby="assign-roster-heading">
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<h3 id="assign-roster-heading" className="font-medium text-foreground text-sm">
										Students
									</h3>
									<Separator className="hidden min-w-[3rem] flex-1 medium:block" />
								</div>
								{students.length > 0 && (studentSectionFilter || performanceBandFilterActive) ? (
									<p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
										Showing {visibleStudentCount} of {students.length}
									</p>
								) : null}
							</div>
							<div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/15 p-3 dark:bg-muted/10">
								{students.length === 0 ? (
									<p className="text-muted-foreground text-sm">No reachable students yet.</p>
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
								{students.length === 0 ? null : (
									students.map((student) => (
										<label
											key={student.id}
											className={cn(
												"flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-background/80",
												!studentMatchesRosterFilters(student) && "hidden",
											)}
										>
											<input
												name="student_ids"
												type="checkbox"
												value={student.id}
												className={cn(
													"size-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring",
												)}
											/>
											<span className="min-w-0">
												<span className="block truncate font-medium text-foreground">{student.fullName}</span>
												<span className="text-muted-foreground text-xs">
													Grade {student.grade ?? "—"} · Section {student.section ?? "—"}
												</span>
											</span>
										</label>
									))
								)}
							</div>
						</section>

						{state.message ? (
							<p
								className={state.ok ? "text-emerald-600 text-sm dark:text-emerald-400" : "text-destructive text-sm"}
								role="status"
							>
								{state.message}
							</p>
						) : null}

						<div className="flex flex-wrap items-center gap-3 pt-1">
							<SubmitButton />
						</div>
					</form>
				),
			},
			{
				id: "submissions",
				title: "Submissions",
				icon: ClipboardCheck,
				color: tabAccentClass,
				content: (
					<div className="flex flex-col gap-5">
						<TeacherAssignmentsSubmissionsHub bundles={submissionBundles} />
					</div>
				),
			},
				]}
			/>
		</div>
	);
}
