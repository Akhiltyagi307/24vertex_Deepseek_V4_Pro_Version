"use client";

import { Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchTeacherOrganizationRoster } from "./org-roster-actions";
import { SensitiveLinkCode } from "@/components/teacher/sensitive-link-code";
import type { OrganizationRosterStudentRow } from "@/lib/teachers/roster-queries";
import {
	buildSubjectCatalogPillSelectModel,
	type SubjectCatalogRow,
} from "@/lib/teachers/subject-catalog-label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export function TeacherOrgStudentsTab({
	organizationName,
	subjectsCatalog,
	initialRows,
	filterOptions,
}: {
	organizationName: string;
	subjectsCatalog: SubjectCatalogRow[];
	initialRows: OrganizationRosterStudentRow[];
	filterOptions: { grades: number[]; sections: string[] };
}) {
	const [rows, setRows] = useState<OrganizationRosterStudentRow[]>(initialRows);
	const [grade, setGrade] = useState<number | "all">("all");
	const [section, setSection] = useState<string | "all">("all");
	const [subjectId, setSubjectId] = useState<string | "all">("all");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const skipInitialFetch = useRef(true);

	const gradeOptions = useMemo(() => {
		const fromOrg = filterOptions.grades.length ? filterOptions.grades : [];
		const fallback = Array.from({ length: 7 }, (_, i) => i + 6);
		const merged = new Set(fromOrg.length ? fromOrg : fallback);
		return [...merged].sort((a, b) => a - b);
	}, [filterOptions.grades]);

	const subjectOptions = useMemo(() => {
		if (grade === "all") return subjectsCatalog;
		return subjectsCatalog.filter((s) => s.grade === grade);
	}, [grade, subjectsCatalog]);

	const subjectSelectModel = useMemo(
		() => buildSubjectCatalogPillSelectModel(subjectOptions),
		[subjectOptions],
	);

	useEffect(() => {
		if (skipInitialFetch.current) {
			skipInitialFetch.current = false;
			return;
		}
		startTransition(() => {
			void (async () => {
				setError(null);
				const res = await fetchTeacherOrganizationRoster({ grade, section, subjectId });
				if ("error" in res) {
					setError(res.error);
					return;
				}
				setRows(res.rows);
			})();
		});
	}, [grade, section, subjectId]);

	const handleGradeChange = (value: string) => {
		const nextGrade = value === "all" ? "all" : Number(value);
		setGrade(nextGrade);
		const options =
			nextGrade === "all" ? subjectsCatalog : subjectsCatalog.filter((s) => s.grade === nextGrade);
		if (subjectId !== "all" && !options.some((s) => s.id === subjectId)) {
			setSubjectId("all");
		}
	};

	const handleSectionChange = (value: string) => {
		setSection(value === "all" ? "all" : value);
	};

	const handleSubjectChange = (value: string) => {
		setSubjectId(value === "all" ? "all" : value);
	};

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight text-foreground">
					<Users className="size-4 text-muted-foreground" aria-hidden />
					Organization students
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Learners linked to <span className="text-foreground">{organizationName}</span>. Filter by placement or subject
					(enrollment uses stream and elective for grades 11–12).
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<label htmlFor="orgRosterGrade" className="font-medium text-foreground text-sm">
						Grade
					</label>
					<NativeSelect
						id="orgRosterGrade"
						value={grade === "all" ? "all" : String(grade)}
						onChange={(e) => handleGradeChange(e.target.value)}
						disabled={pending}
						aria-busy={pending}
					>
						<option value="all">All grades</option>
						{gradeOptions.map((g) => (
							<option key={g} value={g}>
								Grade {g}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="space-y-2">
					<label htmlFor="orgRosterSection" className="font-medium text-foreground text-sm">
						Section
					</label>
					<NativeSelect
						id="orgRosterSection"
						value={section === "all" ? "all" : section}
						onChange={(e) => handleSectionChange(e.target.value)}
						disabled={pending}
						aria-busy={pending}
					>
						<option value="all">All sections</option>
						{filterOptions.sections.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="space-y-2">
					<label htmlFor="orgRosterSubject" className="font-medium text-foreground text-sm">
						Subject
					</label>
					<NativeSelect
						id="orgRosterSubject"
						value={subjectId === "all" ? "all" : subjectId}
						onChange={(e) => handleSubjectChange(e.target.value)}
						disabled={pending}
						aria-busy={pending}
						className="max-w-full"
					>
						<option value="all">All subjects</option>
						{subjectSelectModel.optionGroups.map((group) => (
							<optgroup key={group.heading} label={group.heading}>
								{group.options.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</optgroup>
						))}
					</NativeSelect>
				</div>
			</div>

			<p className={cn("text-muted-foreground text-xs", pending && "opacity-70")}>
				{rows.length === 1 ? "1 student matches." : `${rows.length} students match.`}
				{pending ? " Updating…" : ""}
			</p>

			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}

			{rows.length === 0 ? (
				<div className="rounded-xl border border-border/80 bg-muted/15 px-6 py-12 text-center text-muted-foreground text-sm">
					No students match these filters.
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-border/80 shadow-sm">
					<div className="border-b border-border bg-muted/40 px-4 py-2">
						<div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 text-muted-foreground text-xs font-medium uppercase tracking-wide">
							<span>Name</span>
							<span className="hidden sm:block">Grade</span>
							<span className="hidden sm:block">Section</span>
							<span className="text-right sm:text-left">Link code</span>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Codes are sensitive. Reveal them only when you need to copy or share one.
						</p>
					</div>
					<ul className="divide-y divide-border/80">
						{rows.map((row) => (
							<li
								key={row.id}
								className="grid grid-cols-1 gap-1 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-3"
							>
								<span className="font-medium">{row.fullName}</span>
								<span className="text-muted-foreground sm:text-left">{row.grade ?? "—"}</span>
								<span className="text-muted-foreground sm:text-left">{row.section?.trim() || "—"}</span>
								<span className="sm:text-left">
									<SensitiveLinkCode code={row.studentLinkCode} />
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
