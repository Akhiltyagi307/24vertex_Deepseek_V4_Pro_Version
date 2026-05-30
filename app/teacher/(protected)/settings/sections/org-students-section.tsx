"use client";

import { useEffect, useState } from "react";

import { loadTeacherOrganizationRosterTabData } from "../org-roster-actions";
import { TeacherOrgStudentsTab } from "../teacher-org-students-tab";
import { Button } from "@/components/ui/button";
import type { OrganizationRosterStudentRow } from "@/lib/teachers/roster-types";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";

export type TeacherOrgStudentRosterData = {
	initialRows: OrganizationRosterStudentRow[];
	filterOptions: { grades: number[]; sections: string[] };
};

export function TeacherOrgStudentsDeferredTab({
	organizationName,
	subjectsCatalog,
	initialData,
}: {
	organizationName: string;
	subjectsCatalog: SubjectCatalogRow[];
	initialData: TeacherOrgStudentRosterData | null;
}) {
	const [data, setData] = useState<TeacherOrgStudentRosterData | null>(initialData);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(initialData == null);

	const loadRoster = async () => {
		setPending(true);
		setError(null);
		const result = await loadTeacherOrganizationRosterTabData();
		if ("error" in result) {
			setError(result.error);
			setPending(false);
			return;
		}
		setData(result);
		setPending(false);
	};

	useEffect(() => {
		if (data) return;
		let cancelled = false;
		void (async () => {
			const result = await loadTeacherOrganizationRosterTabData();
			if (cancelled) return;
			if ("error" in result) {
				setError(result.error);
				setPending(false);
				return;
			}
			setData(result);
			setPending(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [data]);

	if (data) {
		return (
			<TeacherOrgStudentsTab
				organizationName={organizationName}
				subjectsCatalog={subjectsCatalog}
				initialRows={data.initialRows}
				filterOptions={data.filterOptions}
			/>
		);
	}

	return (
		<div className="space-y-4" aria-busy={pending}>
			<div className="space-y-2">
				<div className="h-5 w-44 animate-pulse rounded bg-muted-foreground/15" />
				<div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted-foreground/10" />
			</div>
			<div className="grid gap-4 medium:grid-cols-3">
				<div className="h-10 animate-pulse rounded-md bg-muted-foreground/10" />
				<div className="h-10 animate-pulse rounded-md bg-muted-foreground/10" />
				<div className="h-10 animate-pulse rounded-md bg-muted-foreground/10" />
			</div>
			{error ? (
				<div className="space-y-3">
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
					<Button type="button" variant="outline" onClick={() => void loadRoster()} disabled={pending}>
						{pending ? "Loading..." : "Try again"}
					</Button>
				</div>
			) : null}
		</div>
	);
}
