"use client";

import * as React from "react";
import Link from "next/link";

import { TeacherManualAssignmentBuilder } from "@/components/teacher/manual/teacher-manual-assignment-builder";
import type { AssignmentTopicCatalogRow } from "@/lib/assignments/queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";
import type { TeacherPerformanceStudentRow } from "@/lib/teachers/teacher-performance-directory-types";
import { cn } from "@/lib/utils";

import { TeacherAssignmentsManager } from "./teacher-assignments-manager";

type Mode = "ai" | "manual";

export function AssignmentCreateSwitcher(props: {
	subjectsCatalog: SubjectCatalogRow[];
	topicsCatalog: AssignmentTopicCatalogRow[];
	students: TeacherPerformanceStudentRow[];
	manualDrafts: { id: string; title: string; questionCount: number; updatedAt: string | null }[];
	initialGrade?: number | null;
}) {
	const [mode, setMode] = React.useState<Mode>("ai");

	const tab = (id: Mode, label: string) => (
		<button
			type="button"
			onClick={() => setMode(id)}
			aria-pressed={mode === id}
			className={cn(
				"min-h-9 rounded-lg px-4 text-sm font-medium transition-colors",
				mode === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50",
			)}
		>
			{label}
		</button>
	);

	return (
		<>
			<div className="mx-auto w-full max-w-6xl px-4 pt-6 medium:px-0">
				<div className="flex w-fit items-center gap-1 rounded-xl border border-border/70 bg-muted/20 p-1">
					{tab("ai", "AI-generated")}
					{tab("manual", "Write my own")}
				</div>
			</div>
			{/* Both panels stay mounted (toggled with `hidden`) so switching tabs never
			    wipes an in-progress form. */}
			<div className={cn(mode !== "ai" && "hidden")}>
				<TeacherAssignmentsManager
					subjectsCatalog={props.subjectsCatalog}
					topicsCatalog={props.topicsCatalog}
					students={props.students}
					initialGrade={props.initialGrade}
				/>
			</div>
			<div className={cn(mode !== "manual" && "hidden")}>
				<div className="mx-auto w-full max-w-6xl px-4 py-6 medium:px-0">
					{props.manualDrafts.length > 0 ? (
						<div className="mb-5 rounded-xl border border-border/70 bg-muted/15 p-4">
							<p className="mb-2 font-medium text-foreground text-sm">Continue a draft</p>
							<ul className="space-y-1">
								{props.manualDrafts.map((d) => (
									<li key={d.id}>
										<Link
											href={`/teacher/assignments/${d.id}/edit`}
											className="text-link text-sm underline-offset-4 hover:underline"
										>
											{d.title || "Untitled draft"}
										</Link>
										<span className="text-muted-foreground text-xs">
											{" "}
											· {d.questionCount} question{d.questionCount === 1 ? "" : "s"}
										</span>
									</li>
								))}
							</ul>
						</div>
					) : null}
					<TeacherManualAssignmentBuilder
						subjectsCatalog={props.subjectsCatalog}
						topicsCatalog={props.topicsCatalog}
						students={props.students}
					/>
				</div>
			</div>
		</>
	);
}
