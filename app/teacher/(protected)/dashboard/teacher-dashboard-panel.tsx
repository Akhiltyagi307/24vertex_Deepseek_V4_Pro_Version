"use client";

import { GraduationCap, Layers2, Library } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchTeacherDashboardBundle } from "./teacher-dashboard-actions";
import { TeacherDashboardAtRiskCard } from "./teacher-dashboard-at-risk-card";
import { TeacherDashboardClassPerformanceCard } from "./teacher-dashboard-class-performance-card";
import { TeacherDashboardPerformanceBandStrip } from "./teacher-dashboard-performance-band-strip";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import type { TeacherDashboardBundle } from "./teacher-dashboard-data";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";

type Props = {
	activeOrganization: { name: string } | null;
	linkCodeStudents: { id: string; fullName: string; studentLinkCode: string | null }[];
	subjectsCatalog: SubjectCatalogRow[];
	filterOptions: { grades: number[]; sections: string[] };
	initialDashboardBundle: TeacherDashboardBundle;
	atRiskThresholdPercent: number;
	atRiskLastGradedCount: number;
};

export function TeacherDashboardPanel({
	activeOrganization,
	linkCodeStudents,
	subjectsCatalog,
	filterOptions,
	initialDashboardBundle,
	atRiskThresholdPercent,
	atRiskLastGradedCount,
}: Props) {
	const [grade, setGrade] = useState<number | "all">("all");
	const [section, setSection] = useState<string | "all">("all");
	const [subjectId, setSubjectId] = useState<string | "all">("all");
	const initialScopeKey = "all|all|all";
	const didSkipInitialFetchRef = useRef(false);
	const [classPerformanceSummary, setClassPerformanceSummary] = useState<TeacherClassPerformanceSummary | null>(
		initialDashboardBundle.summary,
	);
	const [atRiskRows, setAtRiskRows] = useState<TeacherAtRiskStudentRow[]>(initialDashboardBundle.atRiskRows);
	const [dashboardError, setDashboardError] = useState<string | null>(null);
	const [dashboardPending, setDashboardPending] = useState(false);

	const gradeOptions = useMemo(() => {
		const fromData = filterOptions.grades.length ? filterOptions.grades : [];
		const fallback = Array.from({ length: 7 }, (_, i) => i + 6);
		const merged = new Set(fromData.length ? fromData : fallback);
		return [...merged].sort((a, b) => a - b);
	}, [filterOptions.grades]);

	const subjectOptions = useMemo(() => {
		if (grade === "all") return subjectsCatalog;
		return subjectsCatalog.filter((s) => s.grade === grade);
	}, [grade, subjectsCatalog]);

	const handleGradeChange = (value: string) => {
		const nextGrade = value === "" ? "all" : Number(value);
		setGrade(nextGrade);
		const options =
			nextGrade === "all" ? subjectsCatalog : subjectsCatalog.filter((s) => s.grade === nextGrade);
		if (subjectId !== "all" && !options.some((s) => s.id === subjectId)) {
			setSubjectId("all");
		}
	};

	const gradePillValue = grade === "all" ? "" : String(grade);
	const sectionPillValue = section === "all" ? "" : section;
	const subjectPillValue = subjectId === "all" ? "" : subjectId;

	const scopeSummaryParts = [
		grade === "all" ? "All grades" : `Grade ${grade}`,
		subjectId === "all" ? "All subjects" : (subjectOptions.find((s) => s.id === subjectId)?.name ?? "Subject"),
		section === "all" ? "All sections" : section,
	];
	const scopeLabel = scopeSummaryParts.join(" · ");
	const scopeKey = `${grade}|${section}|${subjectId}`;

	useEffect(() => {
		if (!didSkipInitialFetchRef.current && scopeKey === initialScopeKey) {
			didSkipInitialFetchRef.current = true;
			return;
		}
		didSkipInitialFetchRef.current = true;
		let cancelled = false;
		setDashboardPending(true);
		setDashboardError(null);
		setClassPerformanceSummary(null);
		setAtRiskRows([]);
		void (async () => {
			try {
				const res = await fetchTeacherDashboardBundle({ grade, section, subjectId });
				if (cancelled) return;
				if ("error" in res) {
					setDashboardError(res.error);
					setClassPerformanceSummary(null);
					setAtRiskRows([]);
					return;
				}
				setClassPerformanceSummary(res.summary);
				setAtRiskRows(res.atRiskRows);
			} catch {
				if (cancelled) return;
				setDashboardError("Could not load dashboard data for this scope.");
				setClassPerformanceSummary(null);
				setAtRiskRows([]);
			} finally {
				if (!cancelled) {
					setDashboardPending(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [grade, section, subjectId, scopeKey]);

	return (
		<div className="w-full min-w-0 space-y-8 py-6">
			<div className="flex w-full min-w-0 flex-col gap-6 medium:flex-row medium:items-start medium:justify-between medium:gap-8">
				<div className="min-w-0 flex-1 space-y-2">
					<h1 className="shrink-0 text-2xl font-semibold tracking-tight">Dashboard</h1>
					<p className="max-w-3xl text-sm leading-normal text-muted-foreground">
						Use{" "}
						<span className="text-foreground font-medium">Grade / class</span>,{" "}
						<span className="text-foreground font-medium">Subject</span>, and{" "}
						<span className="text-foreground font-medium">Section</span> to focus this dashboard. Distribution,
						class performance, and at-risk lists update together.
					</p>
				</div>
				<div
					className="flex w-[min(100%,30rem)] shrink-0 flex-col gap-3 ms-auto medium:ms-0 medium:w-[min(30rem,calc(100%-1.5rem))]"
					role="group"
					aria-label="Dashboard scope: grade, subject, and section"
				>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-muted-foreground text-xs font-medium medium:w-32">
							Grade / class
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Grade / class"
								ariaLabel="Set dashboard scope: grade or class"
								icon={GraduationCap}
								value={gradePillValue}
								options={[
									{ value: "", label: "All grades" },
									...gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` })),
								]}
								className="shadow-none"
								onValueChange={handleGradeChange}
							/>
						</div>
					</div>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-muted-foreground text-xs font-medium medium:w-32">
							Subject
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Subject"
								ariaLabel="Set dashboard scope: subject"
								icon={Library}
								value={subjectPillValue}
								options={[
									{ value: "", label: "All subjects" },
									...subjectOptions.map((s) => ({ value: s.id, label: s.name })),
								]}
								className="shadow-none"
								onValueChange={(v) => setSubjectId(v === "" ? "all" : v)}
							/>
						</div>
					</div>
					<div className="flex min-w-0 items-center gap-3">
						<span className="w-[7.75rem] shrink-0 whitespace-nowrap text-left text-muted-foreground text-xs font-medium medium:w-32">
							Section
						</span>
						<div className="min-w-0 flex-1">
							<ReportsPillSelect
								fullWidth
								menuTitle="Section"
								ariaLabel="Set dashboard scope: section"
								icon={Layers2}
								value={sectionPillValue}
								options={[
									{ value: "", label: "All sections" },
									...filterOptions.sections.map((s) => ({ value: s, label: s })),
								]}
								className="shadow-none"
								onValueChange={(v) => setSection(v === "" ? "all" : v)}
							/>
						</div>
					</div>
				</div>
			</div>

			<TeacherDashboardPerformanceBandStrip
				summary={classPerformanceSummary}
				pending={dashboardPending}
				error={dashboardError}
				subjectId={subjectId}
				scopeLabel={scopeLabel}
			/>

			<div className="grid grid-cols-1 gap-6 medium:grid-cols-3">
				<TeacherDashboardClassPerformanceCard
					subjectId={subjectId}
					scopeLabel={scopeLabel}
					activeOrganizationName={activeOrganization?.name ?? null}
					linkedStudentCount={linkCodeStudents.length}
					summary={classPerformanceSummary}
					error={dashboardError}
					pending={dashboardPending}
					className="medium:col-span-2"
				/>

				<TeacherDashboardAtRiskCard
					subjectId={subjectId}
					thresholdPercent={atRiskThresholdPercent}
					lastGradedCount={atRiskLastGradedCount}
					studentsInScope={classPerformanceSummary?.studentsInScope ?? null}
					studentsWithRecentScores={classPerformanceSummary?.studentsWithRecentScores ?? null}
					rows={atRiskRows}
					error={dashboardError}
					pending={dashboardPending}
				/>
			</div>
		</div>
	);
}
