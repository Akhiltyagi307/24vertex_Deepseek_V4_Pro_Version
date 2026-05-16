"use client";

import Link from "next/link";
import { GraduationCap, Layers2, Library, ListTree } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { fetchTeacherTopicPerformanceDirectory } from "./teacher-topic-performance-actions";
import { ReportsPillSelect } from "@/components/student/reports-pill-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TeacherTopicPerformanceRow } from "@/lib/teachers/teacher-topic-performance-queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";
import { cn } from "@/lib/utils";

function topicDetailHref(topicId: string, filters: { grade: number | "all"; section: string | "all"; subjectId: string | "all" }) {
	const q = new URLSearchParams();
	if (filters.grade !== "all") q.set("grade", String(filters.grade));
	if (filters.section !== "all") q.set("section", filters.section);
	if (filters.subjectId !== "all") q.set("subject", filters.subjectId);
	const qs = q.toString();
	return `/teacher/topic-performance/${topicId}${qs ? `?${qs}` : ""}`;
}

export function TeacherTopicPerformanceDirectoryPanel({
	workspaceDescription,
	subjectsCatalog,
	initialRows,
	filterOptions,
	initialSubjectId = "all",
}: {
	workspaceDescription: string;
	subjectsCatalog: SubjectCatalogRow[];
	initialRows: TeacherTopicPerformanceRow[];
	filterOptions: { grades: number[]; sections: string[] };
	initialSubjectId?: string | "all";
}) {
	const [rows, setRows] = useState<TeacherTopicPerformanceRow[]>(initialRows);
	const [grade, setGrade] = useState<number | "all">("all");
	const [section, setSection] = useState<string | "all">("all");
	const [subjectId, setSubjectId] = useState<string | "all">(initialSubjectId);
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
				const res = await fetchTeacherTopicPerformanceDirectory({ grade, section, subjectId });
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

	const showingLabel = rows.length === 1 ? "Showing 1 topic" : `Showing ${rows.length} topics`;

	const filterSnapshot = useMemo(() => ({ grade, section, subjectId }), [grade, section, subjectId]);

	return (
		<div className="flex min-h-[calc(100svh-5rem)] w-full min-w-0 flex-col gap-8 py-6">
			<header className="shrink-0 space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Topic performance</h1>
				<p className="text-sm text-muted-foreground">{workspaceDescription}</p>
			</header>

			<section
				aria-labelledby="teacher-topic-performance-filters-heading"
				className="flex min-h-0 flex-1 flex-col gap-4"
			>
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2
						id="teacher-topic-performance-filters-heading"
						className="m-0 font-mono text-muted-foreground text-xs uppercase tracking-wider"
					>
						Find topics
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
							aria-label="Filter topics by grade, section, and subject"
						>
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Grade</span>
								<ReportsPillSelect
									fullWidth
									menuTitle="Grade"
									ariaLabel="Filter topics by roster grade"
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
							<div className="flex w-[min(14rem,calc(100vw-2.75rem))] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Section</span>
								<ReportsPillSelect
									fullWidth
									menuTitle="Section"
									ariaLabel="Filter topics by section"
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
							<div className="flex min-w-[min(14rem,calc(100vw-2.75rem))] max-w-[min(20rem,85vw)] shrink-0 flex-col gap-1.5">
								<span className="text-foreground text-xs font-medium">Subject</span>
								<ReportsPillSelect
									fullWidth
									menuTitle="Subject"
									ariaLabel="Filter topics by subject"
									icon={Library}
									value={subjectPillValue}
									options={[
										{ value: "", label: "All subjects" },
										...subjectOptions.map((s) => ({
											value: s.id,
											label: `${s.name} (Gr. ${s.grade})`,
										})),
									]}
									className="shadow-none"
									onValueChange={(v) => setSubjectId(v === "" ? "all" : v)}
								/>
							</div>
						</div>
					</div>

					<div className="flex min-h-[min(60vh,28rem)] flex-1 flex-col border-border border-t bg-muted/5">
						{rows.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground text-sm medium:py-20">
								<ListTree className="mx-auto size-10 opacity-40" aria-hidden />
								<p className="max-w-md text-pretty leading-relaxed">
									No topic-level tracker data matches these filters yet. Students build topic scores from graded practice;
									try widening filters, confirm linked students have practiced in this subject, or check back after more
									assignments are graded.
								</p>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-auto">
								<div className="min-w-0 flex-1">
									<div className="min-w-[860px]">
										<div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_3rem_4rem_4.5rem_4rem_4rem_auto] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
											<span>Topic</span>
											<span>Subject</span>
											<span>Gr.</span>
											<span>Avg</span>
											<span>Students</span>
											<span>Tests</span>
											<span title="Students averaging below 60%">&lt;60%</span>
											<span className="text-right"> </span>
										</div>
										<ul className="divide-y divide-border/80 bg-background">
											{rows.map((row) => (
												<li
													key={row.topicId}
													className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_3rem_4rem_4.5rem_4rem_4rem_auto] items-center gap-2 px-4 py-3 text-sm"
												>
													<span className="min-w-0 truncate font-medium" title={row.topicName}>
														{row.topicName}
													</span>
													<span className="min-w-0 truncate text-muted-foreground" title={row.subjectName}>
														{row.subjectName}
													</span>
													<span className="text-muted-foreground tabular-nums">{row.topicGrade}</span>
													<span className="tabular-nums">{row.averagePercent}%</span>
													<span className="tabular-nums">{row.studentsWithData}</span>
													<span className="tabular-nums">{row.testsTaken}</span>
													<span className="tabular-nums">{row.studentsBelowSupportLine}</span>
													<div className="flex justify-end">
														<Button
															render={
																<Link href={topicDetailHref(row.topicId, filterSnapshot)} prefetch={false} />
															}
															size="sm"
															variant="outline"
															className="whitespace-nowrap"
														>
															Class breakdown
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
