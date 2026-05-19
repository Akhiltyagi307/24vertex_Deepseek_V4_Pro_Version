"use client";

import { CheckIcon } from "lucide-react";

import { settingsNestedWellClass } from "./_account-fields";
import type { ResolvedSubjectForSettings, StudentProfileSettingsRow } from "../student-profile-settings-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SubjectsPanel({
	profile,
	resolvedSubjects,
	subjectsLoadError,
}: {
	profile: StudentProfileSettingsRow;
	resolvedSubjects: ResolvedSubjectForSettings[];
	subjectsLoadError: string | null;
}) {
	return (
		<div className={settingsNestedWellClass}>
			<p className="text-foreground text-sm font-semibold">Subjects</p>
			{subjectsLoadError ? (
				<Alert variant="destructive" className="mt-3">
					<AlertTitle>Could not refresh subjects</AlertTitle>
					<AlertDescription>{subjectsLoadError}</AlertDescription>
				</Alert>
			) : null}
			<div className="mt-2 flex flex-wrap gap-2">
				{resolvedSubjects.length > 0 ? (
					resolvedSubjects.map((s) => (
						<span
							key={s.id}
							className="inline-flex items-center gap-2 rounded-lg border border-border/90 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm dark:border-border dark:bg-muted/50"
						>
							<span
								className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500"
								aria-hidden
							>
								<CheckIcon className="size-3 text-white" strokeWidth={2.75} />
							</span>
							{s.name}
						</span>
					))
				) : (
					<span className="rounded-lg border border-border/90 bg-background px-3 py-2 text-foreground/70 text-sm shadow-sm dark:border-border dark:bg-muted/50">
						—
					</span>
				)}
			</div>
			<p className="mt-3 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
				{profile.grade == null
					? "Set your grade (and stream or elective for 11–12) so we can list the subjects you should see."
					: profile.grade >= 11
						? "We pick these from your grade, stream, and elective. If something’s missing, fix the fields above or ask your school."
						: "We pick these from your grade. If the list looks wrong, double-check the fields above with your school."}
			</p>
		</div>
	);
}
