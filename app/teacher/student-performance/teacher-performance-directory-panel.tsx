"use client";

import Link from "next/link";
import { GraduationCap, Layers2, Library } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchTeacherPerformanceDirectory } from "./teacher-performance-directory-actions";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";
import { cn } from "@/lib/utils";

export function TeacherPerformanceDirectoryPanel({
	workspaceDescription,
	subjectsCatalog,
	initialRows,
	filterOptions,
}: {
	workspaceDescription: string;
	subjectsCatalog: SubjectCatalogRow[];
	initialRows: TeacherPerformanceStudentRow[];
	filterOptions: { grades: number[]; sections: string[] };
}) {
	const [rows, setRows] = useState<TeacherPerformanceStudentRow[]>(initialRows);
	const [grade, setGrade] = useState<number | "all">("all");
	const [section, setSection] = useState<string | "all">("all");
	const [subjectId, setSubjectId] = useState<string | "all">("all");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const skipInitialFetch = useRef(true);

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

	useEffect(() => {
		if (skipInitialFetch.current) {
			skipInitialFetch.current = false;
			return;
		}
		startTransition(() => {
			void (async () => {
				setError(null);
				const res = await fetchTeacherPerformanceDirectory({ grade, section, subjectId });
				if ("error" in res) {
					setError(res.error);
					return;
				}
				setRows(res.rows);
			})();
		});
	}, [grade, section, subjectId]);

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

	const showingLabel =
		rows.length === 1 ? "Showing 1 student" : `Showing ${rows.length} students`;

	return (
		<div className="flex min-h-[calc(100svh-5rem)] w-full min-w-0 flex-col gap-8 py-6">
			<header className="shrink-0 space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Student performance</h1>
				<p className="text-sm text-muted-foreground">{workspaceDescription}</p>
			</header>

			<section
				aria-labelledby="teacher-performance-filters-heading"
				className="flex min-h-0 flex-1 flex-col gap-4"
			>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2
						id="teacher-performance-filters-heading"
						className="m-0 font-mono text-muted-foreground text-xs uppercase tracking-wider"
					>
						Find students
					</h2>
					<p className={cn("m-0 shrink-0 text-muted-foreground text-xs", pending && "opacity-70")}>
						<span className="font-medium tabular-nums text-foreground">{showingLabel}</span>
						{pending ? " · Updating…" : ""}
					</p>
				</div>

				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}

				<Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-none">
					<div className="shrink-0 p-[22px]">
						<div
							className="flex flex-nowrap items-end gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							role="group"
							aria-label="Filter students by grade, section, and subject"
						>
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Grade</span>
								<ReportsPillSelect
									menuTitle="Grade"
									ariaLabel="Filter students by grade"
									icon={GraduationCap}
									value={gradePillValue}
									options={[
										{ value: "", label: "All grades" },
										...gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` })),
									]}
									className="w-full min-w-0 max-w-none shadow-none"
									onValueChange={handleGradeChange}
								/>
							</div>
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Section</span>
								<ReportsPillSelect
									menuTitle="Section"
									ariaLabel="Filter students by section"
									icon={Layers2}
									value={sectionPillValue}
									options={[
										{ value: "", label: "All sections" },
										...filterOptions.sections.map((s) => ({ value: s, label: s })),
									]}
									className="w-full min-w-0 max-w-none shadow-none"
									onValueChange={(v) => setSection(v === "" ? "all" : v)}
								/>
							</div>
							<div className="flex min-w-[min(14rem,calc(100vw-2.75rem))] max-w-[min(20rem,85vw)] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Subject</span>
								<ReportsPillSelect
									menuTitle="Subject"
									ariaLabel="Filter students by subject"
									icon={Library}
									value={subjectPillValue}
									options={[
										{ value: "", label: "All subjects" },
										...subjectOptions.map((s) => ({
											value: s.id,
											label: `${s.name} (Gr. ${s.grade})`,
										})),
									]}
									className="w-full min-w-0 max-w-none shadow-none"
									onValueChange={(v) => setSubjectId(v === "" ? "all" : v)}
								/>
							</div>
						</div>
					</div>

					<div className="flex min-h-[min(60vh,28rem)] flex-1 flex-col border-border border-t bg-muted/5">
						{rows.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground text-sm medium:py-20">
								<p className="max-w-md text-pretty leading-relaxed">
									No students match these filters. Try different filters, use Link Student to connect students when
									you’re outside an organization, or confirm your organization roster.
								</p>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-auto">
								<div className="min-w-0 flex-1">
									<div className="min-w-[640px]">
										<div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_6.5rem_auto] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
											<span>Name</span>
											<span>Grade</span>
											<span>Sec.</span>
											<span>Code</span>
											<span className="text-right"> </span>
										</div>
										<ul className="divide-y divide-border/80 bg-background">
											{rows.map((row) => (
												<li
													key={row.id}
													className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_6.5rem_auto] items-center gap-2 px-4 py-3 text-sm"
												>
													<span className="min-w-0 truncate font-medium">{row.fullName}</span>
													<span className="text-muted-foreground tabular-nums">{row.grade ?? "—"}</span>
													<span className="text-muted-foreground">{row.section?.trim() || "—"}</span>
													<span className="font-mono text-muted-foreground text-xs tabular-nums">
														{row.studentLinkCode ?? "—"}
													</span>
													<div className="flex justify-end">
														<Button
															render={<Link href={`/teacher/student-performance/${row.id}/performance`} />}
															size="sm"
															variant="outline"
															className="whitespace-nowrap"
														>
															View performance
														</Button>
													</div>
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						)}
					</div>
				</Card>
			</section>
		</div>
	);
}
