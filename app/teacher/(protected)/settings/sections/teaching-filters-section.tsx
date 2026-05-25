"use client";

import { settingsPrimarySubmitClass } from "./_shared";
import { SubmitButton } from "@/components/auth/submit-button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
	buildSubjectCatalogPillSelectModel,
	type SubjectCatalogRow,
} from "@/lib/teachers/subject-catalog-label";

import type { TeacherAccountProfile } from "../teacher-account-settings-form-types";

export function TeacherTeachingFiltersSection({
	profile,
	subjectsCatalog,
	gradePick,
	setGradePick,
	formAction,
}: {
	profile: TeacherAccountProfile;
	subjectsCatalog: SubjectCatalogRow[];
	gradePick: number;
	setGradePick: (g: number) => void;
	formAction: (formData: FormData) => void;
}) {
	const subjectsForGrade = subjectsCatalog.filter((s) => s.grade === gradePick);
	const subjectGroups = buildSubjectCatalogPillSelectModel(subjectsForGrade, { includeAll: false }).optionGroups;
	return (
		<form action={formAction} className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg tracking-tight text-foreground">Teaching filters</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
					Choose the grade and subject for your organization roster on the Link Student page. Only students in your
					school who belong to that grade and take that subject appear.
				</p>
			</div>
			<div className="grid gap-4 medium:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="teacherRosterGrade">Grade</Label>
					<NativeSelect
						id="teacherRosterGrade"
						name="grade"
						required
						value={gradePick}
						onChange={(e) => setGradePick(Number(e.target.value))}
					>
						{Array.from({ length: 7 }, (_, i) => i + 6).map((g) => (
							<option key={g} value={g}>
								Grade {g}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="space-y-2">
					<Label htmlFor="teacherRosterSubject">Subject</Label>
					<NativeSelect
						key={gradePick}
						id="teacherRosterSubject"
						name="subjectId"
						required
						defaultValue={
							subjectsForGrade.some((s) => s.id === profile.teacher_roster_subject_id)
								? (profile.teacher_roster_subject_id ?? "")
								: subjectsForGrade[0]?.id ?? ""
						}
					>
						{subjectsForGrade.length === 0 ? (
							<option value="">No subjects configured for this grade</option>
						) : (
							subjectGroups.map((group) => (
								<optgroup key={group.heading} label={group.heading}>
									{group.options.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</optgroup>
							))
						)}
					</NativeSelect>
				</div>
			</div>
			<p className="text-xs text-muted-foreground">
				Roster resolution follows each student&apos;s stream and elective for grades 11–12.
			</p>
			<SubmitButton
				label="Save teaching filters"
				pendingLabel="Saving…"
				disabled={subjectsForGrade.length === 0}
				className={settingsPrimarySubmitClass}
			/>
		</form>
	);
}
